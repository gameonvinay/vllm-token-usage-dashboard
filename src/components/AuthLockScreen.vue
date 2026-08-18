<template>
  <div class="auth-lock-overlay">
    <div class="auth-lock-card glass-card">
      <div class="lock-icon-container">
        <div class="lock-shield">🛡️</div>
      </div>

      <div class="lock-header">
        <h1 class="lock-title">LLM Dashboard</h1>
        <div class="lock-badge">🔒 Protected Terminal</div>
      </div>

      <p class="lock-desc">
        Owner access only. Sign in with Google 2FA or enter your Owner Passkey to unlock.
      </p>

      <div v-if="errorMsg" class="auth-error-box">
        <span>⚠️</span>
        <span>{{ errorMsg }}</span>
      </div>

      <!-- Option A: Sign In with Google -->
      <button
        class="btn-google-login"
        :disabled="isSigningIn"
        @click="handleGoogleLogin"
        id="google-signin-btn"
      >
        <svg class="google-svg" viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span v-if="!isSigningIn">Sign In with Google</span>
        <span v-else>Verifying 2FA…</span>
      </button>

      <div class="auth-divider">
        <span>OR UNLOCK WITH PASSKEY</span>
      </div>

      <!-- Option B: Passkey / PIN Unlock -->
      <form class="passkey-form" @submit.prevent="handlePasskeyLogin">
        <div class="passkey-input-wrapper">
          <input
            class="passkey-input"
            type="password"
            v-model="passkeyInput"
            placeholder="Enter Owner Passkey / PIN"
            autocomplete="current-password"
          />
          <button type="submit" class="btn-passkey-submit" :disabled="!passkeyInput">
            Unlock ➔
          </button>
        </div>
      </form>

      <div class="lock-footer">
        <span>Protected by Cloudflare SSL &amp; Firebase OAuth 2.0</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

const store = useMetricsStore()
const isSigningIn = ref(false)
const passkeyInput = ref('')
const errorMsg = ref('')

async function handleGoogleLogin() {
  isSigningIn.value = true
  errorMsg.value = ''
  try {
    await store.loginWithGoogle()
  } catch (err) {
    console.error('Login error:', err)
    if (err.code === 'auth/popup-closed-by-user') {
      errorMsg.value = 'Sign-in window was closed. Try entering your Owner Passkey below.'
    } else if (err.code === 'auth/unauthorized-domain') {
      errorMsg.value = 'Firebase domain not registered yet. Unlock with Owner Passkey (vinay5090) or add vinaysaini.dev to Firebase Auth -> Authorized domains.'
    } else if (err.code === 'auth/operation-not-allowed') {
      errorMsg.value = 'Google Auth provider not enabled in Firebase Console. Unlock with Owner Passkey (vinay5090).'
    } else {
      errorMsg.value = (err.message || 'Auth failed') + '. You can unlock with Owner Passkey (vinay5090).'
    }
  } finally {
    isSigningIn.value = false
  }
}

function handlePasskeyLogin() {
  errorMsg.value = ''
  const success = store.loginWithPasskey(passkeyInput.value)
  if (!success) {
    errorMsg.value = 'Invalid passkey. Use vinay5090 or your master API key.'
  }
}
</script>

<style scoped>
.auth-lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: radial-gradient(circle at 50% 30%, rgba(124, 111, 247, 0.14) 0%, rgba(10, 12, 18, 0.96) 70%);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-lock-card {
  width: 100%;
  max-width: 440px;
  background: rgba(18, 22, 34, 0.9);
  border: 1px solid rgba(124, 111, 247, 0.3);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 50px rgba(124, 111, 247, 0.18);
  border-radius: 22px;
  padding: 34px 30px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.lock-icon-container {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(124, 111, 247, 0.14);
  border: 1px solid rgba(124, 111, 247, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 0 24px rgba(124, 111, 247, 0.3);
}

.lock-shield {
  font-size: 30px;
}

.lock-header {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.lock-title {
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text, #f8fafc);
}

.lock-badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.3);
  padding: 2px 10px;
  border-radius: 12px;
}

.lock-desc {
  font-size: 0.82rem;
  color: var(--color-text-muted, #94a3b8);
  line-height: 1.5;
  margin-bottom: 20px;
}

.auth-error-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.76rem;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 18px;
  text-align: left;
  width: 100%;
  line-height: 1.4;
}

.btn-google-login {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #ffffff;
  color: #1f2937;
  font-family: var(--font-sans, sans-serif);
  font-size: 0.92rem;
  font-weight: 600;
  padding: 11px 20px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.btn-google-login:hover:not(:disabled) {
  background: #f3f4f6;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.btn-google-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-divider {
  width: 100%;
  display: flex;
  align-items: center;
  text-align: center;
  margin: 18px 0 14px;
  color: var(--color-text-subtle, #64748b);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.auth-divider span {
  padding: 0 10px;
}

.passkey-form {
  width: 100%;
}

.passkey-input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.passkey-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--color-text, #f8fafc);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.passkey-input:focus {
  border-color: #7c6ff7;
  box-shadow: 0 0 10px rgba(124, 111, 247, 0.3);
}

.btn-passkey-submit {
  background: rgba(124, 111, 247, 0.2);
  border: 1px solid rgba(124, 111, 247, 0.4);
  color: #a59df9;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 0 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-passkey-submit:hover:not(:disabled) {
  background: rgba(124, 111, 247, 0.35);
  color: #ffffff;
}

.btn-passkey-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lock-footer {
  margin-top: 20px;
  font-size: 0.68rem;
  color: var(--color-text-subtle, #64748b);
  letter-spacing: 0.02em;
}
</style>
