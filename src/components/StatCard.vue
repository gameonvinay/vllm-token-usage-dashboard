<template>
  <div class="glass-card stat-card" :style="{ '--accent': color, '--glow': glow }">
    <div class="stat-card-header">
      <div class="stat-label-wrap">
        <div class="stat-label">{{ label }}</div>
        <span v-if="priceBadge" class="stat-price-badge">{{ priceBadge }}</span>
      </div>
      <div class="stat-icon" :style="{ background: `rgba(${rgbColor}, 0.15)`, color }">
        {{ icon }}
      </div>
    </div>

    <!-- Lifetime value — primary big number -->
    <div class="stat-value" :key="displayLifetime">{{ displayLifetime }}</div>

    <!-- Session value chip (resets on server restart) -->
    <div v-if="sessionValue !== null" class="session-chip">
      <span class="session-label">Session</span>
      <span class="session-val">{{ displaySession }}</span>
    </div>

    <div class="stat-footer">
      <div class="stat-rate" :class="rateClass">
        <span v-if="rate !== null && rate > 0.5">{{ rateStr }}</span>
        <span v-else-if="subRate !== null && subRate > 0" class="sub-rate-text" :title="`Last speed: ${subRate.toLocaleString()} tok/s`">
          {{ subLabel }}: {{ fmtSpeed(subRate) }}
        </span>
        <span v-else style="color: var(--color-text-subtle)">0 /s</span>
      </div>
      <SparklineChart
        v-if="sparkData && sparkData.length > 1"
        :data="sparkData"
        :color="color"
        :width="80"
        :height="32"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SparklineChart from './SparklineChart.vue'

const props = defineProps({
  label:        { type: String,   default: '' },
  lifetime:     { type: Number,   default: 0 },     // persistent across restarts
  sessionValue: { type: Number,   default: null },  // current vLLM session counter
  rate:         { type: Number,   default: null },
  subRate:      { type: Number,   default: null },  // fallback / last active speed
  subLabel:     { type: String,   default: 'Last' },
  sparkData:    { type: Array,    default: null },
  color:        { type: String,   default: '#7c6ff7' },
  glow:         { type: String,   default: 'rgba(124,111,247,0.2)' },
  icon:         { type: String,   default: '📊' },
  isCurrency:   { type: Boolean,  default: false },
  priceBadge:   { type: String,   default: '' },
})

const rgbColor = computed(() => {
  const hex = props.color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `${r},${g},${b}`
})

function fmtNum(n) {
  if (props.isCurrency) {
    if (!n || n === 0) return '$0.00'
    if (n < 0.01) return '$' + n.toFixed(4)
    if (n < 100) return '$' + n.toFixed(2)
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
    return '$' + n.toFixed(2)
  }
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function fmtSpeed(s) {
  if (!s || s <= 0) return '0 /s'
  if (s >= 1000) return `${(s / 1000).toFixed(1)}K /s`
  return `${s.toFixed(0)} /s`
}

const displayLifetime = computed(() => fmtNum(props.lifetime || 0))
const displaySession  = computed(() => fmtNum(props.sessionValue || 0))

const rateStr = computed(() => {
  const r = props.rate
  if (r === null || r <= 0.5) return null
  if (r >= 1000) return `+${(r / 1000).toFixed(1)}K /s`
  return `+${r.toFixed(1)} /s`
})

const rateClass = computed(() => (props.rate !== null && props.rate > 0.5) ? 'positive' : '')
</script>

<style scoped>
.stat-card {
  border-color: rgba(255,255,255,0.07);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.stat-card:hover {
  border-color: rgba(255,255,255,0.13);
  box-shadow: 0 0 24px var(--glow, rgba(124,111,247,0.12));
}

.stat-label-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-price-badge {
  font-size: 0.62rem;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.28);
  padding: 1px 6px;
  border-radius: 6px;
  letter-spacing: 0.02em;
}

/* Session chip */
.session-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 2px 9px;
  margin-top: -4px;
  width: fit-content;
}

.session-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-subtle, #484f58);
  font-weight: 600;
}

.session-val {
  font-size: 0.72rem;
  font-family: var(--font-mono, monospace);
  color: var(--color-text-muted, #7d8590);
  font-weight: 500;
}

.sub-rate-text {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--color-text-muted);
  font-weight: 500;
  opacity: 0.85;
}
</style>
