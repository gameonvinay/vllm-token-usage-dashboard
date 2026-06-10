<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    @mousemove="onMouseMove"
    @mouseleave="hoverIdx = null"
    style="overflow: visible"
  >
    <defs>
      <linearGradient :id="gradId" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" :stop-color="color" stop-opacity="0.9" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.4" />
      </linearGradient>
    </defs>

    <!-- Gridlines (across the active chart area) -->
    <line
      v-for="i in 4" :key="'grid-'+i"
      :x1="PAD_LEFT" :y1="gridY(i)" :x2="width - PAD_RIGHT" :y2="gridY(i)"
      stroke="rgba(255,255,255,0.04)" stroke-width="1"
    />

    <!-- Y-axis line -->
    <line
      :x1="PAD_LEFT" :y1="PAD_TOP" :x2="PAD_LEFT" :y2="PAD_TOP + chartH"
      stroke="rgba(255,255,255,0.12)" stroke-width="1"
    />

    <!-- X-axis line -->
    <line
      :x1="PAD_LEFT" :y1="PAD_TOP + chartH" :x2="width - PAD_RIGHT" :y2="PAD_TOP + chartH"
      stroke="rgba(255,255,255,0.12)" stroke-width="1"
    />

    <!-- Y-axis labels -->
    <!-- 0 label at bottom -->
    <text
      :x="PAD_LEFT - 8"
      :y="PAD_TOP + chartH + 3"
      text-anchor="end"
      font-size="9"
      fill="rgba(255,255,255,0.36)"
      font-family="'JetBrains Mono', monospace"
    >0</text>
    <!-- Tick labels for gridlines -->
    <text
      v-for="i in 4" :key="'y-lbl-'+i"
      :x="PAD_LEFT - 8"
      :y="gridY(i) + 3"
      text-anchor="end"
      font-size="9"
      fill="rgba(255,255,255,0.36)"
      font-family="'JetBrains Mono', monospace"
    >
      {{ formatYVal((maxVal / 4) * i) }}
    </text>

    <!-- Bars -->
    <g v-for="(bar, i) in bars" :key="i">
      <rect
        :x="bar.x"
        :y="bar.y"
        :width="bar.w"
        :height="bar.h"
        :fill="i === hoverIdx ? color : `url(#${gradId})`"
        :rx="Math.min(3, bar.w / 2)"
        :style="`transition: height 0.4s ease, y 0.4s ease; filter: ${i === hoverIdx ? `drop-shadow(0 0 6px ${color}88)` : 'none'}`"
      />
    </g>

    <!-- X-axis labels -->
    <text
      v-for="(bar, i) in bars" :key="'lbl-'+i"
      :x="bar.x + bar.w / 2"
      :y="height - 8"
      text-anchor="middle"
      :font-size="labelFontSize"
      fill="rgba(255,255,255,0.36)"
      font-family="'Inter', sans-serif"
    >{{ bar.label }}</text>

    <!-- Hover tooltip -->
    <g v-if="hoverIdx !== null && bars[hoverIdx]" :transform="`translate(${tooltipX(bars[hoverIdx])}, ${Math.max(4, bars[hoverIdx].y - 8)})`">
      <rect x="-30" y="-18" width="60" height="20" rx="4" fill="#1c2333" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      <text x="0" y="-4" text-anchor="middle" font-size="10" fill="white" font-family="'JetBrains Mono', monospace" font-weight="600">
        {{ formatTooltip(bars[hoverIdx].value) }}
      </text>
    </g>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  data:      { type: Array, default: () => [] },   // [{ label, value }]
  color:     { type: String, default: '#7c6ff7' },
  width:     { type: Number, default: 400 },
  height:    { type: Number, default: 270 },       // Default increased by 150px from 120px
  isPercent: { type: Boolean, default: false },    // values are 0-1 fractions → show as %
})

const gradId = `bar-grad-${Math.random().toString(36).slice(2)}`
const hoverIdx = ref(null)

const PAD_TOP    = 24
const PAD_LEFT   = 42
const PAD_RIGHT  = 12
const PAD_BOTTOM = 28

const labelFontSize = computed(() => props.data.length > 24 ? 8 : 10)

const maxVal = computed(() => {
  const max = Math.max(...props.data.map(d => d.value), 0)
  return max > 0 ? max : 1
})

const chartH = computed(() => props.height - PAD_TOP - PAD_BOTTOM)
const barAreaW = computed(() => props.width - PAD_LEFT - PAD_RIGHT)

const barW = computed(() => {
  const total = barAreaW.value
  const gap   = Math.max(1, Math.floor(total / props.data.length * 0.15))
  return (total - gap * (props.data.length - 1)) / props.data.length
})

const gap = computed(() => {
  const total = barAreaW.value
  return (total - barW.value * props.data.length) / Math.max(1, props.data.length - 1)
})

const bars = computed(() => props.data.map((d, i) => {
  const h = (d.value / maxVal.value) * chartH.value
  const x = PAD_LEFT + i * (barW.value + gap.value)
  const y = PAD_TOP + chartH.value - h
  return { x, y, w: barW.value, h: Math.max(h, d.value > 0 ? 2 : 0), label: d.label, value: d.value }
}))

function gridY(i) {
  return PAD_TOP + (chartH.value / 4) * (4 - i)
}

function tooltipX(bar) {
  const mid = bar.x + bar.w / 2
  return Math.max(34, Math.min(props.width - 34, mid))
}

function onMouseMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  let found = null
  bars.value.forEach((bar, i) => {
    if (x >= bar.x && x <= bar.x + bar.w) found = i
  })
  hoverIdx.value = found
}

function formatTooltip(v) {
  if (props.isPercent) return (v * 100).toFixed(1) + '%'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}

function formatYVal(v) {
  if (v === 0) return '0'
  if (props.isPercent) return (v * 100).toFixed(0) + '%'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}
</script>
