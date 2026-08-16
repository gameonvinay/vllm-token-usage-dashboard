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

          <!-- Export / Import -->
          <div class="form-group">
            <label class="form-label">Data Backup &amp; Restore</label>
            <div class="data-actions">
              <!-- Export -->
              <button class="data-btn export-btn" @click="handleExport" id="export-data-btn">
                <span>⬇️</span>
                <span>Export Data</span>
              </button>

              <!-- Import -->
              <label class="data-btn import-btn" for="import-file-input" id="import-data-label">
                <span>⬆️</span>
                <span>{{ importStatus || 'Import Data' }}</span>
              </label>
              <input
                id="import-file-input"
                type="file"
                accept=".json"
                style="display:none"
                @change="handleImport"
              />
            </div>
            <p class="form-hint">
              Export downloads all your time-series data as JSON. Import merges it with existing data —
              safe to use across machines on the same LAN.
            </p>
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
import { ref } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

const store = useMetricsStore()
const emit  = defineEmits(['close', 'saved'])

const localUrl          = ref(store.serverUrl)
const localInterval     = ref(store.pollIntervalMs)
const localCpuOffloadGb = ref(store.cpuCacheOffloadGb)
const importStatus      = ref('')

function handleSave() {
  store.updateSettings(localUrl.value, localInterval.value, localCpuOffloadGb.value)
  emit('saved')
  emit('close')
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
