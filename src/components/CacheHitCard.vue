<template>
  <div class="glass-card hit-rate-card">
    <div class="card-header-mini">
      <div class="title-group">
        <div class="section-dot" style="background: #f59e0b" />
        <span class="card-title">Cache Performance</span>
      </div>
      <span class="type-pill">Prefix Cache</span>
    </div>

    <div class="hit-rate-hero">
      <div class="hit-rate-pct">{{ hitRateDisplay }}</div>
      <div class="hit-rate-sub">Hit Rate</div>
    </div>

    <div class="sparkline-wrap">
      <SparklineChart
        :data="store.history.cacheHitRate"
        color="#f59e0b"
        :width="260"
        :height="36"
      />
    </div>

    <div class="card-footer">
      <span class="meta-stat">
        <span class="meta-label">Hits</span>
        <span class="meta-val accent-amber">{{ fmt(store.raw.cacheHits) }}</span>
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
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import SparklineChart from './SparklineChart.vue'

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
.hit-rate-card {
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  height: 100%;
  box-sizing: border-box;
}

.card-header-mini {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.type-pill {
  font-size: 0.65rem;
  font-weight: 700;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 10px;
  padding: 1px 6px;
}

.hit-rate-hero {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
}

.hit-rate-pct {
  font-size: 1.55rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: #f59e0b;
  line-height: 1;
}

.hit-rate-sub {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.sparkline-wrap {
  margin: 2px -4px;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lifetime-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-top: 5px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.lifetime-icon {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
}

.lifetime-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.lifetime-rate {
  font-size: 0.78rem;
  font-family: var(--font-mono, monospace);
  color: #f59e0b;
  font-weight: 700;
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

.accent-amber {
  color: #f59e0b;
}

.meta-sep {
  color: var(--color-text-subtle);
}
</style>
