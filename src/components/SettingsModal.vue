<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
          <h2 class="modal-title" id="settings-title">⚙️ Settings</h2>
          <button class="btn-icon" @click="$emit('close')" aria-label="Close settings">✕</button>
        </div>

        <div class="modal-body">
          <!-- Server URL -->
          <div class="form-group">
            <label class="form-label" for="server-url-input">vLLM Server URL</label>
            <input
              id="server-url-input"
              class="form-input"
              v-model="localUrl"
              type="url"
              placeholder="http://localhost:8000"
              spellcheck="false"
            />
            <p class="form-hint">
              For cross-machine access on LAN, start vLLM with
              <code style="color: var(--color-indigo); font-size: 0.7rem">--allowed-origins "*"</code>
              to enable CORS.
            </p>
          </div>

          <!-- Poll interval -->
          <div class="form-group">
            <label class="form-label" for="poll-slider">Poll Interval</label>
            <div class="slider-row">
              <input
                id="poll-slider"
                class="slider"
                type="range"
                min="1000"
                max="30000"
                step="1000"
                v-model.number="localInterval"
              />
              <span class="slider-value">{{ (localInterval / 1000).toFixed(0) }}s</span>
            </div>
          </div>

          <!-- CPU DRAM KV Cache Offload Allocation -->
          <div class="form-group">
            <label class="form-label" for="cpu-offload-input">CPU DRAM KV Cache Offload Pool (GB)</label>
            <div class="slider-row">
              <input
                id="cpu-offload-input"
                class="slider"
                type="range"
                min="8"
                max="128"
                step="4"
                v-model.number="localCpuOffloadGb"
              />
              <span class="slider-value">{{ localCpuOffloadGb }} GB</span>
            </div>
            <p class="form-hint">
              Allocated DRAM pool for CPU KV cache swap &amp; offloading (e.g. <code>--cpu-offload-gb 40</code> or <code>--swap-space 40</code>).
            </p>
          </div>

          <div class="separator" />

          <!-- Firebase Cloud Sync & Authentication -->
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
              <label class="form-label" style="margin-bottom:0">🔥 Firebase Cloud Sync &amp; Auth</label>
              <span v-if="store.cloudSyncStatus === 'synced'" class="badge-synced">☁️ Cloud Active</span>
              <span v-else class="badge-disabled">💾 Local Only</span>
            </div>
            
            <p class="form-hint" style="margin-bottom:12px">
              Sync token metrics &amp; lifetime counters in real-time across your phone, laptop, and desktop via Cloud Firestore.
            </p>

            <div class="fb-toggles" style="display:flex; gap:16px; margin-bottom:12px; flex-wrap:wrap">
              <label class="toggle-label">
                <input type="checkbox" v-model="localFb.enabled" />
                <span>Enable Firestore Cloud Sync</span>
              </label>
              <label class="toggle-label">
                <input type="checkbox" v-model="localFb.authEnabled" />
                <span>Enable Google Sign-In</span>
              </label>
            </div>

            <div v-if="localFb.enabled || localFb.authEnabled" class="fb-config-grid">
              <div class="fb-field">
                <label class="fb-label">API Key</label>
                <input class="form-input fb-input" v-model="localFb.apiKey" placeholder="AIzaSy..." type="password" />
              </div>
              <div class="fb-field">
                <label class="fb-label">Project ID</label>
                <input class="form-input fb-input" v-model="localFb.projectId" placeholder="vllm-telemetry" />
              </div>
              <div class="fb-field">
                <label class="fb-label">Auth Domain</label>
                <input class="form-input fb-input" v-model="localFb.authDomain" placeholder="vllm-telemetry.firebaseapp.com" />
              </div>
              <div class="fb-field">
                <label class="fb-label">App ID</label>
                <input class="form-input fb-input" v-model="localFb.appId" placeholder="1:12345:web:abcde" />
              </div>
            </div>

            <div v-if="localFb.enabled || localFb.authEnabled" style="margin-top:10px; display:flex; gap:10px; align-items:center">
              <button class="btn-ghost" style="font-size:0.75rem; padding:5px 12px" @click="handlePasteConfig">
                📋 Paste Config Object
              </button>
              <span v-if="fbStatusMsg" style="font-size:0.75rem; color:#00d4aa">{{ fbStatusMsg }}</span>
            </div>
          </div>

          <div class="separator" />

          <!-- Danger zone -->
          <div class="form-group">
            <label class="form-label">Danger Zone</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
              <button
                class="btn-ghost"
                style="color: #f59e0b; border-color: rgba(245,158,11,0.3)"
                @click="handleClearLifetime"
                id="clear-lifetime-btn"
              >
                ⟳ Reset Lifetime Accumulators
              </button>
              <button
                class="btn-ghost"
                style="color: #ef4444; border-color: rgba(239,68,68,0.3)"
                @click="handleClearHistory"
                id="clear-history-btn"
              >
                🗑 Clear All History &amp; Charts
              </button>
            </div>
            <p class="form-hint">
              <strong style="color:#f59e0b">Reset Lifetime</strong> zeroes the persistent token/request totals but keeps chart history.<br/>
              <strong style="color:#ef4444">Clear History</strong> removes all sparklines and time-series chart data.
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="$emit('close')">Cancel</button>
          <button class="btn-primary" @click="handleSave" id="save-settings-btn">Save Changes</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

const store = useMetricsStore()
const emit  = defineEmits(['close', 'saved'])

const localUrl          = ref(store.serverUrl)
const localInterval     = ref(store.pollIntervalMs)
const localCpuOffloadGb = ref(store.cpuCacheOffloadGb)
const importStatus      = ref('')
const fbStatusMsg       = ref('')

const localFb = reactive({
  apiKey: store.firebaseConfig.apiKey || '',
  authDomain: store.firebaseConfig.authDomain || '',
  projectId: store.firebaseConfig.projectId || '',
  storageBucket: store.firebaseConfig.storageBucket || '',
  messagingSenderId: store.firebaseConfig.messagingSenderId || '',
  appId: store.firebaseConfig.appId || '',
  enabled: store.firebaseConfig.enabled || false,
  authEnabled: store.firebaseConfig.authEnabled || false,
})

function handleSave() {
  store.updateSettings(localUrl.value, localInterval.value, localCpuOffloadGb.value)
  store.updateFirebase({ ...localFb })
  emit('saved')
  emit('close')
}

async function handlePasteConfig() {
  try {
    const text = await navigator.clipboard.readText()
    // Parse JSON or JS object format: apiKey: "...", projectId: "..."
    const extract = (key) => {
      const match = text.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`))
      return match ? match[1] : null
    }

    const apiKey = extract('apiKey')
    const authDomain = extract('authDomain')
    const projectId = extract('projectId')
    const appId = extract('appId')
    const storageBucket = extract('storageBucket')
    const messagingSenderId = extract('messagingSenderId')

    if (apiKey) localFb.apiKey = apiKey
    if (authDomain) localFb.authDomain = authDomain
    if (projectId) localFb.projectId = projectId
    if (appId) localFb.appId = appId
    if (storageBucket) localFb.storageBucket = storageBucket
    if (messagingSenderId) localFb.messagingSenderId = messagingSenderId

    localFb.enabled = true
    fbStatusMsg.value = '✓ Config parsed successfully'
    setTimeout(() => { fbStatusMsg.value = '' }, 3000)
  } catch (err) {
    fbStatusMsg.value = '⚠ Clipboard access denied. Paste manually into fields.'
    setTimeout(() => { fbStatusMsg.value = '' }, 3000)
  }
}

function handleExport() {
  store.exportData()
}

async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return
  importStatus.value = 'Importing…'
  try {
    const result = await store.importData(file)
    importStatus.value = `✓ Imported (${result.exportedAt?.slice(0, 10) || 'unknown date'})`
    setTimeout(() => { importStatus.value = '' }, 4000)
  } catch (err) {
    importStatus.value = '⚠ Import failed'
    setTimeout(() => { importStatus.value = '' }, 3000)
  }
  e.target.value = ''
}

function handleClearHistory() {
  if (confirm('Clear all history and reset counters? This cannot be undone.')) {
    store.clearHistory()
  }
}

function handleClearLifetime() {
  if (confirm('Reset all lifetime accumulator totals to 0? Chart history is kept.')) {
    store.clearLifetime()
  }
}
</script>

<style scoped>
.badge-synced {
  background: rgba(0, 212, 170, 0.15);
  border: 1px solid rgba(0, 212, 170, 0.35);
  color: #00d4aa;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.badge-disabled {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--color-text-dim, #94a3b8);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--color-text, #f8fafc);
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  accent-color: #00d4aa;
  width: 15px;
  height: 15px;
}

.fb-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.fb-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fb-label {
  font-size: 0.72rem;
  color: var(--color-text-dim, #94a3b8);
  font-weight: 500;
}

.fb-input {
  padding: 6px 10px;
  font-size: 0.78rem;
}

.data-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.data-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 9px;
  font-family: var(--font-sans, sans-serif);
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
}

.export-btn {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.3);
  color: #00d4aa;
}
.export-btn:hover {
  background: rgba(0, 212, 170, 0.18);
  border-color: rgba(0, 212, 170, 0.5);
}

.import-btn {
  background: rgba(124, 111, 247, 0.1);
  border-color: rgba(124, 111, 247, 0.3);
  color: #a59df9;
  user-select: none;
}
.import-btn:hover {
  background: rgba(124, 111, 247, 0.18);
  border-color: rgba(124, 111, 247, 0.5);
  cursor: pointer;
}
</style>
