import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

export function useMetricsPoller() {
  const store = useMetricsStore()
  const timerId = ref(null)

  function startPolling() {
    stopPolling()
    store.poll() // immediate first fetch
    timerId.value = setInterval(() => {
      store.poll()
    }, store.pollIntervalMs)
  }

  function stopPolling() {
    if (timerId.value) {
      clearInterval(timerId.value)
      timerId.value = null
    }
  }

  function restartPolling() {
    startPolling()
  }

  // Restart if poll interval changes
  watch(() => store.pollIntervalMs, () => {
    if (timerId.value) startPolling()
  })

  // Restart if server URL changes
  watch(() => store.serverUrl, () => {
    if (timerId.value) startPolling()
  })

  onMounted(() => startPolling())
  onUnmounted(() => stopPolling())

  return { startPolling, stopPolling, restartPolling }
}
