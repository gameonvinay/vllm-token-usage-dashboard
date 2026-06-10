<template>
  <div class="badge" :class="badgeClass">
    <div class="pulse-dot" :class="dotClass"></div>
    <span v-if="status === 'loading'" class="spinner" style="width:10px;height:10px;margin-left:2px"></span>
    {{ label }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'offline', // 'offline' | 'loading' | 'ready'
  },
})

const badgeClass = computed(() => ({
  'badge-ready': props.status === 'ready',
  'badge-loading': props.status === 'loading',
  'badge-offline': props.status === 'offline',
}))

const dotClass = computed(() => ({
  ready: props.status === 'ready',
  loading: props.status === 'loading',
  offline: props.status === 'offline',
}))

const label = computed(() => ({
  ready: 'Model Ready',
  loading: 'Loading…',
  offline: 'Server Offline',
}[props.status]))
</script>
