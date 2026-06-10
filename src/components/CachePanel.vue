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
          :height="52"
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

    <!-- GPU KV Cache Gauge -->
    <div class="glass-card gauge-card">
      <div class="gauge-card-inner">
        <GaugeRing
          :value="store.gpuCacheUsagePeak"
          label="GPU KV Cache"
          color="#7c6ff7"
          :size="95"
          :strokeWidth="8"
        />
        <div class="gauge-stats">
          <div class="gauge-stat-row">
            <span class="stat-label">Current</span>
            <span class="stat-val">{{ (store.raw.gpuCacheUsage * 100).toFixed(0) }}%</span>
          </div>
          <div class="gauge-stat-row peak">
            <span class="stat-label">Lifetime Peak</span>
            <span class="stat-val">{{ (store.lifetime.gpuCachePeak * 100).toFixed(0) }}%</span>
          </div>
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

.gauge-card {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  height: 115px;
  box-sizing: border-box;
}

.gauge-card-inner {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  width: 100%;
}

.gauge-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 90px;
}

.gauge-stat-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gauge-stat-row .stat-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.gauge-stat-row .stat-val {
  font-size: 0.95rem;
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--color-text-muted);
}

.gauge-stat-row.peak .stat-val {
  color: #7c6ff7;
}
</style>
