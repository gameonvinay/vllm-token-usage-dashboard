<template>
  <div class="time-analytics">
    <!-- Metric selector + dimension tabs in one row -->
    <div class="analytics-controls">
      <div class="tab-group" role="tablist" aria-label="Time dimension">
        <button
          v-for="dim in dimensions"
          :key="dim.key"
          class="tab-btn"
          :class="{ active: activeDim === dim.key }"
          :id="`tab-${dim.key}`"
          role="tab"
          :aria-selected="activeDim === dim.key"
          @click="activeDim = dim.key"
        >{{ dim.label }}</button>
      </div>

      <div class="metric-selector">
        <button
          v-for="m in metrics"
          :key="m.key"
          class="metric-pill"
          :class="{ active: activeMetric === m.key }"
          :style="activeMetric === m.key ? { background: `rgba(${m.rgb}, 0.15)`, color: m.color, borderColor: `rgba(${m.rgb}, 0.4)` } : {}"
          @click="activeMetric = m.key"
        >{{ m.label }}</button>
      </div>
    </div>

    <!-- Chart card -->
    <div class="glass-card chart-card">
      <div v-if="hasData" class="chart-wrap">
        <BarChart
          :data="chartData"
          :color="activeMetricDef.color"
          :width="chartWidth"
          :height="270"
          :isPercent="activeMetricDef.isRate"
        />
      </div>
      <div class="no-data" v-else>
        <div class="no-data-icon">📊</div>
        <div>No data yet for <strong>{{ activeDimDef.label }}</strong></div>
        <div style="font-size:0.72rem; margin-top:4px; color: var(--color-text-subtle)">Data accumulates as you use vLLM</div>
      </div>

      <!-- Summary row -->
      <div v-if="hasData" class="summary-row">
        <div class="summary-item" v-for="s in summaryStats" :key="s.label">
          <span class="summary-label">{{ s.label }}</span>
          <span class="summary-val" :style="{ color: activeMetricDef.color }">{{ s.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import BarChart from './BarChart.vue'

const store = useMetricsStore()

// ─── Dimension definitions ───────────────────────────────────────────────────
const dimensions = [
  { key: 'byYear',    label: 'Year',    dimKey: 'byYear'    },
  { key: 'byMonth',   label: 'Month',   dimKey: 'byMonth'   },
  { key: 'byWeek',    label: 'Week',    dimKey: 'byWeek'    },
  { key: 'byWeekday', label: 'Day',     dimKey: 'byWeekday' },
  { key: 'byHour',    label: 'Hour',    dimKey: 'byHour'    },
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatMonth(key) {
  // key is "2026-06" → "Jun 2026"
  const [yr, mo] = key.split('-')
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${yr}`
}

function formatWeekPeriod(key) {
  const match = key.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return key
  const y = parseInt(match[1], 10)
  const w = parseInt(match[2], 10)

  const simple = new Date(y, 0, 4)
  const dayOfWeek = simple.getDay()
  const ISOday = dayOfWeek === 0 ? 7 : dayOfWeek
  const firstMonday = new Date(simple.getTime() - (ISOday - 1) * 24 * 60 * 60 * 1000)
  const monday = new Date(firstMonday.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000)
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)

  const monStr = `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} Mon`
  const sunStr = `${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} Sun`

  return `${monStr} - ${sunStr}`
}

function formatHour(h) {
  // 0 → "12am", 12 → "12pm", 13 → "1pm"
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

// ─── Metric definitions ───────────────────────────────────────────────────────
// field: null means it's a derived metric computed from multiple bucket fields
const metrics = [
  { key: 'promptTokens',  label: 'Prompt Tokens',      color: '#7c6ff7', rgb: '124,111,247', field: 'promptTokens',  isRate: false },
  { key: 'genTokens',     label: 'Gen Tokens',          color: '#00d4aa', rgb: '0,212,170',   field: 'genTokens',     isRate: false },
  { key: 'cachedTokens',  label: 'Cached Tokens',       color: '#f59e0b', rgb: '245,158,11',  field: 'cachedTokens',  isRate: false },
  { key: 'requests',      label: 'Requests',             color: '#10b981', rgb: '16,185,129',  field: 'requests',      isRate: false },
  { key: 'cacheHitRate',  label: 'Cache Hit Rate',       color: '#f59e0b', rgb: '245,158,11',  field: null,            isRate: true  },
  { key: 'cacheHits',     label: 'Cache Hits',           color: '#fbbf24', rgb: '251,191,36',  field: 'cacheHits',     isRate: false },
  { key: 'specAccepted',  label: 'MTP Accepted',         color: '#ec4899', rgb: '236,72,153',  field: 'specAccepted',  isRate: false },
]

const activeDim    = ref('byHour')
const activeMetric = ref('genTokens')

const activeDimDef    = computed(() => dimensions.find(d => d.key === activeDim.value))
const activeMetricDef = computed(() => metrics.find(m => m.key === activeMetric.value))

// ─── Helper: get value from a bucket for the active metric ───────────────────
function bucketValue(bucket) {
  if (!bucket) return 0
  if (activeMetricDef.value.key === 'cacheHitRate') {
    const q = bucket.cacheQueries || 0
    return q > 0 ? (bucket.cacheHits || 0) / q : 0
  }
  return bucket[activeMetricDef.value.field] || 0
}

function getCurrentWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

function getDayValue(dateObj, rawHourData) {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  const prefix = `${y}-${m}-${d} `
  
  const total = { promptTokens: 0, genTokens: 0, cachedTokens: 0, requests: 0, cacheHits: 0, cacheQueries: 0, specAccepted: 0, specDraft: 0 }
  for (const [key, bucket] of Object.entries(rawHourData)) {
    if (key.startsWith(prefix)) {
      for (const k of Object.keys(total)) {
        total[k] += bucket[k] || 0
      }
    }
  }
  return total
}

// ─── Build chart data ─────────────────────────────────────────────────────────
const chartData = computed(() => {
  const dim = activeDim.value
  const raw = store.timeSeries[dim] || {}

  if (dim === 'byWeekday') {
    const currentWeekDays = getCurrentWeekDays()
    const rawHours = store.timeSeries.byHour || {}
    return currentWeekDays.map(dateObj => {
      const dayBucket = getDayValue(dateObj, rawHours)
      const label = `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${WEEKDAY_LABELS[dateObj.getDay()]}`
      return {
        label,
        value: bucketValue(dayBucket),
      }
    })
  }

  if (dim === 'byHour') {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    return Array.from({ length: 24 }, (_, h) => {
      const key = `${y}-${m}-${day} ${String(h).padStart(2, '0')}`
      return {
        label: h % 2 === 0 ? formatHour(h) : '',
        value: bucketValue(raw[key]),
      }
    })
  }

  // Sort keys chronologically
  const entries = Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))

  if (dim === 'byYear') {
    return entries.map(([key, bucket]) => ({ label: key, value: bucketValue(bucket) }))
  }

  if (dim === 'byMonth') {
    return entries.map(([key, bucket]) => ({
      label: formatMonth(key),
      value: bucketValue(bucket),
    }))
  }

  if (dim === 'byWeek') {
    return entries.map(([key, bucket]) => ({
      label: formatWeekPeriod(key),
      value: bucketValue(bucket),
    }))
  }

  return entries.map(([key, bucket]) => ({ label: key, value: bucketValue(bucket) }))
})

const hasData = computed(() => chartData.value.some(d => d.value > 0))

// ─── Summary stats ────────────────────────────────────────────────────────────
const isRateMetric = computed(() => activeMetricDef.value.isRate)

function fmtVal(v) {
  if (isRateMetric.value) return (v * 100).toFixed(1) + '%'
  return fmt(v)
}

const summaryStats = computed(() => {
  const vals = chartData.value.map(d => d.value).filter(v => v > 0)
  if (!vals.length) return []
  const total = vals.reduce((a, b) => a + b, 0)
  const avg   = total / vals.length
  const peak  = Math.max(...vals)
  const peakEntry = chartData.value.find(d => d.value === peak)

  // For rates: average is weighted avg (not avg of avgs), total shown as overall rate
  return [
    { label: isRateMetric.value ? 'Overall Rate' : 'Total', value: fmtVal(isRateMetric.value ? avg : total) },
    { label: 'Average',        value: fmtVal(avg) },
    { label: 'Peak',           value: fmtVal(peak) + (peakEntry?.label ? ` (${peakEntry.label})` : '') },
    { label: 'Active Periods', value: String(vals.length) },
  ]
})

// ─── Responsive chart width ───────────────────────────────────────────────────
const chartWidth = computed(() => {
  const len = chartData.value.length
  if (activeDim.value === 'byHour')    return Math.max(600, 24 * 30)
  if (activeDim.value === 'byWeekday') return Math.max(500, 7 * 90)
  if (activeDim.value === 'byMonth')   return Math.max(500, len * 100)
  if (activeDim.value === 'byWeek')    return Math.max(500, len * 165)
  return 500
})

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}
</script>

<style scoped>
.time-analytics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analytics-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
}

/* Dimension tabs */
.tab-group {
  display: flex;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}

.tab-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover { color: var(--color-text); background: rgba(255,255,255,0.04); }

.tab-btn.active {
  background: rgba(124,111,247,0.18);
  color: #a59df9;
  font-weight: 600;
}

/* Metric pills */
.metric-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.metric-pill {
  padding: 3px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  background: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.metric-pill:hover {
  border-color: rgba(255,255,255,0.2);
  color: var(--color-text);
}

/* Chart card */
.chart-card {
  padding: 12px 14px 10px;
}

.chart-wrap {
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 4px;
}

/* Summary row */
.summary-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.summary-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.summary-val {
  font-size: 0.85rem;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
}

@media (max-width: 640px) {
  .analytics-controls { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>
