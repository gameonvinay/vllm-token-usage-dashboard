<template>
  <div class="app-bg" />
  <div class="app-grid" />

  <!-- Google 2FA OAuth Lock Screen (Active on hosted domain, bypassed on Local LAN) -->
  <Transition name="fade">
    <AuthLockScreen v-if="store.isAuthLocked" />
  </Transition>

  <div class="app-shell" v-if="!store.isAuthLocked">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <div class="app-title">
        <div class="app-logo">⚡</div>
        <div>
          <h1>LLM Dashboard</h1>
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

        <!-- Owner Profile & Cloud Sync -->
        <div class="user-chip" :title="store.isLocalLan ? 'Local LAN Direct Mode' : `Owner: ${store.authUser?.displayName || 'Vinay Saini'}`">
          <img v-if="store.authUser?.photoURL" :src="store.authUser.photoURL" class="user-photo" alt="Avatar" />
          <span v-else class="user-avatar-badge">{{ store.isLocalLan ? '🏠' : '👤' }}</span>
          <span class="user-name-text">{{ store.authUser?.displayName || 'Vinay Saini' }}</span>
          <span v-if="store.isLocalLan" class="lan-tag">LAN</span>
          <span class="cloud-dot" title="Cloud Firestore Connected" />
          <button v-if="!store.isLocalLan && store.authUser" class="btn-lock" @click="store.logout()" title="Sign Out & Lock Dashboard">🔒</button>
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
      </div>
    </header>

    <!-- ── Navigation Tabs ────────────────────────────────────────────────── -->
    <nav class="nav-tabs-bar">
      <button
        class="nav-tab-btn"
        :class="{ active: activeTab === 'metrics' }"
        @click="activeTab = 'metrics'"
        id="tab-metrics-btn"
      >
        <span class="tab-icon">⚡</span>
        <span class="tab-title">Live Engine &amp; Telemetry</span>
      </button>

      <button
        class="nav-tab-btn"
        :class="{ active: activeTab === 'users' }"
        @click="activeTab = 'users'"
        id="tab-users-btn"
      >
        <span class="tab-icon">👥</span>
        <span class="tab-title">Users &amp; API Keys</span>
        <span class="tab-pill-badge">3</span>
      </button>
    </nav>

    <!-- ── Tab 1: Live Engine Telemetry (Total across all users) ───────────── -->
    <main v-if="activeTab === 'metrics'">
      <!-- Offline notice -->
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

      <!-- Token Overview -->
      <section class="section">
        <div class="section-header">
          <div class="section-dot" style="background: #7c6ff7" />
          <span class="section-label">Total Engine Token Usage (All Users)</span>
        </div>
        <TokensOverview />
      </section>

      <div class="section-divider" />

      <!-- Core Engine & Cache Telemetry Cards -->
      <div class="diagnostic-grid" :class="{ 'has-mtp': store.isMtpEnabled }">
        <Transition name="fade">
          <KvCacheCard v-if="store.backendType !== 'llamacpp'" />
        </Transition>

        <Transition name="fade">
          <CacheHitCard v-if="store.backendType !== 'llamacpp'" />
        </Transition>

        <Transition name="fade">
          <MtpPanel v-if="store.isMtpEnabled" />
        </Transition>

        <EnginePanel />
      </div>

      <div class="section-divider" />

      <!-- Host System Hardware Monitor -->
      <section class="section" id="system-hardware-section">
        <SystemInfoSection />
      </section>

      <div class="section-divider" />

      <!-- Time Analytics -->
      <section class="section" id="time-analytics-section">
        <div class="section-header">
          <div class="section-dot" style="background: #3b82f6" />
          <span class="section-label">Usage Over Time</span>
          <span class="section-badge">Historical</span>
        </div>
        <TimeAnalytics />
      </section>
    </main>

    <!-- ── Tab 2: Users & API Keys (Individual Quotas & Usage) ─────────────── -->
    <main v-else-if="activeTab === 'users'">
      <UsersKeysTab />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'
import { useMetricsPoller } from '@/composables/useMetricsPoller'
import AuthLockScreen    from '@/components/AuthLockScreen.vue'
import UsersKeysTab     from '@/components/UsersKeysTab.vue'
import ServerStatus      from '@/components/ServerStatus.vue'
import TokensOverview    from '@/components/TokensOverview.vue'
import KvCacheCard       from '@/components/KvCacheCard.vue'
import CacheHitCard      from '@/components/CacheHitCard.vue'
import MtpPanel          from '@/components/MtpPanel.vue'
import EnginePanel       from '@/components/EnginePanel.vue'
import SystemInfoSection from '@/components/SystemInfoSection.vue'
import TimeAnalytics     from '@/components/TimeAnalytics.vue'

const store  = useMetricsStore()
const poller = useMetricsPoller()
const activeTab = ref('metrics')

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
</script>

<style scoped>
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(124, 111, 247, 0.1);
  border: 1px solid rgba(124, 111, 247, 0.28);
  padding: 4px 11px;
  border-radius: 20px;
  font-size: 0.74rem;
}

.user-avatar-badge {
  font-size: 0.85rem;
}

/* Navigation Tabs Bar */
.nav-tabs-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 10px;
}

.nav-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-text-muted, #94a3b8);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text, #f8fafc);
  border-color: rgba(255, 255, 255, 0.15);
}

.nav-tab-btn.active {
  background: rgba(124, 111, 247, 0.16);
  border-color: rgba(124, 111, 247, 0.4);
  color: #ffffff;
  box-shadow: 0 0 16px rgba(124, 111, 247, 0.2);
}

.tab-icon {
  font-size: 1rem;
}

.tab-title {
  letter-spacing: 0.01em;
}

.tab-pill-badge {
  background: rgba(0, 212, 170, 0.2);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.35);
  font-size: 0.64rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

.user-photo {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name-text {
  color: var(--color-text, #f8fafc);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.lan-tag {
  background: rgba(0, 212, 170, 0.15);
  border: 1px solid rgba(0, 212, 170, 0.35);
  color: #00d4aa;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.btn-lock {
  background: none;
  border: none;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0 2px;
  opacity: 0.6;
  transition: opacity 0.2s, transform 0.2s;
  display: flex;
  align-items: center;
}

.btn-lock:hover {
  opacity: 1;
  transform: scale(1.15);
}

.cloud-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.9);
  animation: pulse-cloud 2s infinite;
}

@keyframes pulse-cloud {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
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
