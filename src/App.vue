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

        <!-- Context window badge -->
        <Transition name="fade">
          <div
            v-if="store.serverStatus === 'ready' && store.modelContextLen"
            class="meta-badge context-badge"
            :title="`Context Window: ${store.modelContextLen.toLocaleString()} tokens`"
          >
            📐 {{ formatContext(store.modelContextLen) }}
          </div>
        </Transition>

        <!-- Vision capability badge -->
        <Transition name="fade">
          <div
            v-if="store.serverStatus === 'ready'"
            class="meta-badge"
            :class="store.modelHasVision ? 'vision-badge' : 'text-only-badge'"
            :title="store.modelHasVision ? 'Multimodal Vision Enabled' : 'Text-Only Language Model'"
          >
            {{ store.modelHasVision ? '👁️ Vision' : '📝 Text-Only' }}
          </div>
        </Transition>

        <!-- Backend badge -->
        <Transition name="fade">
          <div v-if="store.serverStatus === 'ready'" class="backend-badge" :class="store.backendType">
            {{ store.backendType === 'llamacpp' ? '🦙 llama.cpp' : '⚡ vLLM' }}
          </div>
        </Transition>

        <!-- Cloud Sync Badge -->
        <Transition name="fade">
          <div
            v-if="store.cloudSyncStatus === 'synced'"
            class="meta-badge cloud-badge"
            title="Cloud Firestore Realtime Sync Active (Click to configure)"
            @click="showSettings = true"
            style="cursor: pointer"
          >
            ☁️ Cloud
          </div>
        </Transition>

        <!-- Google Auth chip (if enabled) -->
        <div v-if="store.firebaseConfig.authEnabled" class="auth-chip">
          <template v-if="store.authUser">
            <img
              v-if="store.authUser.photoURL"
              :src="store.authUser.photoURL"
              class="user-avatar"
              :title="store.authUser.displayName || store.authUser.email"
            />
            <span class="user-name">{{ store.authUser.displayName?.split(' ')[0] || 'User' }}</span>
            <button class="btn-logout" @click="store.logout()" title="Sign Out">✕</button>
          </template>
          <button v-else class="btn-signin" @click="handleGoogleLogin">
            🔑 Sign In
          </button>
        </div>

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

    <!-- ── Core Engine & Cache Telemetry Cards (Big KV Cache + Small Side Cards) ──── -->
    <div class="diagnostic-grid" :class="{ 'has-mtp': store.isMtpEnabled }">
      <!-- 1. KV Cache Allocation -->
      <Transition name="fade">
        <KvCacheCard v-if="store.backendType !== 'llamacpp'" />
      </Transition>

      <!-- 2. Cache Performance -->
      <Transition name="fade">
        <CacheHitCard v-if="store.backendType !== 'llamacpp'" />
      </Transition>

      <!-- 3. MTP Speculative (auto-hidden if not active) -->
      <Transition name="fade">
        <MtpPanel v-if="store.isMtpEnabled" />
      </Transition>

      <!-- 4. Engine Health -->
      <EnginePanel />
    </div>

    <div class="section-divider" />

    <!-- ── Host System Hardware Monitor ───────────────────────────────────── -->
    <section class="section" id="system-hardware-section">
      <SystemInfoSection />
    </section>

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
import ServerStatus      from '@/components/ServerStatus.vue'
import TokensOverview    from '@/components/TokensOverview.vue'
import KvCacheCard       from '@/components/KvCacheCard.vue'
import CacheHitCard      from '@/components/CacheHitCard.vue'
import MtpPanel          from '@/components/MtpPanel.vue'
import EnginePanel       from '@/components/EnginePanel.vue'
import SystemInfoSection from '@/components/SystemInfoSection.vue'
import TimeAnalytics     from '@/components/TimeAnalytics.vue'
import SettingsModal     from '@/components/SettingsModal.vue'

const store  = useMetricsStore()
const poller = useMetricsPoller()
const showSettings = ref(false)

const lastUpdatedStr = computed(() =>
  store.lastUpdated ? store.lastUpdated.toLocaleTimeString() : ''
)

function formatContext(tokens) {
  if (!tokens) return ''
  if (tokens >= 1000) {
    const k = Math.round(tokens / 1000)
    return `${k}K ctx`
  }
  return `${tokens} ctx`
}

async function handleGoogleLogin() {
  try {
    await store.loginWithGoogle()
  } catch (err) {
    alert('Google Sign-In failed: ' + (err.message || err))
  }
}
</script>

<style scoped>
.cloud-badge {
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
  border-color: rgba(0, 212, 170, 0.3);
}

.auth-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.72rem;
}

.user-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.user-name {
  color: var(--color-text, #f8fafc);
  font-weight: 600;
}

.btn-logout {
  background: none;
  border: none;
  color: var(--color-text-dim, #94a3b8);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0 2px;
}
.btn-logout:hover {
  color: #ef4444;
}

.btn-signin {
  background: rgba(124, 111, 247, 0.15);
  border: 1px solid rgba(124, 111, 247, 0.35);
  color: #a59df9;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 12px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-signin:hover {
  background: rgba(124, 111, 247, 0.25);
}

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

.meta-badge {
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 20px;
  padding: 3px 10px;
  letter-spacing: 0.04em;
  border: 1px solid;
  white-space: nowrap;
  font-family: var(--font-mono, monospace);
}

.context-badge {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
}

.vision-badge {
  background: rgba(236, 72, 153, 0.14);
  color: #ec4899;
  border-color: rgba(236, 72, 153, 0.35);
  box-shadow: 0 0 10px rgba(236, 72, 153, 0.15);
}

.text-only-badge {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-muted);
  border-color: rgba(255, 255, 255, 0.1);
}

.backend-badge {
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 20px;
  padding: 3px 10px;
  letter-spacing: 0.04em;
  border: 1px solid;
  white-space: nowrap;
}
.backend-badge.vllm {
  background: rgba(124,111,247,0.12);
  color: #7c6ff7;
  border-color: rgba(124,111,247,0.3);
}
.backend-badge.llamacpp {
  background: rgba(251,146,60,0.12);
  color: #fb923c;
  border-color: rgba(251,146,60,0.3);
}
</style>
