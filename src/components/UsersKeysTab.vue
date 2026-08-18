<template>
  <div class="users-keys-container">
    <!-- Header with Action Button -->
    <div class="tab-top-bar">
      <div>
        <h2 class="tab-heading">👥 User Quotas &amp; API Keys</h2>
        <p class="tab-subheading">
          Manage individual user keys, token quotas, and rate limits for LiteLLM and Open WebUI remote access.
        </p>
      </div>

      <button class="btn-create-key" @click="showCreateModal = true" id="create-user-key-btn">
        <span>➕</span>
        <span>Generate New Key</span>
      </button>
    </div>

    <!-- Summary Metrics Cards -->
    <div class="users-summary-grid">
      <div class="summary-card glass-card">
        <div class="summary-icon" style="background: rgba(124, 111, 247, 0.15); color: #7c6ff7">👥</div>
        <div class="summary-data">
          <div class="summary-label">Active Users</div>
          <div class="summary-value">{{ usersList.length }}</div>
        </div>
      </div>

      <div class="summary-card glass-card">
        <div class="summary-icon" style="background: rgba(0, 212, 170, 0.15); color: #00d4aa">💰</div>
        <div class="summary-data">
          <div class="summary-label">Total API Spend</div>
          <div class="summary-value">${{ totalUsersSpend.toFixed(2) }}</div>
        </div>
      </div>

      <div class="summary-card glass-card">
        <div class="summary-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b">⚡</div>
        <div class="summary-data">
          <div class="summary-label">Max Bandwidth / User</div>
          <div class="summary-value">500k <span class="unit-text">TPM</span></div>
        </div>
      </div>

      <div class="summary-card glass-card">
        <div class="summary-icon" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8">🛡️</div>
        <div class="summary-data">
          <div class="summary-label">Protection Mode</div>
          <div class="summary-value" style="font-size: 1rem">LiteLLM Proxy</div>
        </div>
      </div>
    </div>

    <!-- Users Cards List -->
    <div class="users-list">
      <div
        v-for="user in usersList"
        :key="user.userId"
        class="user-card glass-card"
        :class="{ 'owner-card': user.isOwner }"
      >
        <div class="user-card-header">
          <div class="user-identity">
            <div class="user-avatar-large">
              {{ user.isOwner ? '👑' : '👤' }}
            </div>
            <div>
              <div class="user-name-title">
                {{ user.displayName }}
                <span class="user-role-badge" :class="user.isOwner ? 'role-owner' : 'role-friend'">
                  {{ user.role }}
                </span>
              </div>
              <div class="user-meta-sub">
                <code>@{{ user.userId }}</code> • Added {{ user.createdAt }}
              </div>
            </div>
          </div>

          <div class="user-status-pill">
            <span class="status-indicator-dot" />
            {{ user.status }}
          </div>
        </div>

        <!-- Quota & Rate Limits Grid -->
        <div class="limits-grid">
          <div class="limit-box">
            <span class="limit-lbl">TPM Limit</span>
            <span class="limit-val accent-purple">
              {{ typeof user.tpmLimit === 'number' ? (user.tpmLimit / 1000).toFixed(0) + 'k TPM' : user.tpmLimit }}
            </span>
          </div>

          <div class="limit-box">
            <span class="limit-lbl">RPM Limit</span>
            <span class="limit-val accent-teal">
              {{ typeof user.rpmLimit === 'number' ? user.rpmLimit + ' RPM' : user.rpmLimit }}
            </span>
          </div>

          <div class="limit-box">
            <span class="limit-lbl">Total Spend</span>
            <span class="limit-val accent-amber">
              ${{ (user.spend || 0).toFixed(2) }}
            </span>
          </div>

          <div class="limit-box">
            <span class="limit-lbl">Allowed Models</span>
            <span class="limit-val">
              {{ user.models.join(', ') }}
            </span>
          </div>
        </div>

        <!-- API Key Box with Mask/Unmask and Copy -->
        <div class="key-box">
          <div class="key-box-left">
            <span class="key-label">API Key:</span>
            <code class="key-text">
              {{ visibleKeys[user.userId] ? user.apiKey : maskKey(user.apiKey) }}
            </code>
          </div>

          <div class="key-actions">
            <button
              class="btn-key-action"
              @click="toggleKeyVisibility(user.userId)"
              :title="visibleKeys[user.userId] ? 'Hide Key' : 'Reveal Key'"
            >
              {{ visibleKeys[user.userId] ? '🙈 Hide' : '👁️ Show' }}
            </button>

            <button
              class="btn-key-action copy-action"
              @click="copyToClipboard(user.apiKey, user.userId)"
              :title="'Copy API Key'"
            >
              {{ copiedKeyId === user.userId ? '✓ Copied!' : '📋 Copy' }}
            </button>
          </div>
        </div>

        <!-- Quick Integration Commands Snippet -->
        <details class="integration-snippet">
          <summary class="snippet-summary">View Quick Setup Configs (Cursor, Claude Code, Python)</summary>
          <div class="snippet-content">
            <div class="snippet-block">
              <span class="snippet-label">Cursor / VS Code (Continue.dev):</span>
              <pre class="snippet-code"><code>{
  "title": "Local RTX 5090 - Qwen3.8-27B",
  "provider": "openai",
  "model": "Qwen3.8-27B",
  "apiBase": "https://api.vinaysaini.dev/v1",
  "apiKey": "{{ user.apiKey }}"
}</code></pre>
            </div>

            <div class="snippet-block">
              <span class="snippet-label">Claude Code (Terminal):</span>
              <pre class="snippet-code"><code>export ANTHROPIC_BASE_URL="https://api.vinaysaini.dev"
export ANTHROPIC_AUTH_TOKEN="{{ user.apiKey }}"
export ANTHROPIC_MODEL="Qwen3.8-27B"</code></pre>
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- Create Key Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
        <div class="modal" style="max-width: 480px">
          <div class="modal-header">
            <h2 class="modal-title">➕ Generate Friend API Key</h2>
            <button class="btn-icon" @click="showCreateModal = false">✕</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Friend / User Name</label>
              <input
                class="form-input"
                v-model="newUserName"
                placeholder="e.g. John Doe"
                autofocus
              />
            </div>

            <div class="form-group">
              <label class="form-label">TPM Limit (Tokens Per Minute)</label>
              <input
                class="form-input"
                type="number"
                v-model.number="newTpmLimit"
                placeholder="500000"
              />
            </div>

            <div class="form-group">
              <label class="form-label">RPM Limit (Requests Per Minute)</label>
              <input
                class="form-input"
                type="number"
                v-model.number="newRpmLimit"
                placeholder="120"
              />
            </div>

            <div v-if="createStatusMsg" style="font-size:0.8rem; color:#00d4aa; margin-top:6px">
              {{ createStatusMsg }}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" @click="showCreateModal = false">Cancel</button>
            <button class="btn-primary" @click="handleCreateKey" :disabled="!newUserName || isCreating">
              {{ isCreating ? 'Generating…' : 'Generate Key' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const showCreateModal = ref(false)
const newUserName = ref('')
const newTpmLimit = ref(500000)
const newRpmLimit = ref(120)
const isCreating = ref(false)
const createStatusMsg = ref('')

const visibleKeys = ref({})
const copiedKeyId = ref('')

const usersList = ref([
  {
    userId: 'vinay_saini',
    displayName: 'Vinay Saini',
    role: 'Owner (Admin)',
    apiKey: 'sk-proj-vinaysaini-d56fd6f12a1eef114be1ccc3c8be0557a4e0d2c1',
    isOwner: true,
    tpmLimit: 'Unlimited',
    rpmLimit: 'Unlimited',
    spend: 0.0,
    status: 'Active',
    models: ['Qwen3.8-27B', 'All Models'],
    createdAt: '2026-08-15',
  },
  {
    userId: 'shuvikash_patel',
    displayName: 'Shuvikash Patel',
    role: 'API & Chat User',
    apiKey: 'sk-proj-shuvikash-b5619eec611aa2d3dd928063fce6d2a83ae01eb8',
    isOwner: false,
    tpmLimit: 500000,
    rpmLimit: 120,
    spend: 0.0,
    status: 'Active',
    models: ['Qwen3.8-27B'],
    createdAt: '2026-08-18',
  },
  {
    userId: 'pramod_thete',
    displayName: 'Pramod Thete',
    role: 'API & Chat User',
    apiKey: 'sk-proj-pramod-d5ae5999f3d10d393f6f348ddfaaee8f949ead70',
    isOwner: false,
    tpmLimit: 500000,
    rpmLimit: 120,
    spend: 0.0,
    status: 'Active',
    models: ['Qwen3.8-27B'],
    createdAt: '2026-08-18',
  }
])

const totalUsersSpend = computed(() => {
  return usersList.value.reduce((sum, u) => sum + (u.spend || 0), 0)
})

async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.users)) {
        usersList.value = data.users
      }
    }
  } catch (err) {
    console.warn('Failed to fetch admin users:', err)
  }
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 16) return key.slice(0, 6) + '••••••••'
  return key.slice(0, 14) + '••••••••••••••••••••' + key.slice(-4)
}

function toggleKeyVisibility(userId) {
  visibleKeys.value[userId] = !visibleKeys.value[userId]
}

async function copyToClipboard(text, id) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKeyId.value = id
    setTimeout(() => { copiedKeyId.value = '' }, 2500)
  } catch {}
}

async function handleCreateKey() {
  if (!newUserName.value) return
  isCreating.value = true
  createStatusMsg.value = ''

  try {
    const res = await fetch('/api/admin/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newUserName.value,
        tpmLimit: newTpmLimit.value,
        rpmLimit: newRpmLimit.value,
      })
    })

    if (res.ok) {
      const newKeyData = await res.json()
      const slug = newUserName.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
      
      usersList.value.push({
        userId: slug,
        displayName: newUserName.value,
        role: 'API & Chat User',
        apiKey: newKeyData.key || `sk-proj-${slug}-generated`,
        isOwner: false,
        tpmLimit: newTpmLimit.value,
        rpmLimit: newRpmLimit.value,
        maxBudget: 2000,
        status: 'Active',
        models: ['Qwen3.8-27B'],
        createdAt: new Date().toISOString().slice(0, 10),
      })

      createStatusMsg.value = '✓ Key created successfully!'
      setTimeout(() => {
        showCreateModal.value = false
        newUserName.value = ''
        createStatusMsg.value = ''
      }, 1000)
    }
  } catch (err) {
    createStatusMsg.value = 'Error generating key'
  } finally {
    isCreating.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.users-keys-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.tab-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.tab-heading {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text, #f8fafc);
  letter-spacing: -0.02em;
}

.tab-subheading {
  font-size: 0.8rem;
  color: var(--color-text-muted, #94a3b8);
  margin-top: 2px;
}

.btn-create-key {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, var(--color-indigo, #7c6ff7), var(--color-teal, #00d4aa));
  color: #ffffff;
  border: none;
  font-family: var(--font-sans, sans-serif);
  font-size: 0.85rem;
  font-weight: 700;
  padding: 9px 18px;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(124, 111, 247, 0.3);
  transition: all 0.2s ease;
}

.btn-create-key:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 22px rgba(124, 111, 247, 0.45);
}

/* Summary Grid */
.users-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .users-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .users-summary-grid {
    grid-template-columns: 1fr;
  }
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 14px;
}

.summary-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.summary-label {
  font-size: 0.72rem;
  color: var(--color-text-subtle, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.summary-value {
  font-size: 1.3rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: var(--color-text, #f8fafc);
  margin-top: 1px;
}

.unit-text {
  font-size: 0.75rem;
  color: var(--color-text-muted, #94a3b8);
  font-weight: 500;
}

/* Users List */
.users-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.user-card {
  padding: 18px 22px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  transition: all 0.2s ease;
}

.owner-card {
  border-color: rgba(124, 111, 247, 0.3);
  background: rgba(124, 111, 247, 0.04);
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-avatar-large {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.user-name-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text, #f8fafc);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-role-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 10px;
}

.role-owner {
  background: rgba(124, 111, 247, 0.18);
  color: #a59df9;
  border: 1px solid rgba(124, 111, 247, 0.35);
}

.role-friend {
  background: rgba(0, 212, 170, 0.15);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.3);
}

.user-meta-sub {
  font-size: 0.74rem;
  color: var(--color-text-subtle, #64748b);
  margin-top: 2px;
}

.user-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #00d4aa;
  background: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.25);
  padding: 3px 10px;
  border-radius: 20px;
}

.status-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4aa;
  box-shadow: 0 0 6px rgba(0, 212, 170, 0.8);
}

/* Limits Grid */
.limits-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: 10px 14px;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .limits-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.limit-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.limit-lbl {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle, #64748b);
  font-weight: 600;
}

.limit-val {
  font-size: 0.86rem;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  color: var(--color-text, #f8fafc);
}

.accent-purple { color: #a59df9; }
.accent-teal { color: #00d4aa; }
.accent-amber { color: #f59e0b; }

/* API Key Box */
.key-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 14px;
  border-radius: 10px;
  flex-wrap: wrap;
}

.key-box-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.key-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.key-text {
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.key-actions {
  display: flex;
  gap: 8px;
}

.btn-key-action {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--color-text, #f8fafc);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-key-action:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

.copy-action {
  background: rgba(0, 212, 170, 0.12);
  border-color: rgba(0, 212, 170, 0.3);
  color: #00d4aa;
}

.copy-action:hover {
  background: rgba(0, 212, 170, 0.22);
}

/* Integration Details */
.integration-snippet {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 8px;
}

.snippet-summary {
  font-size: 0.72rem;
  color: #7c6ff7;
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}

.snippet-summary:hover {
  text-decoration: underline;
}

.snippet-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.snippet-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snippet-label {
  font-size: 0.68rem;
  color: var(--color-text-subtle, #64748b);
  font-weight: 600;
}

.snippet-code {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 0;
  overflow-x: auto;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  color: #e6edf3;
  line-height: 1.4;
}
</style>
