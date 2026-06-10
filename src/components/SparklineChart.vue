<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
  >
    <defs>
      <linearGradient :id="gradId" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" :stop-color="color" stop-opacity="0.3" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradId})`" />
    <path v-if="linePath" :d="linePath" :stroke="color" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  color: { type: String, default: '#7c6ff7' },
  width: { type: Number, default: 100 },
  height: { type: Number, default: 36 },
})

const gradId = `spark-grad-${Math.random().toString(36).slice(2)}`

const linePath = computed(() => {
  const d = props.data
  if (d.length < 2) return null
  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = max - min || 1
  const w = props.width
  const h = props.height
  const pad = 2

  const points = d.map((v, i) => {
    const x = (i / (d.length - 1)) * (w - pad * 2) + pad
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y]
  })

  return points.reduce((acc, [x, y], i) => {
    return acc + (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`)
  }, '')
})

const areaPath = computed(() => {
  const d = props.data
  if (d.length < 2) return null
  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = max - min || 1
  const w = props.width
  const h = props.height
  const pad = 2

  const points = d.map((v, i) => {
    const x = (i / (d.length - 1)) * (w - pad * 2) + pad
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y]
  })

  const line = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`), '')
  const last = points[points.length - 1]
  const first = points[0]
  return `${line} L ${last[0]},${h} L ${first[0]},${h} Z`
})
</script>
