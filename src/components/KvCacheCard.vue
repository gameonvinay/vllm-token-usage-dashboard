<template>
  <div class="glass-card kv-card kv-card-featured">
    <div class="kv-card-header">
      <div class="kv-title-group">
        <div class="section-dot" style="background: #7c6ff7" />
        <span class="kv-card-title">KV Cache Allocation</span>
        <span class="kv-badge-highlight">Dual Engine</span>
      </div>
      <div class="kv-pills-group">
        <span class="kv-vram-pill" :title="`GPU KV Cache Capacity: ${store.gpuKvCacheCapacityGb} GB (${fmt(store.gpuKvCacheTokensCapacity || 302682)} tokens)`">
          ⚡ {{ store.gpuKvCacheCapacityGb }}GB GPU
        </span>
        <span class="kv-offload-pill" :title="`CPU DRAM Offload capacity: ${store.cpuCacheOffloadGb} GB`">
          🖥️ {{ store.cpuCacheOffloadGb }}GB CPU
        </span>
      </div>
    </div>

    <div class="kv-gauges-grid">
      <!-- GPU KV Cache -->
      <div class="kv-gauge-column">
        <GaugeRing
          :value="store.raw.gpuCacheUsage"
          label="GPU VRAM"
          color="#7c6ff7"
          :size="82"
          :strokeWidth="7.5"
        />
        <div class="kv-stats-box">
          <div class="stat-mini-row">
            <span class="stat-mini-lbl">Capacity</span>
            <span class="stat-mini-val accent-gpu">
              {{ store.gpuKvCacheCapacityGb }} <span class="unit-sub">GB ({{ fmt(store.gpuKvCacheTokensCapacity || 302682) }} tok)</span>
            </span>
          </div>
          <div class="stat-mini-row">
            <span class="stat-mini-lbl">Active Context</span>
            <span class="stat-mini-val">
              {{ store.gpuCacheFilledGb }} <span class="unit-sub">GB ({{ fmt(store.gpuActiveTokens || 0) }} tok)</span>
            </span>
          </div>
        </div>
      </div>

      <div class="kv-gauge-divider" />

      <!-- CPU DRAM KV Cache Offload -->
      <div class="kv-gauge-column">
        <GaugeRing
          :value="store.raw.cpuCacheUsage"
          label="CPU DRAM"
          color="#00d4aa"
          :size="82"
          :strokeWidth="7.5"
        />
        <div class="kv-stats-box">
          <div class="stat-mini-row">
            <span class="stat-mini-lbl">Filled</span>
            <span class="stat-mini-val accent-cpu">
              {{ store.cpuCacheFilledGb }} <span class="unit-sub">/ {{ store.cpuCacheOffloadGb }} GB</span>
            </span>
          </div>
          <div class="stat-mini-row">
            <span class="stat-mini-lbl">Offload Hits</span>
            <span class="stat-mini-val accent-cpu" :title="`${(store.raw.externalHits || 0).toLocaleString()} tokens loaded from CPU RAM`">
              {{ fmt(store.raw.externalHits || 0) }} <span class="unit-sub">tok</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- CPU Offload Fill Progress & Status Bar -->
    <div class="cpu-dram-status-bar">
      <div class="dram-bar-labels">
        <span class="dram-status-tag">
          <span class="live-dot" :class="{ active: (store.raw.cpuCacheUsage > 0.001 || store.raw.externalQueries > 0) }" />
          {{ (store.raw.cpuCacheUsage > 0.001 || store.raw.externalQueries > 0) ? 'CPU Offload Active' : 'CPU Offload Standby' }}
        </span>
        <span class="dram-fill-text">
          <strong>{{ (store.cpuCacheOffloadGb - store.cpuCacheFilledGb).toFixed(1) }} GB</strong> free in RAM pool
        </span>
      </div>
      <div class="dram-progress-track">
        <div
          class="dram-progress-fill"
          :style="{ width: `${Math.min(100, Math.max(0, store.raw.cpuCacheUsage * 100))}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMetricsStore } from '@/stores/metrics'
import GaugeRing from './GaugeRing.vue'

const store = useMetricsStore()

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}
</script>

<style scoped>
.kv-card {
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}

.kv-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.kv-title-group {
  display: flex;
  align-items: center;
  gap: 7px;
}

.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.kv-card-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text);
  font-weight: 700;
}

.kv-badge-highlight {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7c6ff7;
  background: rgba(124, 111, 247, 0.12);
  border: 1px solid rgba(124, 111, 247, 0.25);
  border-radius: 8px;
  padding: 1px 5px;
}

.kv-pills-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kv-vram-pill {
  font-size: 0.68rem;
  font-weight: 700;
  color: #a59df9;
  background: rgba(124, 111, 247, 0.1);
  border: 1px solid rgba(124, 111, 247, 0.25);
  border-radius: 10px;
  padding: 2px 7px;
  white-space: nowrap;
}

.kv-offload-pill {
  font-size: 0.68rem;
  font-weight: 700;
  color: #00d4aa;
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.25);
  border-radius: 10px;
  padding: 2px 7px;
  white-space: nowrap;
}

.kv-gauges-grid {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 12px;
  padding: 4px 6px;
}

.kv-gauge-column {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.kv-gauge-divider {
  width: 1px;
  height: 52px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 4px;
}

.kv-stats-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 80px;
}

.stat-mini-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-mini-lbl {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.stat-mini-val {
  font-size: 0.88rem;
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.unit-sub {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.accent-gpu {
  color: #a59df9;
}

.accent-cpu {
  color: #00d4aa;
}

/* CPU DRAM Status Progress Bar */
.cpu-dram-status-bar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.dram-bar-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.68rem;
}

.dram-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-subtle);
  transition: all 0.3s ease;
}

.live-dot.active {
  background: #00d4aa;
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.9);
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.dram-fill-text {
  font-size: 0.68rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono, monospace);
}

.dram-fill-text strong {
  color: #00d4aa;
  font-weight: 700;
}

.dram-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 2px;
  overflow: hidden;
}

.dram-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d4aa, #00b4d8);
  border-radius: 2px;
  transition: width 0.5s ease;
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.4);
}

@media (max-width: 520px) {
  .kv-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .kv-pills-group {
    width: 100%;
    justify-content: flex-start;
  }
  .kv-gauges-grid {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .kv-gauge-divider {
    width: 100%;
    height: 1px;
    margin: 2px 0;
  }
  .kv-gauge-column {
    justify-content: space-around;
  }
}
</style>
