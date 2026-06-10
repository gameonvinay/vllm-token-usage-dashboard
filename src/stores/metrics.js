import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'vllm-dashboard-v2'
const MAX_HISTORY = 60

// ─── Prometheus text parser ───────────────────────────────────────────────────
function parsePrometheus(text) {
  const metrics = {}
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([\d.+\-eE]+|NaN)/)
    if (match) {
      const [, name, labelStr = '', valStr] = match
      const val = parseFloat(valStr)
      if (isNaN(val)) continue

      // Store total sum across all label variants (for most metrics)
      metrics[name] = (metrics[name] || 0) + val

      // Also store by pool_name label so GPU and CPU KV cache can be read separately
      // e.g. vllm:gpu_cache_usage_perc{pool_name="gpu"} → key 'vllm:gpu_cache_usage_perc::gpu'
      const poolMatch = labelStr.match(/pool_name="([^"]+)"/)
      if (poolMatch) {
        const key = `${name}::${poolMatch[1]}`
        // Use max (not sum) because each pool_name is independent
        metrics[key] = Math.max(metrics[key] || 0, val)
      }
    }
  }
  return metrics
}

// ─── Time bucket helpers ──────────────────────────────────────────────────────
function getTimeBuckets(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const wd = date.getDay()           // 0=Sun … 6=Sat
  const h = date.getHours()

  // ISO week number
  const utcDate = new Date(Date.UTC(y, date.getMonth(), d))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const wk = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)

  return {
    year:    String(y),
    month:   `${y}-${String(m).padStart(2, '0')}`,
    week:    `${y}-W${String(wk).padStart(2, '0')}`,
    weekday: String(wd),
    hour:    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}`,
  }
}

function emptyBucket() {
  return { promptTokens: 0, genTokens: 0, cachedTokens: 0, requests: 0, cacheHits: 0, cacheQueries: 0, specAccepted: 0, specDraft: 0 }
}

function addToBucket(target, key, delta) {
  if (!target[key]) target[key] = emptyBucket()
  for (const k of Object.keys(delta)) {
    target[key][k] = (target[key][k] || 0) + (delta[k] || 0)
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useMetricsStore = defineStore('metrics', () => {

  // Settings
  const serverUrl      = ref(localStorage.getItem('vllm-server-url') || import.meta.env.VITE_VLLM_BASE_URL || 'http://localhost:8000')
  const pollIntervalMs = ref(parseInt(localStorage.getItem('vllm-poll-interval') || import.meta.env.VITE_POLL_INTERVAL_MS || '5000'))

  // Server state
  const serverStatus = ref('offline')   // 'offline' | 'loading' | 'ready'
  const modelName    = ref('')
  const lastUpdated  = ref(null)
  const fetchError   = ref(null)

  // Current raw counters (from last /metrics scrape)
  const raw = ref({
    promptTokens: 0, genTokens: 0, cachedTokens: 0,
    cacheHits: 0, cacheQueries: 0,
    gpuCacheUsage: 0, cpuCacheUsage: 0,
    specAccepted: 0, specDraft: 0, specDrafts: 0,
    requestsRunning: 0, requestsWaiting: 0, requestsSuccess: 0,
  })

  // Previous snapshot for delta + rate calculations
  const prev = ref({ ...raw.value, ts: null })

  // Per-second rates
  const rates = ref({ promptTokens: 0, genTokens: 0, cachedTokens: 0 })

  // Whether MTP/speculative decoding is active
  const isMtpEnabled = ref(false)

  // Decayed/smooth peak GPU cache usage for animated display
  const gpuCacheUsagePeak = ref(0)

  // ── Rolling sparkline history (in-session + localStorage) ──
  const saved = loadState()
  const history = ref(saved?.history || {
    promptTokensRate: [], genTokensRate: [], cachedTokensRate: [],
    cacheHitRate: [], gpuCache: [], cpuCache: [],
    mtpAcceptanceRate: [], requestsRunning: [],
  })

  // ── Time-bucketed aggregates ──
  // Each dimension: { [key]: { promptTokens, genTokens, cachedTokens, requests, cacheHits, cacheQueries, specAccepted, specDraft } }
  const timeSeries = ref(saved?.timeSeries || {
    byYear:    {},
    byMonth:   {},
    byWeek:    {},
    byWeekday: {},
    byHour:    {},
  })

  // ── Lifetime accumulator (survives server restarts) ────────────────────────
  // Deltas are added here every poll — vLLM counter resets don't affect it
  // because we clamp negative deltas to 0 before accumulating.
  const lifetime = ref(saved?.lifetime || {
    promptTokens:   0,
    genTokens:      0,
    cachedTokens:   0,
    requests:       0,
    cacheHits:      0,
    cacheQueries:   0,
    specAccepted:   0,
    specDraft:      0,
    serverRestarts: 0,      // incremented when a counter drop is detected
    firstSeenAt:    null,   // ISO string of first data point ever recorded
    lastRestartAt:  null,   // ISO string of last detected server restart
    gpuCachePeak:   0,      // persistent maximum GPU cache usage
  })

  // ── Legacy cyclical key migration ──────────────────────────────────────────
  if (timeSeries.value.byHour) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const prefix = `${y}-${m}-${day}`

    const migrated = {}
    let hasLegacy = false
    for (const [key, val] of Object.entries(timeSeries.value.byHour)) {
      if (key.length <= 2) {
        const hourNum = parseInt(key, 10)
        let keyPrefix = prefix
        if (hourNum > now.getHours()) {
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          const yy = yesterday.getFullYear()
          const mm = String(yesterday.getMonth() + 1).padStart(2, '0')
          const dd = String(yesterday.getDate()).padStart(2, '0')
          keyPrefix = `${yy}-${mm}-${dd}`
        }
        const newKey = `${keyPrefix} ${String(hourNum).padStart(2, '0')}`
        migrated[newKey] = val
        hasLegacy = true
      } else {
        migrated[key] = val
      }
    }
    if (hasLegacy) {
      timeSeries.value.byHour = migrated
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          history: history.value,
          timeSeries: timeSeries.value,
          lifetime: lifetime.value
        }))
      } catch {}
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const cacheHitRate = computed(() => {
    const q = raw.value.cacheQueries
    return q > 0 ? raw.value.cacheHits / q : null
  })

  const lifetimeCacheHitRate = computed(() => {
    const q = lifetime.value.cacheQueries
    return q > 0 ? lifetime.value.cacheHits / q : null
  })

  const mtpAcceptanceRate = computed(() => {
    const d = raw.value.specDraft
    return d > 0 ? raw.value.specAccepted / d : null
  })

  const lifetimeMtpAcceptanceRate = computed(() => {
    const d = lifetime.value.specDraft
    return d > 0 ? lifetime.value.specAccepted / d : null
  })

  const engineStatus = computed(() => {
    if (raw.value.requestsWaiting > 0) return 'saturated'
    if (raw.value.requestsRunning > 0) return 'busy'
    return 'idle'
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function buildUrl(path) {
    return `${serverUrl.value.replace(/\/$/, '')}${path}`
  }

  function pushHistory(key, value) {
    if (!history.value[key]) history.value[key] = []
    history.value[key].push(value)
    if (history.value[key].length > MAX_HISTORY) history.value[key].shift()
  }

  function accumulateTimeSeries(delta) {
    const buckets = getTimeBuckets()
    addToBucket(timeSeries.value.byYear,    buckets.year,    delta)
    addToBucket(timeSeries.value.byMonth,   buckets.month,   delta)
    addToBucket(timeSeries.value.byWeek,    buckets.week,    delta)
    addToBucket(timeSeries.value.byWeekday, buckets.weekday, delta)
    addToBucket(timeSeries.value.byHour,    buckets.hour,    delta)
  }

  function accumulateLifetime(delta) {
    const lt = lifetime.value
    lt.promptTokens  += delta.promptTokens  || 0
    lt.genTokens     += delta.genTokens     || 0
    lt.cachedTokens  += delta.cachedTokens  || 0
    lt.requests      += delta.requests      || 0
    lt.cacheHits     += delta.cacheHits     || 0
    lt.cacheQueries  += delta.cacheQueries  || 0
    lt.specAccepted  += delta.specAccepted  || 0
    lt.specDraft     += delta.specDraft     || 0
    if (!lt.firstSeenAt) lt.firstSeenAt = new Date().toISOString()
  }

  function persist() {
    saveState({ history: history.value, timeSeries: timeSeries.value, lifetime: lifetime.value })
  }

  // ── Fetch actions ─────────────────────────────────────────────────────────────
  async function fetchModels() {
    try {
      const res = await fetch(buildUrl('/v1/models'), { signal: AbortSignal.timeout(4000) })
      if (!res.ok) { serverStatus.value = 'loading'; return false }
      const data = await res.json()
      const models = data?.data || []
      if (models.length > 0) {
        serverStatus.value = 'ready'
        modelName.value = models[0].id
        return true
      }
      serverStatus.value = 'loading'
      return false
    } catch {
      serverStatus.value = 'offline'
      modelName.value = ''
      return false
    }
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(buildUrl('/metrics'), { signal: AbortSignal.timeout(4000) })
      if (!res.ok) return
      const text = await res.text()
      const m = parsePrometheus(text)
      const now = Date.now()
      const dt = prev.value.ts ? (now - prev.value.ts) / 1000 : null

      const newRaw = {
        promptTokens:    m['vllm:prompt_tokens_total'] || 0,
        genTokens:       m['vllm:generation_tokens_total'] || 0,
        cachedTokens:    m['vllm:prompt_tokens_cached'] || m['vllm:prefix_cache_hits_total'] || m['vllm:prefix_cache_hits'] || 0,
        cacheHits:       m['vllm:prefix_cache_hits_total'] || m['vllm:prefix_cache_hits'] || 0,
        cacheQueries:    m['vllm:prefix_cache_queries_total'] || m['vllm:prefix_cache_queries'] || 0,
        gpuCacheUsage:   // V1 engine uses pool_name label; fall back to bare metric name for V0, then vllm:kv_cache_usage_perc
                         m['vllm:gpu_cache_usage_perc::gpu'] ??
                         m['vllm:gpu_cache_usage_perc'] ??
                         m['vllm:kv_cache_usage_perc'] ??
                         m['vllm:gpu_cache_usage_factor'] ?? 0,
        cpuCacheUsage:   m['vllm:gpu_cache_usage_perc::cpu'] ??
                         m['vllm:cpu_cache_usage_perc'] ?? 0,
        specAccepted:    m['vllm:spec_decode_num_accepted_tokens_total'] || m['vllm:spec_decode_num_accepted_tokens'] || 0,
        specDraft:       m['vllm:spec_decode_num_draft_tokens_total'] || m['vllm:spec_decode_num_draft_tokens'] || 0,
        specDrafts:      m['vllm:spec_decode_num_drafts_total'] || m['vllm:spec_decode_num_drafts'] || 0,
        requestsRunning: m['vllm:num_requests_running'] || 0,
        requestsWaiting: m['vllm:num_requests_waiting'] || 0,
        requestsSuccess: m['vllm:request_success_total'] || 0,
      }

      isMtpEnabled.value = ('vllm:spec_decode_num_draft_tokens_total' in m) || ('vllm:spec_decode_num_draft_tokens' in m)

      // Compute delta (only positive — counters should only go up)
      const delta = {
        promptTokens: Math.max(0, newRaw.promptTokens - (prev.value.promptTokens || 0)),
        genTokens:    Math.max(0, newRaw.genTokens    - (prev.value.genTokens    || 0)),
        cachedTokens: Math.max(0, newRaw.cachedTokens - (prev.value.cachedTokens || 0)),
        requests:     Math.max(0, newRaw.requestsSuccess - (prev.value.requestsSuccess || 0)),
        cacheHits:    Math.max(0, newRaw.cacheHits    - (prev.value.cacheHits    || 0)),
        cacheQueries: Math.max(0, newRaw.cacheQueries - (prev.value.cacheQueries || 0)),
        specAccepted: Math.max(0, newRaw.specAccepted - (prev.value.specAccepted || 0)),
        specDraft:    Math.max(0, newRaw.specDraft    - (prev.value.specDraft    || 0)),
      }

      // Detect server restart: any major counter dropped significantly
      const serverRestarted = prev.value.ts && (
        (prev.value.promptTokens > 100 && newRaw.promptTokens < prev.value.promptTokens * 0.5) ||
        (prev.value.genTokens    > 100 && newRaw.genTokens    < prev.value.genTokens    * 0.5) ||
        (prev.value.requestsSuccess > 10 && newRaw.requestsSuccess < prev.value.requestsSuccess * 0.5)
      )
      if (serverRestarted) {
        lifetime.value.serverRestarts += 1
        lifetime.value.lastRestartAt = new Date().toISOString()
      }

      // Accumulate if we had a previous snapshot and any countable activity happened
      const anyActivity = delta.promptTokens > 0 || delta.genTokens > 0 ||
        delta.cachedTokens > 0 || delta.cacheHits > 0 ||
        delta.requests > 0 || delta.specAccepted > 0
      if (prev.value.ts && anyActivity) {
        accumulateTimeSeries(delta)
        accumulateLifetime(delta)
      }

      // Calculate rates
      if (dt && dt > 0) {
        rates.value = {
          promptTokens: delta.promptTokens / dt,
          genTokens:    delta.genTokens    / dt,
          cachedTokens: delta.cachedTokens / dt,
        }
      }

      prev.value = { ...newRaw, ts: now }
      raw.value = newRaw
      lastUpdated.value = new Date()
      fetchError.value = null

      // Update GPU cache peak tracking
      if (newRaw.gpuCacheUsage > gpuCacheUsagePeak.value) {
        gpuCacheUsagePeak.value = newRaw.gpuCacheUsage
      } else {
        // Smooth decay (15% reduction per poll) to keep the gauge animated and alive after queries
        gpuCacheUsagePeak.value = Math.max(0, gpuCacheUsagePeak.value * 0.85 - 0.01)
      }
      if (newRaw.gpuCacheUsage > (lifetime.value.gpuCachePeak || 0)) {
        lifetime.value.gpuCachePeak = newRaw.gpuCacheUsage
      }

      // Update sparklines
      pushHistory('promptTokensRate', rates.value.promptTokens)
      pushHistory('genTokensRate',    rates.value.genTokens)
      pushHistory('cachedTokensRate', rates.value.cachedTokens)
      pushHistory('cacheHitRate',     cacheHitRate.value ?? 0)
      pushHistory('gpuCache',         gpuCacheUsagePeak.value)
      pushHistory('cpuCache',         newRaw.cpuCacheUsage)
      pushHistory('mtpAcceptanceRate', mtpAcceptanceRate.value ?? 0)
      pushHistory('requestsRunning',  newRaw.requestsRunning)

      persist()
    } catch (e) {
      fetchError.value = e.message
    }
  }

  async function poll() {
    await fetchModels()
    if (serverStatus.value !== 'offline') await fetchMetrics()
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  function updateSettings(url, interval) {
    serverUrl.value = url
    pollIntervalMs.value = interval
    localStorage.setItem('vllm-server-url', url)
    localStorage.setItem('vllm-poll-interval', String(interval))
  }

  // ── Clear history ─────────────────────────────────────────────────────────────
  function clearHistory() {
    Object.keys(history.value).forEach(k => { history.value[k] = [] })
    timeSeries.value = { byYear: {}, byMonth: {}, byWeek: {}, byWeekday: {}, byHour: {} }
    rates.value = { promptTokens: 0, genTokens: 0, cachedTokens: 0 }
    prev.value = { ...raw.value, ts: null }
    localStorage.removeItem(STORAGE_KEY)
  }

  function clearLifetime() {
    lifetime.value = {
      promptTokens: 0, genTokens: 0, cachedTokens: 0,
      requests: 0, cacheHits: 0, cacheQueries: 0,
      specAccepted: 0, specDraft: 0,
      serverRestarts: 0, firstSeenAt: null, lastRestartAt: null,
      gpuCachePeak: 0,
    }
    persist()
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      serverUrl:  serverUrl.value,
      lifetime:   lifetime.value,
      history:    history.value,
      timeSeries: timeSeries.value,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vllm-metrics-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          // Merge timeSeries (deep merge)
          if (data.timeSeries) {
            for (const dim of ['byYear', 'byMonth', 'byWeek', 'byWeekday', 'byHour']) {
              if (!data.timeSeries[dim]) continue
              if (!timeSeries.value[dim]) timeSeries.value[dim] = {}
              for (const [key, bucket] of Object.entries(data.timeSeries[dim])) {
                if (!timeSeries.value[dim][key]) {
                  timeSeries.value[dim][key] = { ...bucket }
                } else {
                  for (const k of Object.keys(bucket)) {
                    timeSeries.value[dim][key][k] = (timeSeries.value[dim][key][k] || 0) + (bucket[k] || 0)
                  }
                }
              }
            }
          }
          // Merge history arrays (append, dedup by capping at MAX_HISTORY)
          if (data.history) {
            for (const [key, arr] of Object.entries(data.history)) {
              if (!history.value[key]) history.value[key] = []
              history.value[key] = [...arr, ...history.value[key]].slice(-MAX_HISTORY)
            }
          }
          // Merge lifetime (add, keeping earliest firstSeenAt)
          if (data.lifetime) {
            const lt = lifetime.value
            const imp = data.lifetime
            lt.promptTokens  += imp.promptTokens  || 0
            lt.genTokens     += imp.genTokens     || 0
            lt.cachedTokens  += imp.cachedTokens  || 0
            lt.requests      += imp.requests      || 0
            lt.cacheHits     += imp.cacheHits     || 0
            lt.cacheQueries  += imp.cacheQueries  || 0
            lt.specAccepted  += imp.specAccepted  || 0
            lt.specDraft     += imp.specDraft     || 0
            lt.serverRestarts += imp.serverRestarts || 0
            // Keep the earlier firstSeenAt
            if (imp.firstSeenAt && (!lt.firstSeenAt || imp.firstSeenAt < lt.firstSeenAt)) {
              lt.firstSeenAt = imp.firstSeenAt
            }
          }
          persist()
          resolve({ success: true, exportedAt: data.exportedAt })
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  return {
    // Settings
    serverUrl, pollIntervalMs,
    // State
    serverStatus, modelName, lastUpdated, fetchError,
    raw, rates, isMtpEnabled,
    cacheHitRate, lifetimeCacheHitRate,
    mtpAcceptanceRate, lifetimeMtpAcceptanceRate,
    engineStatus,
    history, timeSeries, lifetime,
    gpuCacheUsagePeak,
    // Actions
    poll, clearHistory, clearLifetime, updateSettings,
    exportData, importData,
  }
})
