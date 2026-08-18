import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  initFirebase,
  isFirebaseConfigured,
  saveStateToFirestore,
  subscribeToFirestore,
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  getSavedFirebaseConfig,
  saveFirebaseConfig
} from '@/services/firebase'

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
  const modelContextLen = ref(null)     // e.g. 240000
  const modelHasVision  = ref(false)    // true if vision capability detected
  const lastUpdated  = ref(null)
  const fetchError   = ref(null)

  // Host system hardware telemetry (GPU, CPU, RAM)
  const systemMetrics = ref(null)

  // Current raw counters (from last /metrics scrape)
  const raw = ref({
    promptTokens: 0, genTokens: 0, cachedTokens: 0,
    cacheHits: 0, cacheQueries: 0,
    externalHits: 0, externalQueries: 0,
    gpuCacheUsage: 0, cpuCacheUsage: 0,
    specAccepted: 0, specDraft: 0, specDrafts: 0,
    requestsRunning: 0, requestsWaiting: 0, requestsSuccess: 0,
  })

  // Previous snapshot for delta + rate calculations
  const prev = ref({ ...raw.value, ts: null })

  // Per-second rates
  const rates = ref({ promptTokens: 0, genTokens: 0, cachedTokens: 0 })
  const lastPrefillSpeed = ref(0)       // Most recent prompt processing throughput (tok/s)
  const peakPrefillSpeed = ref(0)       // Session peak prompt processing throughput (tok/s)

  // Whether MTP/speculative decoding is active
  const isMtpEnabled = ref(false)

  // Backend type detection: 'vllm' | 'llamacpp'
  const backendType = ref('vllm')

  // ── Firebase Cloud Sync & Authentication ──────────────────────────────────
  const firebaseConfig  = ref(getSavedFirebaseConfig())
  const cloudSyncStatus = ref(isFirebaseConfigured() ? 'synced' : 'disabled') // 'disabled' | 'syncing' | 'synced' | 'error'
  const authUser        = ref(null)
  const authError       = ref(null)
  const authLoading     = ref(true)

  // Restore existing session if previously authenticated
  try {
    const savedSession = localStorage.getItem('vllm_owner_session')
    if (savedSession) {
      authUser.value = JSON.parse(savedSession)
    }
  } catch {}

  function loginWithPasskey(passkey) {
    const validKeys = [
      'vinay5090',
      'vinaysaini',
      '5090',
      'sk-vinay-master-admin-5090-key',
      'sk-proj-vinaysaini-d56fd6f12a1eef114be1ccc3c8be0557a4e0d2c1'
    ]

    if (validKeys.includes(passkey?.trim())) {
      const userObj = {
        displayName: 'Vinay Saini',
        email: 'owner@vinaysaini.dev',
        isPasskeyAuth: true
      }
      authUser.value = userObj
      localStorage.setItem('vllm_owner_session', JSON.stringify(userObj))
      return true
    }
    return false
  }

  function checkIsLocalNetwork() {
    if (typeof window === 'undefined') return false
    const host = window.location.hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    )
  }

  const isLocalLan = ref(checkIsLocalNetwork())

  const isAuthLocked = computed(() => {
    // If on Local LAN or localhost, always grant immediate access
    if (isLocalLan.value) return false
    // If still verifying Firebase session on hosted domain, keep locked
    if (authLoading.value && !authUser.value) return false
    // On hosted public domain, require authenticated user
    return !authUser.value
  })

  // Initialize Firebase listeners if enabled
  if (isFirebaseConfigured()) {
    initFirebase(firebaseConfig.value)
    subscribeToFirestore((cloudData) => {
      if (cloudData?.lifetime) {
        mergeCloudLifetime(cloudData.lifetime)
      }
    })
    onAuthChange((user) => {
      if (user) {
        authUser.value = user
        localStorage.setItem('vllm_owner_session', JSON.stringify({
          displayName: user.displayName || 'Vinay Saini',
          email: user.email,
          photoURL: user.photoURL
        }))
      }
      authLoading.value = false
    })
  } else {
    authLoading.value = false
  }

  // ── llama.cpp slot-based tracking ────────────────────────────────────────
  // llamacpp:tokens_predicted_total is broken in MTP mode (stays 0).
  // We poll /slots and accumulate n_decoded and n_prompt_tokens_processed deltas ourselves.
  const llamaCppPrevSlots       = ref({})   // slot_id → last known n_decoded
  const llamaCppPrevPromptSlots = ref({})   // slot_id → last known n_prompt_tokens_processed
  const llamaCppSlotGenTotal    = ref(0)    // our monotonically-increasing gen counter

  // Decayed/smooth peak GPU & CPU cache usage for animated display
  const gpuCacheUsagePeak = ref(0)
  const cpuCacheUsagePeak = ref(0)

  // GPU KV Cache Capacity and active memory based on exact vLLM engine profile (9.66 GiB / 302,682 tokens)
  const gpuKvCacheCapacityGb = ref(9.66)
  const gpuKvCacheTokensCapacity = ref(302682)

  const gpuCacheFilledGb = computed(() => {
    return ((raw.value.gpuCacheUsage || 0) * gpuKvCacheCapacityGb.value).toFixed(2)
  })
  const gpuActiveTokens = computed(() => {
    return Math.round((raw.value.gpuCacheUsage || 0) * gpuKvCacheTokensCapacity.value)
  })

  // Configured CPU DRAM KV cache offload capacity in GB (default 40 GB)
  const cpuCacheOffloadGb = ref(parseFloat(localStorage.getItem('vllm-cpu-offload-gb') || '40'))

  // Computed filled DRAM values in GB
  const cpuCacheFilledGb = computed(() => (((raw.value.cpuCacheUsage || 0) * cpuCacheOffloadGb.value)).toFixed(2))
  const cpuCachePeakFilledGb = computed(() => ((((lifetime.value.cpuCachePeak || 0) * cpuCacheOffloadGb.value))).toFixed(2))

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
    externalHits:   0,
    externalQueries: 0,
    specAccepted:   0,
    specDraft:      0,
    serverRestarts: 0,      // incremented when a counter drop is detected
    firstSeenAt:    null,   // ISO string of first data point ever recorded
    lastRestartAt:  null,   // ISO string of last detected server restart
    gpuCachePeak:   0,      // persistent maximum GPU cache usage
    cpuCachePeak:   0,      // persistent maximum CPU DRAM cache usage
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
    const url = (serverUrl.value || '').trim().replace(/\/$/, '')
    // If pointing to default localhost:8000 or relative, route via the same-origin backend proxy
    // to avoid browser Private Network Access permission prompts and work remotely
    if (!url || url === 'http://localhost:8000' || url === 'http://127.0.0.1:8000' || url === '/api') {
      return `/api${path}`
    }
    return `${url}${path}`
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
    lt.externalHits  += delta.externalHits  || 0
    lt.externalQueries += delta.externalQueries || 0
    lt.specAccepted  += delta.specAccepted  || 0
    lt.specDraft     += delta.specDraft     || 0
    if (!lt.firstSeenAt) lt.firstSeenAt = new Date().toISOString()
  }

  function mergeCloudLifetime(cloudLt) {
    if (!cloudLt) return
    const lt = lifetime.value
    lt.promptTokens    = Math.max(lt.promptTokens, cloudLt.promptTokens || 0)
    lt.genTokens       = Math.max(lt.genTokens, cloudLt.genTokens || 0)
    lt.cachedTokens    = Math.max(lt.cachedTokens, cloudLt.cachedTokens || 0)
    lt.requests        = Math.max(lt.requests, cloudLt.requests || 0)
    lt.cacheHits       = Math.max(lt.cacheHits, cloudLt.cacheHits || 0)
    lt.cacheQueries    = Math.max(lt.cacheQueries, cloudLt.cacheQueries || 0)
    lt.externalHits    = Math.max(lt.externalHits || 0, cloudLt.externalHits || 0)
    lt.externalQueries = Math.max(lt.externalQueries || 0, cloudLt.externalQueries || 0)
    lt.gpuCachePeak    = Math.max(lt.gpuCachePeak || 0, cloudLt.gpuCachePeak || 0)
    lt.cpuCachePeak    = Math.max(lt.cpuCachePeak || 0, cloudLt.cpuCachePeak || 0)
    if (cloudLt.firstSeenAt && (!lt.firstSeenAt || cloudLt.firstSeenAt < lt.firstSeenAt)) {
      lt.firstSeenAt = cloudLt.firstSeenAt
    }
  }

  function persist() {
    saveState({ history: history.value, timeSeries: timeSeries.value, lifetime: lifetime.value })
    if (isFirebaseConfigured()) {
      saveStateToFirestore({
        lifetime: lifetime.value,
        timeSeries: timeSeries.value,
        lastModel: modelName.value,
      })
    }
  }

  // ── Fetch actions ─────────────────────────────────────────────────────────────
  async function fetchModels() {
    try {
      const res = await fetch(buildUrl('/v1/models'), { signal: AbortSignal.timeout(4000) })
      if (!res.ok) { serverStatus.value = 'loading'; return false }
      const data = await res.json()
      const models = data?.data || data?.models || []
      if (models.length > 0) {
        serverStatus.value = 'ready'
        const m = models[0]
        modelName.value = m.id || m.name || ''

        // Context size: vLLM provides max_model_len; llama.cpp provides meta.n_ctx or details
        const ctx = m.max_model_len || m.meta?.n_ctx || m.max_context_length || null
        modelContextLen.value = ctx ? Number(ctx) : null

        // Vision capability detection
        const idStr = (m.id || m.name || '').toLowerCase()
        const rootStr = (m.root || '').toLowerCase()
        const caps = Array.isArray(m.capabilities) ? m.capabilities.map(c => String(c).toLowerCase()) : []
        const hasVision =
          caps.includes('vision') ||
          caps.includes('image_input') ||
          idStr.includes('-vl') ||
          idStr.includes('_vl') ||
          idStr.includes('vision') ||
          idStr.includes('llava') ||
          idStr.includes('pixtral') ||
          idStr.includes('minicpm-v') ||
          idStr.includes('internvl') ||
          rootStr.includes('vision') ||
          rootStr.includes('vl')
        modelHasVision.value = hasVision

        return true
      }
      serverStatus.value = 'loading'
      return false
    } catch {
      serverStatus.value = 'offline'
      modelName.value = ''
      modelContextLen.value = null
      modelHasVision.value = false
      return false
    }
  }

  async function fetchSystemMetrics() {
    try {
      const res = await fetch('/api/system-info', { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        systemMetrics.value = data
      }
    } catch {
      // Non-fatal if system metrics endpoint is not reachable
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

      // ── Detect backend (vLLM vs llama.cpp) ─────────────────────────────────
      // llama.cpp uses "llamacpp:" prefix; vLLM uses "vllm:" prefix
      const isLlamaCpp = 'llamacpp:prompt_tokens_total' in m

      // ── For llama.cpp: fetch /slots and compute cumulative gen tokens & live prefill ──
      // llamacpp:tokens_predicted_total never increments in MTP mode.
      // Instead, each active slot exposes next_token[0].n_decoded and n_prompt_tokens_processed.
      let liveSlotPrefillSpeed = 0
      if (isLlamaCpp) {
        try {
          const slotsRes = await fetch(buildUrl('/slots'), { signal: AbortSignal.timeout(3000) })
          if (slotsRes.ok) {
            const slots = await slotsRes.json()
            for (const slot of slots) {
              const slotId = slot.id
              const curGen = slot.next_token?.[0]?.n_decoded || 0
              const prvGen = llamaCppPrevSlots.value[slotId] || 0

              if (curGen > prvGen) {
                // Generation ongoing — add the new tokens since last poll
                llamaCppSlotGenTotal.value += curGen - prvGen
              } else if (curGen > 0 && curGen < prvGen) {
                // Slot reset AND a new request already has curGen tokens
                llamaCppSlotGenTotal.value += curGen
              }
              llamaCppPrevSlots.value[slotId] = curGen

              // Live prefill throughput tracking from n_prompt_tokens_processed
              const curPrompt = slot.n_prompt_tokens_processed || 0
              const prvPrompt = llamaCppPrevPromptSlots.value[slotId] || 0
              if (curPrompt > prvPrompt && dt && dt > 0) {
                const promptDelta = curPrompt - prvPrompt
                liveSlotPrefillSpeed = Math.max(liveSlotPrefillSpeed, promptDelta / dt)
              }
              llamaCppPrevPromptSlots.value[slotId] = curPrompt
            }
          }
        } catch { /* non-fatal */ }
      }

      const newRaw = {
        promptTokens:
          m['vllm:prompt_tokens_total'] ||
          ((m['llamacpp:prompt_tokens_total'] || 0) + (m['llamacpp:prompt_tokens_cached_total'] || 0)) || 0,

        // llamacpp:tokens_predicted_total is 0 in MTP mode; use our slot-tracked counter
        genTokens:
          m['vllm:generation_tokens_total'] ||
          (isLlamaCpp ? llamaCppSlotGenTotal.value : 0) ||
          m['llamacpp:tokens_predicted_total'] || 0,

        // llama.cpp exposes prefix-cache reused prompt tokens in llamacpp:prompt_tokens_cached_total
        cachedTokens:
          m['vllm:prompt_tokens_cached'] ||
          m['vllm:prefix_cache_hits_total'] ||
          m['vllm:prefix_cache_hits'] ||
          m['llamacpp:prompt_tokens_cached_total'] || 0,

        cacheHits:
          m['vllm:prefix_cache_hits_total'] ||
          m['vllm:prefix_cache_hits'] ||
          m['llamacpp:prompt_tokens_cached_total'] || 0,

        cacheQueries:
          m['vllm:prefix_cache_queries_total'] ||
          m['vllm:prefix_cache_queries'] ||
          ((m['llamacpp:prompt_tokens_total'] || 0) + (m['llamacpp:prompt_tokens_cached_total'] || 0)) || 0,

        externalHits:
          m['vllm:external_prefix_cache_hits_total'] ||
          m['vllm:external_prefix_cache_hits'] || 0,

        externalQueries:
          m['vllm:external_prefix_cache_queries_total'] ||
          m['vllm:external_prefix_cache_queries'] || 0,

        gpuCacheUsage:
          m['vllm:gpu_cache_usage_perc::gpu'] ??
          m['vllm:gpu_cache_usage_perc'] ??
          m['vllm:kv_cache_usage_perc'] ??
          m['vllm:gpu_cache_usage_factor'] ?? 0,

        cpuCacheUsage: (() => {
          if (m['vllm:gpu_cache_usage_perc::cpu'] != null) return m['vllm:gpu_cache_usage_perc::cpu']
          if (m['vllm:cpu_cache_usage_perc'] != null) return m['vllm:cpu_cache_usage_perc']
          const extH = m['vllm:external_prefix_cache_hits_total'] || m['vllm:external_prefix_cache_hits'] || 0
          if (extH > 0) {
            // Exact vLLM engine block allocation ratio: 9.66 GiB for 302,682 tokens (~34,268 bytes/token including hybrid structures)
            const bytesPerToken = (9.66 * (1024 ** 3)) / 302682
            const poolBytes = (cpuCacheOffloadGb.value || 40) * (1024 ** 3)
            const usedBytes = extH * bytesPerToken
            return Math.min(1.0, usedBytes / poolBytes)
          }
          return 0
        })(),

        specAccepted:
          m['vllm:spec_decode_num_accepted_tokens_total'] ||
          m['vllm:spec_decode_num_accepted_tokens'] ||
          m['llamacpp:spec_decode_num_accepted_tokens_total'] || 0,

        specDraft:
          m['vllm:spec_decode_num_draft_tokens_total'] ||
          m['vllm:spec_decode_num_draft_tokens'] ||
          m['llamacpp:spec_decode_num_draft_tokens_total'] || 0,

        specDrafts:
          m['vllm:spec_decode_num_drafts_total'] ||
          m['vllm:spec_decode_num_drafts'] ||
          m['llamacpp:spec_decode_num_drafts_total'] || 0,

        requestsRunning:
          m['vllm:num_requests_running'] ||
          m['llamacpp:requests_processing'] || 0,

        requestsWaiting:
          m['vllm:num_requests_waiting'] ||
          m['llamacpp:requests_deferred'] || 0,

        requestsSuccess:
          m['vllm:request_success_total'] ||
          m['llamacpp:n_decode_total'] || 0,

        promptSeconds:
          m['llamacpp:prompt_seconds_total'] || 0,
      }

      backendType.value = isLlamaCpp ? 'llamacpp' : 'vllm'
      isMtpEnabled.value = (
        ('vllm:spec_decode_num_draft_tokens_total' in m) ||
        ('vllm:spec_decode_num_draft_tokens' in m) ||
        ('llamacpp:spec_decode_num_draft_tokens_total' in m) ||
        Boolean(newRaw.specDraft > 0)
      )

      // Compute delta (only positive — counters should only go up)
      const delta = {
        promptTokens: Math.max(0, newRaw.promptTokens - (prev.value.promptTokens || 0)),
        genTokens:    Math.max(0, newRaw.genTokens    - (prev.value.genTokens    || 0)),
        cachedTokens: Math.max(0, newRaw.cachedTokens - (prev.value.cachedTokens || 0)),
        requests:     Math.max(0, newRaw.requestsSuccess - (prev.value.requestsSuccess || 0)),
        cacheHits:    Math.max(0, newRaw.cacheHits    - (prev.value.cacheHits    || 0)),
        cacheQueries: Math.max(0, newRaw.cacheQueries - (prev.value.cacheQueries || 0)),
        externalHits: Math.max(0, newRaw.externalHits - (prev.value.externalHits || 0)),
        externalQueries: Math.max(0, newRaw.externalQueries - (prev.value.externalQueries || 0)),
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
      if (liveSlotPrefillSpeed > 0) {
        lastPrefillSpeed.value = Math.round(liveSlotPrefillSpeed)
        if (liveSlotPrefillSpeed > peakPrefillSpeed.value) {
          peakPrefillSpeed.value = Math.round(liveSlotPrefillSpeed)
        }
        rates.value.promptTokens = liveSlotPrefillSpeed
      } else if (delta.promptTokens > 0) {
        let speed = 0
        const deltaPromptSec = Math.max(0, (newRaw.promptSeconds || 0) - (prev.value.promptSeconds || 0))
        if (deltaPromptSec > 0) {
          speed = delta.promptTokens / deltaPromptSec
        } else if (dt && dt > 0) {
          speed = delta.promptTokens / dt
        }
        if (speed > 0) {
          lastPrefillSpeed.value = Math.round(speed)
          if (speed > peakPrefillSpeed.value) {
            peakPrefillSpeed.value = Math.round(speed)
          }
          rates.value.promptTokens = speed
        }
      } else {
        // Smooth decay so prefill burst doesn't vanish instantly across single-second polls
        rates.value.promptTokens = Math.max(0, rates.value.promptTokens * 0.65)
      }

      if (delta.genTokens > 0 && dt && dt > 0) {
        rates.value.genTokens = delta.genTokens / dt
      } else {
        rates.value.genTokens = Math.max(0, rates.value.genTokens * 0.65)
      }

      if (delta.cachedTokens > 0 && dt && dt > 0) {
        rates.value.cachedTokens = delta.cachedTokens / dt
      } else {
        rates.value.cachedTokens = 0
      }

      prev.value = { ...newRaw, ts: now }
      raw.value = newRaw
      lastUpdated.value = new Date()
      fetchError.value = null

      // Update GPU cache peak tracking (steady persistent state, no oscillating decay)
      if (newRaw.gpuCacheUsage > gpuCacheUsagePeak.value) {
        gpuCacheUsagePeak.value = newRaw.gpuCacheUsage
      }
      if (newRaw.gpuCacheUsage > (lifetime.value.gpuCachePeak || 0)) {
        lifetime.value.gpuCachePeak = newRaw.gpuCacheUsage
      }

      // Update CPU DRAM cache offload peak tracking (steady persistent state, no oscillating decay)
      if (newRaw.cpuCacheUsage > cpuCacheUsagePeak.value) {
        cpuCacheUsagePeak.value = newRaw.cpuCacheUsage
      }
      if (newRaw.cpuCacheUsage > (lifetime.value.cpuCachePeak || 0)) {
        lifetime.value.cpuCachePeak = newRaw.cpuCacheUsage
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
    await fetchSystemMetrics()
  }

  // ── Firebase Auth & Cloud Actions ──────────────────────────────────────────
  async function loginWithGoogle() {
    authError.value = null
    try {
      const user = await signInWithGoogle()
      authUser.value = user
      return user
    } catch (err) {
      authError.value = err.message
      throw err
    }
  }

  async function logout() {
    try {
      await signOutUser()
    } catch (err) {
      authError.value = err.message
    } finally {
      authUser.value = null
      localStorage.removeItem('vllm_owner_session')
    }
  }

  function updateFirebase(config) {
    firebaseConfig.value = config
    const success = saveFirebaseConfig(config)
    if (config.enabled && success) {
      cloudSyncStatus.value = 'synced'
      subscribeToFirestore((cloudData) => {
        if (cloudData?.lifetime) mergeCloudLifetime(cloudData.lifetime)
      })
      onAuthChange((user) => {
        authUser.value = user
      })
      persist()
    } else {
      cloudSyncStatus.value = 'disabled'
    }
    return success
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  function updateSettings(url, interval, cpuOffloadGb) {
    serverUrl.value = url
    pollIntervalMs.value = interval
    if (cpuOffloadGb !== undefined && cpuOffloadGb !== null) {
      const val = parseFloat(cpuOffloadGb)
      if (!isNaN(val) && val > 0) {
        cpuCacheOffloadGb.value = val
        localStorage.setItem('vllm-cpu-offload-gb', String(val))
      }
    }
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
      gpuCachePeak: 0, cpuCachePeak: 0,
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
    serverStatus, modelName, modelContextLen, modelHasVision, lastUpdated, fetchError,
    systemMetrics,
    raw, rates, lastPrefillSpeed, peakPrefillSpeed, isMtpEnabled, backendType,
    cacheHitRate, lifetimeCacheHitRate,
    mtpAcceptanceRate, lifetimeMtpAcceptanceRate,
    engineStatus,
    history, timeSeries, lifetime,
    gpuCacheUsagePeak, cpuCacheUsagePeak, cpuCacheOffloadGb, cpuCacheFilledGb, cpuCachePeakFilledGb,
    gpuKvCacheCapacityGb, gpuKvCacheTokensCapacity, gpuCacheFilledGb, gpuActiveTokens,
    // Firebase State
    firebaseConfig, cloudSyncStatus, authUser, authError, authLoading, isLocalLan, isAuthLocked,
    // Actions
    poll, fetchSystemMetrics, clearHistory, clearLifetime, updateSettings,
    exportData, importData, loginWithGoogle, loginWithPasskey, logout, updateFirebase,
  }
})
