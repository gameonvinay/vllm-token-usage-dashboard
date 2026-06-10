<template>
  <div class="engine-grid">
    <!-- Running / Waiting bar card -->
    <div class="glass-card engine-main-card">
      <div class="engine-header">
        <div>
          <div class="stat-label">Active Requests</div>
          <div class="engine-counts">
            <span class="count-running">{{ store.raw.requestsRunning }}</span>
            <span class="count-sep">running</span>
            <span class="count-waiting" :class="{ warn: store.raw.requestsWaiting > 0 }">
              {{ store.raw.requestsWaiting }}
            </span>
            <span class="count-sep">waiting</span>
          </div>
        </div>
        <div class="engine-status-chip" :class="store.engineStatus">
          <span class="chip-dot" />
          {{ statusLabel }}
        </div>
      </div>

      <!-- Stacked bars -->
      <div class="bars-wrap">
        <div class="bar-row">
          <span class="bar-label">Running</span>
          <div class="engine-bar-wrap" style="flex:1">
            <div
              class="engine-bar-fill"
              :style="{
                width: runningPct + '%',
                background: 'linear-gradient(90deg, #7c6ff7, #5b52d0)',
              }"
            />
          </div>
          <span class="bar-val">{{ store.raw.requestsRunning }}</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">Waiting</span>
          <div class="engine-bar-wrap" style="flex:1">
            <div
              class="engine-bar-fill"
              :style="{
                width: waitingPct + '%',
                background: store.raw.requestsWaiting > 0
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : 'rgba(255,255,255,0.1)',
              }"
            />
          </div>
          <span class="bar-val" :style="{ color: store.raw.requestsWaiting > 0 ? '#ef4444' : 'inherit' }">
            {{ store.raw.requestsWaiting }}
          </span>
        </div>
      </div>

      <!-- Sparkline -->
      <div class="sparkline-wrap">
        <SparklineChart
          :data="store.history.requestsRunning"
          color="#7c6ff7"
          :width="340"
          :height="40"
        />
      </div>
    </div>

    <!-- Total success card -->
    <div class="glass-card success-card">
      <div class="stat-label">Total Successful</div>
      <div class="success-value">{{ formatLarge(store.raw.requestsSuccess) }}</div>
      <div class="success-sub">requests</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import SparklineChart from './SparklineChart.vue'

const store = useMetricsStore()

const total = computed(() => store.raw.requestsRunning + store.raw.requestsWaiting)
const runningPct = computed(() => total.value > 0 ? (store.raw.requestsRunning / total.value) * 100 : 0)
const waitingPct = computed(() => total.value > 0 ? (store.raw.requestsWaiting / total.value) * 100 : 0)

const statusLabel = computed(() => ({
  idle: 'Idle',
  busy: 'Busy',
  saturated: 'Saturated',
}[store.engineStatus]))

function formatLarge(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}
</script>

<style scoped>
.engine-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.engine-main-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.engine-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.engine-counts {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 2px;
}

.count-running {
  font-size: 1.3rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: #7c6ff7;
}

.count-waiting {
  font-size: 1.3rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: var(--color-text-muted);
  transition: color 0.3s ease;
}

.count-waiting.warn { color: #ef4444; }

.count-sep {
  font-size: 0.72rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 8px;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.bars-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  width: 54px;
  flex-shrink: 0;
}

.bar-val {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  width: 32px;
  text-align: right;
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.sparkline-wrap {
  margin: 0 -4px;
}

.success-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  height: 115px;
  box-sizing: border-box;
}

.success-value {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  letter-spacing: -0.03em;
  color: #10b981;
}

.success-sub {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}
</style>
