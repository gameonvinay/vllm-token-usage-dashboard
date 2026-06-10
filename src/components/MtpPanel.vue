<template>
  <div class="mtp-panel">
    <!-- Main acceptance rate display -->
    <div class="glass-card mtp-main-card">
      <div class="mtp-rate-display">
        <div class="mtp-rate-pct">{{ acceptanceDisplay }}</div>
        <div class="hit-rate-label">MTP Acceptance Rate</div>
      </div>
      <div class="sparkline-wrap">
        <SparklineChart
          :data="store.history.mtpAcceptanceRate"
          color="#ec4899"
          :width="280"
          :height="52"
        />
      </div>
      <div class="card-footer">
        <span class="meta-stat">
          <span class="meta-label">Accepted</span>
          <span class="meta-val">{{ fmt(store.raw.specAccepted) }}</span>
        </span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">Draft</span>
          <span class="meta-val">{{ fmt(store.raw.specDraft) }}</span>
        </span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">Cycles</span>
          <span class="meta-val">{{ fmt(store.raw.specDrafts) }}</span>
        </span>
      </div>

      <!-- Lifetime acceptance rate -->
      <div v-if="store.lifetimeMtpAcceptanceRate !== null" class="lifetime-row">
        <span class="lifetime-icon">⟳</span>
        <span class="lifetime-label">Lifetime</span>
        <span class="lifetime-rate">{{ lifetimeAcceptanceDisplay }}</span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">accepted</span>
          <span class="meta-val">{{ fmt(store.lifetime.specAccepted) }}</span>
        </span>
        <span class="meta-sep">·</span>
        <span class="meta-stat">
          <span class="meta-label">draft</span>
          <span class="meta-val">{{ fmt(store.lifetime.specDraft) }}</span>
        </span>
      </div>
    </div>

    <!-- Draft efficiency gauge -->
    <div class="glass-card gauge-card">
      <GaugeRing
        :value="store.mtpAcceptanceRate ?? 0"
        label="Acceptance"
        color="#ec4899"
        :size="85"
        :strokeWidth="8"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import SparklineChart from './SparklineChart.vue'
import GaugeRing from './GaugeRing.vue'

const store = useMetricsStore()

const acceptanceDisplay = computed(() => {
  const r = store.mtpAcceptanceRate
  if (r === null) return '—'
  return (r * 100).toFixed(1) + '%'
})

const lifetimeAcceptanceDisplay = computed(() => {
  const r = store.lifetimeMtpAcceptanceRate
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
.mtp-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mtp-main-card {
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
  flex-wrap: wrap;
  margin-top: 4px;
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

.meta-sep { color: var(--color-text-subtle); }

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
  color: #ec4899;
  font-weight: 700;
}

.gauge-card {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 115px;
  box-sizing: border-box;
}
</style>
