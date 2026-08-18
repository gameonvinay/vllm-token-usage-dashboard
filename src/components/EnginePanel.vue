<template>
  <div class="glass-card engine-card">
    <div class="engine-card-header">
      <div class="title-group">
        <div class="section-dot" style="background: #10b981" />
        <span class="card-title">Engine Health</span>
      </div>
      <div class="engine-status-chip" :class="store.engineStatus">
        <span class="chip-dot" />
        {{ statusLabel }}
      </div>
    </div>

    <div class="engine-counts-hero">
      <div class="counts-group">
        <span class="count-running">{{ store.raw.requestsRunning }}</span>
        <span class="count-lbl">running</span>
      </div>
      <span class="count-sep-dot">·</span>
      <div class="counts-group">
        <span class="count-waiting" :class="{ warn: store.raw.requestsWaiting > 0 }">
          {{ store.raw.requestsWaiting }}
        </span>
        <span class="count-lbl">waiting</span>
      </div>
    </div>

    <!-- Stacked bars -->
    <div class="bars-wrap">
      <div class="bar-row">
        <span class="bar-label">Running</span>
        <div class="engine-bar-wrap">
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
        <div class="engine-bar-wrap">
          <div
            class="engine-bar-fill"
            :style="{
              width: waitingPct + '%',
              background: store.raw.requestsWaiting > 0
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'rgba(255,255,255,0.08)',
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
        color="#10b981"
        :width="260"
        :height="30"
      />
    </div>

    <!-- Footer with total successful -->
    <div class="engine-footer">
      <span class="meta-stat">
        <span class="meta-label">Successful</span>
        <span class="meta-val accent-green">{{ formatLarge(store.raw.requestsSuccess) }}</span>
        <span class="unit-sub">reqs</span>
      </span>
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
}[store.engineStatus] || 'Active'))

function formatLarge(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return (n || 0).toLocaleString()
}
</script>

<style scoped>
.engine-card {
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  height: 100%;
  box-sizing: border-box;
}

.engine-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.engine-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.engine-status-chip.idle {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.engine-status-chip.busy {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.engine-status-chip.saturated {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.engine-counts-hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 1px;
}

.counts-group {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.count-running {
  font-size: 1.4rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: #7c6ff7;
  line-height: 1;
}

.count-waiting {
  font-size: 1.4rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: var(--color-text-muted);
  line-height: 1;
  transition: color 0.3s ease;
}

.count-waiting.warn {
  color: #ef4444;
}

.count-lbl {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.count-sep-dot {
  color: var(--color-text-subtle);
  font-size: 0.8rem;
}

.bars-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-label {
  font-size: 0.62rem;
  color: var(--color-text-muted);
  width: 44px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.engine-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.engine-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.bar-val {
  font-size: 0.68rem;
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--color-text-muted);
  width: 14px;
  text-align: right;
  flex-shrink: 0;
}

.sparkline-wrap {
  margin: 1px -4px;
}

.engine-footer {
  display: flex;
  align-items: center;
  padding-top: 5px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.meta-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.meta-val {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--color-text);
  font-weight: 600;
}

.accent-green {
  color: #10b981;
}

.unit-sub {
  font-size: 0.62rem;
  color: var(--color-text-muted);
  font-weight: 500;
}
</style>
