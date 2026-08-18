<template>
  <div class="cache-panel">
    <!-- Hit Rate Big Card -->
    <div class="glass-card hit-rate-card">
      <div class="hit-rate-display">
        <div class="hit-rate-pct">{{ hitRateDisplay }}</div>
        <div class="hit-rate-label">Prefix Cache Hit Rate</div>
      </div>
      <div class="sparkline-wrap">
        <SparklineChart
          :data="store.history.cacheHitRate"
          color="#f59e0b"
          :width="280"
          :height="48"
        />
      </div>
      <div class="card-footer">
        <span class="meta-stat">
          <span class="meta-label">Hits</span>
          <span class="meta-val">{{ fmt(store.raw.cacheHits) }}</span>
        </span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">Queries</span>
          <span class="meta-val">{{ fmt(store.raw.cacheQueries) }}</span>
        </span>
      </div>
      <!-- Lifetime hit rate -->
      <div v-if="store.lifetimeCacheHitRate !== null" class="lifetime-row">
        <span class="lifetime-icon">⟳</span>
        <span class="lifetime-label">Lifetime</span>
        <span class="lifetime-rate">{{ lifetimeHitRateDisplay }}</span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">hits</span>
          <span class="meta-val">{{ fmt(store.lifetime.cacheHits) }}</span>
        </span>
      </div>
    </div>

    <!-- Dual KV Cache Card: GPU VRAM + CPU DRAM Offload -->
    <div class="glass-card kv-cache-card">
      <div class="kv-card-header">
        <div class="kv-title-group">
          <span class="kv-card-title">KV Cache Allocation</span>
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
            :value="store.gpuCacheUsagePeak"
            label="GPU VRAM"
            color="#7c6ff7"
            :size="78"
            :strokeWidth="7"
          />
          <div class="kv-stats-box">
            <div class="stat-mini-row">
              <span class="stat-mini-lbl">Capacity</span>
              <span class="stat-mini-val accent-gpu">
                {{ store.gpuKvCacheCapacityGb }} <span class="unit-sub">GB ({{ fmt(store.gpuKvCacheTokensCapacity || 302682) }} tok)</span>
              </span>
            </div>
            <div class="stat-mini-row">
              <span class="stat-mini-lbl">Active</span>
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
            :value="store.cpuCacheUsagePeak"
            label="CPU DRAM"
            color="#00d4aa"
            :size="78"
            :strokeWidth="7"
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
            <strong>{{ (store.cpuCacheOffloadGb - store.cpuCacheFilledGb).toFixed(1) }} GB</strong> free
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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import SparklineChart from './SparklineChart.vue'
import GaugeRing from './GaugeRing.vue'

const store = useMetricsStore()

const hitRateDisplay = computed(() => {
  const r = store.cacheHitRate
  if (r === null) return '—'
  return (r * 100).toFixed(1) + '%'
})

const lifetimeHitRateDisplay = computed(() => {
  const r = store.lifetimeCacheHitRate
  if (r === null) return '—'
  return (r * 100).toFixed(1) + '%'
})

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}
</script>

<style scoped>
.cache-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hit-rate-card {
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sparkline-wrap {
  margin: 4px -4px 2px;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.lifetime-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.lifetime-icon {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.lifetime-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.lifetime-rate {
  font-size: 0.82rem;
  font-family: var(--font-mono, monospace);
  color: #f59e0b;
  font-weight: 700;
}

.meta-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.meta-label {
  font-size: 0.7rem;
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

.meta-sep {
  color: var(--color-text-subtle);
}

/* Dual KV Cache Card */
.kv-cache-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kv-card-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.kv-pills-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kv-vram-pill {
  font-size: 0.68rem;
  font-weight: 600;
  color: #a59df9;
  background: rgba(124, 111, 247, 0.1);
  border: 1px solid rgba(124, 111, 247, 0.25);
  border-radius: 12px;
  padding: 2px 7px;
}

.kv-offload-pill {
  font-size: 0.68rem;
  font-weight: 600;
  color: #00d4aa;
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.25);
  border-radius: 12px;
  padding: 2px 7px;
}

.kv-gauges-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kv-gauge-column {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.kv-gauge-divider {
  width: 1px;
  height: 48px;
  background: rgba(255, 255, 255, 0.07);
}

.kv-stats-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 75px;
}

.stat-mini-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-mini-lbl {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.stat-mini-val {
  font-size: 0.85rem;
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
  gap: 5px;
  color: var(--color-text-muted);
  font-weight: 500;
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
  box-shadow: 0 0 6px rgba(0, 212, 170, 0.8);
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.dram-fill-text {
  font-family: var(--font-mono, monospace);
  color: var(--color-text-subtle);
}

.dram-fill-text strong {
  color: var(--color-text);
}

.dram-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 4px;
  overflow: hidden;
}

.dram-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d4aa, #38bdf8);
  border-radius: 4px;
  transition: width 0.5s ease;
}
</style>
