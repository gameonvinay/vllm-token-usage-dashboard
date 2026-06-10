<template>
  <div class="app-bg" />
  <div class="app-grid" />

  <div class="app-shell">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <div class="app-title">
        <div class="app-logo">⚡</div>
        <div>
          <h1>vLLM Dashboard</h1>
          <div class="subtitle">Real-time metrics monitor</div>
        </div>
      </div>

      <div class="header-right">
        <!-- Model chip -->
        <Transition name="fade">
          <div v-if="store.modelName" class="model-chip" :title="store.modelName">
            🤖 {{ store.modelName }}
          </div>
        </Transition>

        <!-- Status -->
        <ServerStatus :status="store.serverStatus" />

        <!-- Last updated -->
        <Transition name="fade">
          <div v-if="store.lastUpdated" class="last-updated">
            {{ lastUpdatedStr }}
          </div>
        </Transition>

        <!-- Poll indicator -->
        <div class="poll-indicator" :title="`Polling every ${store.pollIntervalMs / 1000}s`">
          <div class="spinner" style="width:10px;height:10px;border-width:1.5px" v-if="store.serverStatus !== 'offline'" />
          {{ store.pollIntervalMs / 1000 }}s
        </div>

        <!-- Quick export -->
        <button
          id="quick-export-btn"
          class="btn-icon"
          @click="store.exportData()"
          aria-label="Export data"
          title="Export metrics data"
          data-tooltip="Export JSON"
        >⬇️</button>

        <!-- Settings -->
        <button
          id="open-settings-btn"
          class="btn-icon"
          @click="showSettings = true"
          aria-label="Open settings"
          title="Settings"
        >⚙️</button>
      </div>
    </header>

    <!-- ── Offline notice ─────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="store.serverStatus === 'offline'" class="offline-notice glass-card">
        <div class="offline-icon">🔌</div>
        <div>
          <strong>Server Offline</strong>
          <p>Cannot reach <code class="server-url-code">{{ store.serverUrl }}</code></p>
          <p class="hint">Dashboard will auto-connect when the server is available.</p>
        </div>
        <button class="btn-ghost" style="flex-shrink:0" @click="poller.startPolling()">Retry Now</button>
      </div>
    </Transition>

    <!-- ── Token Overview ──────────────────────────────────────────────────── -->
    <section class="section">
      <div class="section-header">
        <div class="section-dot" style="background: #7c6ff7" />
        <span class="section-label">Token Usage</span>
      </div>
      <TokensOverview />
    </section>

    <div class="section-divider" />

    <!-- ── Diagnostic Panels Grid ────────────────────────────────────────── -->
    <div class="diagnostic-grid">
      <!-- ── Cache Performance ───────────────────────────────────────────────── -->
      <section class="section">
        <div class="section-header">
          <div class="section-dot" style="background: #f59e0b" />
          <span class="section-label">Cache Performance</span>
        </div>
        <CachePanel />
      </section>

      <!-- ── MTP (auto-hidden if not running speculative decode) ───────────── -->
      <Transition name="fade">
        <section v-if="store.isMtpEnabled" class="section">
          <div class="section-header">
            <div class="section-dot" style="background: #ec4899" />
            <span class="section-label">MTP Speculative</span>
          </div>
          <MtpPanel />
        </section>
      </Transition>

      <!-- ── Engine Health ───────────────────────────────────────────────────── -->
      <section class="section">
        <div class="section-header">
          <div class="section-dot" style="background: #10b981" />
          <span class="section-label">Engine Health</span>
        </div>
        <EnginePanel />
      </section>
    </div>

    <div class="section-divider" />

    <!-- ── Time Analytics ─────────────────────────────────────────────────── -->
    <section class="section" id="time-analytics-section">
      <div class="section-header">
        <div class="section-dot" style="background: #3b82f6" />
        <span class="section-label">Usage Over Time</span>
        <span class="section-badge">Historical</span>
      </div>
      <TimeAnalytics />
    </section>

    <!-- ── Settings Modal ─────────────────────────────────────────────────── -->
    <Transition name="fade">
      <SettingsModal
        v-if="showSettings"
        @close="showSettings = false"
        @saved="poller.restartPolling()"
      />
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import { useMetricsPoller } from '@/composables/useMetricsPoller'
import ServerStatus   from '@/components/ServerStatus.vue'
import TokensOverview from '@/components/TokensOverview.vue'
import CachePanel     from '@/components/CachePanel.vue'
import MtpPanel       from '@/components/MtpPanel.vue'
import EnginePanel    from '@/components/EnginePanel.vue'
import TimeAnalytics  from '@/components/TimeAnalytics.vue'
import SettingsModal  from '@/components/SettingsModal.vue'

const store  = useMetricsStore()
const poller = useMetricsPoller()
const showSettings = ref(false)

const lastUpdatedStr = computed(() =>
  store.lastUpdated ? store.lastUpdated.toLocaleTimeString() : ''
)
</script>

<style scoped>
.offline-notice {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px;
  margin-bottom: 24px;
  border-color: rgba(239,68,68,0.2);
  background: rgba(239,68,68,0.05);
}

.offline-icon { font-size: 1.75rem; flex-shrink: 0; margin-top: 2px; }
.offline-notice strong { font-size: 0.95rem; color: var(--color-text); }
.offline-notice p { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px; }
.offline-notice .hint { font-size: 0.75rem; color: var(--color-text-subtle); margin-top: 2px; }

.server-url-code {
  font-family: var(--font-mono, monospace);
  font-size: 0.78rem;
  color: #ef4444;
}

.section-badge {
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(59,130,246,0.15);
  color: #3b82f6;
  border: 1px solid rgba(59,130,246,0.25);
  border-radius: 20px;
  padding: 2px 8px;
  margin-left: 4px;
}
</style>
