<template>
  <div class="gauge-wrap">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <!-- Background track -->
      <circle
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        :stroke-width="strokeWidth"
        :stroke-dasharray="`${arcLen} ${circumference}`"
        :stroke-dashoffset="`-${gapLen / 2}`"
        stroke-linecap="round"
        style="transform-origin: center; transform: rotate(90deg)"
      />
      <!-- Value arc -->
      <circle
        :cx="cx" :cy="cy" :r="r"
        fill="none"
        :stroke="arcColor"
        :stroke-width="strokeWidth"
        :stroke-dasharray="`${filledLen} ${circumference}`"
        :stroke-dashoffset="`-${gapLen / 2}`"
        stroke-linecap="round"
        style="transform-origin: center; transform: rotate(90deg); transition: stroke-dasharray 0.6s ease;"
        :style="{
          transformOrigin: 'center',
          transform: 'rotate(90deg)',
          transition: 'stroke-dasharray 0.6s ease',
          filter: `drop-shadow(0 0 4px ${arcColor}66)`,
        }"
      />
      <!-- Center text -->
      <text
        :x="cx" :y="cy - 6"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="arcColor"
        :font-size="fontSize"
        font-weight="700"
        font-family="'JetBrains Mono', monospace"
        style="transition: fill 0.3s ease"
      >{{ displayPct }}</text>
      <text
        :x="cx" :y="cy + 12"
        text-anchor="middle"
        fill="rgba(255,255,255,0.35)"
        font-size="9"
        font-family="'Inter', sans-serif"
      >{{ unit }}</text>
    </svg>
    <div class="gauge-label-text">{{ label }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },   // 0-1 fraction
  label: { type: String, default: '' },
  color: { type: String, default: '#7c6ff7' },
  size: { type: Number, default: 100 },
  strokeWidth: { type: Number, default: 8 },
  unit: { type: String, default: '%' },
})

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const r = computed(() => (props.size / 2) - props.strokeWidth)
const circumference = computed(() => 2 * Math.PI * r.value)

// Leave a gap at the bottom (240° arc instead of 360°)
const GAP_DEG = 60
const gapLen = computed(() => (GAP_DEG / 360) * circumference.value)
const arcLen = computed(() => circumference.value - gapLen.value)
const filledLen = computed(() => {
  const clamp = Math.max(0, Math.min(1, props.value || 0))
  return arcLen.value * clamp
})

const arcColor = computed(() => {
  const v = props.value || 0
  if (v > 0.85) return '#ef4444'
  if (v > 0.65) return '#f59e0b'
  return props.color
})

const displayPct = computed(() => {
  const v = props.value || 0
  return (v * 100).toFixed(0) + '%'
})

const fontSize = computed(() => props.size < 90 ? '13' : '15')
</script>
