<template>
  <div class="tokens-overview">
    <StatCard
      label="Prompt Tokens"
      :lifetime="store.lifetime.promptTokens"
      :sessionValue="store.raw.promptTokens"
      :rate="store.rates.promptTokens"
      :subRate="store.lastPrefillSpeed"
      :sparkData="store.history.promptTokensRate"
      priceBadge="$0.45 / 1M"
      color="#7c6ff7"
      glow="rgba(124,111,247,0.15)"
      icon="📥"
    />
    <StatCard
      label="Generation Tokens"
      :lifetime="store.lifetime.genTokens"
      :sessionValue="store.raw.genTokens"
      :rate="store.rates.genTokens"
      :sparkData="store.history.genTokensRate"
      priceBadge="$3.20 / 1M"
      color="#00d4aa"
      glow="rgba(0,212,170,0.15)"
      icon="✨"
    />
    <StatCard
      label="API Cost"
      :lifetime="store.lifetimeCost"
      :sessionValue="store.sessionCost"
      :rate="null"
      :sparkData="null"
      :isCurrency="true"
      color="#10b981"
      glow="rgba(16,185,129,0.18)"
      icon="💰"
    />
    <StatCard
      label="Cached Tokens"
      :lifetime="store.lifetime.cachedTokens"
      :sessionValue="store.raw.cachedTokens"
      :rate="store.rates.cachedTokens"
      :sparkData="store.history.cachedTokensRate"
      color="#f59e0b"
      glow="rgba(245,158,11,0.15)"
      icon="⚡"
    />
    <StatCard
      label="Total Requests"
      :lifetime="store.lifetime.requests"
      :sessionValue="store.raw.requestsSuccess"
      :rate="null"
      :sparkData="null"
      color="#38bdf8"
      glow="rgba(56,189,248,0.15)"
      icon="✅"
    />
  </div>
</template>

<script setup>
import { useMetricsStore } from '@/stores/metrics'
import StatCard from './StatCard.vue'
const store = useMetricsStore()
</script>

<style scoped>
.tokens-overview {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(5, 1fr);
}

@media (max-width: 1200px) {
  .tokens-overview {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .tokens-overview {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .tokens-overview {
    grid-template-columns: 1fr;
  }
}
</style>
