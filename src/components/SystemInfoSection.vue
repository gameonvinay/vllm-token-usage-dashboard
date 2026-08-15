<template>
  <div class="system-info-section">
    <div class="section-header">
      <div class="header-left">
        <div class="section-dot" style="background: #00d4aa" />
        <span class="section-label">Host System Hardware & Power</span>
        <span class="section-badge sys-badge">Live Telemetry</span>
      </div>
      <div v-if="metrics" class="telemetry-time">
        Updated: {{ updateTime }}
      </div>
    </div>

    <div class="system-grid">
      <!-- ── 1. GPU Card (Asus ROG Astral OC 5090) ── -->
      <div class="glass-card hardware-card gpu-card">
        <div class="card-top">
          <div class="card-title-group">
            <div class="hardware-icon gpu-icon">⚡</div>
            <div>
              <div class="hardware-name">{{ gpu.customName || 'Asus ROG Astral OC 5090' }}</div>
              <div class="hardware-sub">{{ gpu.name || 'NVIDIA GeForce RTX 5090' }} · 32GB</div>
            </div>
          </div>
          <span class="status-pill" :class="gpu.gpuUtil > 80 ? 'pill-high' : 'pill-normal'">
            {{ gpu.gpuUtil }}% GPU Load
          </span>
        </div>

        <!-- VRAM Usage Progress -->
        <div class="metric-block">
          <div class="metric-row">
            <span class="metric-label">VRAM Usage</span>
            <span class="metric-val-main">
              <strong class="highlight-val">{{ gpu.vramUsedGB }} GB</strong>
              <span class="total-text"> / {{ gpu.vramTotalGB }} GB</span>
              <span class="pct-badge" :class="getLoadClass(gpu.vramPercent)">{{ gpu.vramPercent }}%</span>
            </span>
          </div>
          <div class="meter-track">
            <div
              class="meter-fill vram-fill"
              :style="{ width: `${Math.min(100, gpu.vramPercent)}%` }"
            />
          </div>
        </div>

        <!-- GPU Key Specs Grid -->
        <div class="specs-grid">
          <div class="spec-cell">
            <span class="spec-label">GPU Core Usage</span>
            <span class="spec-val" :style="{ color: getLoadColor(gpu.gpuUtil) }">{{ gpu.gpuUtil }}%</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Power Usage</span>
            <span class="spec-val text-amber">
              {{ gpu.powerDrawW }} W
              <span class="sub-unit">/ {{ gpu.powerLimitW }}W</span>
            </span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">GPU Temp</span>
            <span class="spec-val" :style="{ color: getTempColor(gpu.tempC) }">{{ gpu.tempC }}°C</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Fan Speed</span>
            <span class="spec-val text-muted">{{ gpu.fanPercent != null ? gpu.fanPercent + '%' : 'Auto' }}</span>
          </div>
        </div>
      </div>

      <!-- ── 2. CPU Card (AMD Ryzen 9 9950X) ── -->
      <div class="glass-card hardware-card cpu-card">
        <div class="card-top">
          <div class="card-title-group">
            <div class="hardware-icon cpu-icon">🧠</div>
            <div>
              <div class="hardware-name">{{ cpu.customName || 'AMD RYZEN 9950x' }}</div>
              <div class="hardware-sub">{{ cpu.cores }} Cores · {{ cpu.threads }} Threads (Zen 5)</div>
            </div>
          </div>
          <span class="status-pill" :class="cpu.loadPercent > 70 ? 'pill-high' : 'pill-normal'">
            {{ cpu.cores }}C / {{ cpu.threads }}T
          </span>
        </div>

        <!-- CPU Load Progress -->
        <div class="metric-block">
          <div class="metric-row">
            <span class="metric-label">CPU Total Load</span>
            <span class="metric-val-main">
              <strong class="highlight-val" :style="{ color: getLoadColor(cpu.loadPercent) }">
                {{ cpu.loadPercent }}%
              </strong>
              <span class="total-text"> ({{ cpu.threads }} threads)</span>
              <span class="pct-badge" :class="getLoadClass(cpu.loadPercent)">{{ getLoadStatusText(cpu.loadPercent) }}</span>
            </span>
          </div>
          <div class="meter-track">
            <div
              class="meter-fill cpu-fill"
              :style="{ width: `${Math.min(100, cpu.loadPercent)}%`, background: getLoadGradient(cpu.loadPercent) }"
            />
          </div>
        </div>

        <!-- CPU Key Specs Grid -->
        <div class="specs-grid">
          <div class="spec-cell">
            <span class="spec-label">CPU Temp (Tctl)</span>
            <span class="spec-val" :style="{ color: getTempColor(cpu.tempC) }">{{ cpu.tempC }}°C</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Power Consumption</span>
            <span class="spec-val text-amber">
              ~{{ cpu.powerW }} W
              <span class="sub-unit">/ {{ cpu.powerTdpW }}W TDP</span>
            </span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Cores & Threads</span>
            <span class="spec-val text-teal">16 Cores / 32 Threads</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Socket / Node</span>
            <span class="spec-val text-muted">AM5 · 4nm FinFET</span>
          </div>
        </div>
      </div>

      <!-- ── 3. RAM Card (G.Skill Trident Z DDR5 64 GB) ── -->
      <div class="glass-card hardware-card ram-card">
        <div class="card-top">
          <div class="card-title-group">
            <div class="hardware-icon ram-icon">💾</div>
            <div>
              <div class="hardware-name">{{ ram.customName || 'G.Skill Trident Z DDR5 64 GB' }}</div>
              <div class="hardware-sub">High-Speed DDR5 · 64GB Dual-Channel</div>
            </div>
          </div>
          <span class="status-pill pill-normal">
            {{ ram.usedPercent }}% Used
          </span>
        </div>

        <!-- RAM Filled Progress -->
        <div class="metric-block">
          <div class="metric-row">
            <span class="metric-label">Memory Filled</span>
            <span class="metric-val-main">
              <strong class="highlight-val text-cyan">{{ ram.usedGB }} GB</strong>
              <span class="total-text"> / {{ ram.totalGB }} GB</span>
              <span class="pct-badge pill-normal">{{ ram.usedPercent }}%</span>
            </span>
          </div>
          <div class="meter-track">
            <div
              class="meter-fill ram-fill"
              :style="{ width: `${Math.min(100, ram.usedPercent)}%` }"
            />
          </div>
        </div>

        <!-- RAM Key Specs Grid -->
        <div class="specs-grid">
          <div class="spec-cell">
            <span class="spec-label">Available Free RAM</span>
            <span class="spec-val text-cyan">{{ ram.availGB }} GB</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">DIMM 1 Temp</span>
            <span class="spec-val" :style="{ color: getTempColor(ram.dimmTemps?.[0] || 50) }">
              {{ ram.dimmTemps?.[0] ? ram.dimmTemps[0] + '°C' : '51.2°C' }}
            </span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">DIMM 2 Temp</span>
            <span class="spec-val" :style="{ color: getTempColor(ram.dimmTemps?.[1] || 50) }">
              {{ ram.dimmTemps?.[1] ? ram.dimmTemps[1] + '°C' : '51.5°C' }}
            </span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Configuration</span>
            <span class="spec-val text-muted">2x32GB Trident Z</span>
          </div>
        </div>
      </div>

      <!-- ── 4. Total Power & PSU Card (Cooler Master V Platinum 1600W) ── -->
      <div class="glass-card hardware-card psu-card">
        <div class="card-top">
          <div class="card-title-group">
            <div class="hardware-icon psu-icon">🔌</div>
            <div>
              <div class="hardware-name">{{ psu.customName || 'Cooler Master V Platinum 1600W' }}</div>
              <div class="hardware-sub">{{ psu.spec || 'ATX 3.1 · 80+ Platinum' }} · 1600W</div>
            </div>
          </div>
          <span class="status-pill pill-sweet-spot">
            {{ psu.loadPercent }}% PSU Load
          </span>
        </div>

        <!-- Total Power Meter -->
        <div class="metric-block">
          <div class="metric-row">
            <span class="metric-label">Total System Power</span>
            <span class="metric-val-main">
              <strong class="highlight-val text-yellow">~{{ psu.wallPowerW }} W</strong>
              <span class="total-text"> (Wall AC)</span>
              <span class="pct-badge pill-normal">{{ psu.efficiencyPct }}% Eff</span>
            </span>
          </div>
          <div class="meter-track">
            <div
              class="meter-fill psu-fill"
              :style="{ width: `${Math.min(100, (psu.wallPowerW / psu.capacityW) * 100)}%` }"
            />
          </div>
        </div>

        <!-- Power Breakdown Grid -->
        <div class="specs-grid">
          <div class="spec-cell">
            <span class="spec-label">GPU Draw (5090)</span>
            <span class="spec-val text-teal">{{ psu.gpuPowerW }} W</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">CPU Draw (9950X)</span>
            <span class="spec-val text-amber">{{ psu.cpuPowerW }} W</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">Platform (AIO/RAM)</span>
            <span class="spec-val text-cyan">{{ psu.platformPowerW }} W</span>
          </div>
          <div class="spec-cell">
            <span class="spec-label">PSU Headroom</span>
            <span class="spec-val text-green">{{ psu.headroomW }} W Free</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '@/stores/metrics'

const store = useMetricsStore()

const metrics = computed(() => store.systemMetrics)

// Fallback defaults if metrics are still initializing
const gpu = computed(() => {
  return metrics.value?.gpu || {
    name: 'NVIDIA GeForce RTX 5090',
    customName: 'Asus ROG Astral OC 5090',
    vramUsedGB: 30.3,
    vramTotalGB: 31.8,
    vramPercent: 95.3,
    powerDrawW: 430,
    powerLimitW: 450,
    gpuUtil: 100,
    tempC: 62,
    fanPercent: 58
  }
})

const cpu = computed(() => {
  return metrics.value?.cpu || {
    name: 'AMD Ryzen 9 9950X',
    customName: 'AMD RYZEN 9950x',
    cores: 16,
    threads: 32,
    loadPercent: 6.5,
    tempC: 68.2,
    powerW: 52,
    powerTdpW: 170
  }
})

const ram = computed(() => {
  return metrics.value?.ram || {
    name: 'G.Skill Trident Z DDR5',
    customName: 'G.Skill Trident Z DDR5 64 GB',
    totalGB: 60.4,
    usedGB: 14.5,
    availGB: 45.9,
    usedPercent: 24.0,
    dimmTemps: [51.5, 51.3]
  }
})

const psu = computed(() => {
  return metrics.value?.psu || {
    name: 'Cooler Master V Platinum 1600W V2',
    customName: 'Cooler Master V Platinum 1600W',
    spec: 'ATX 3.1 · 80 PLUS Platinum',
    capacityW: 1600,
    wallPowerW: 600,
    dcPowerW: 555,
    gpuPowerW: 445,
    cpuPowerW: 52,
    platformPowerW: 58,
    efficiencyPct: 92.5,
    loadPercent: 37.5,
    headroomW: 1000
  }
})

const updateTime = computed(() => {
  if (!metrics.value?.timestamp) return 'Live'
  return new Date(metrics.value.timestamp).toLocaleTimeString()
})

function getLoadClass(pct) {
  if (pct >= 85) return 'pill-high'
  if (pct >= 60) return 'pill-warn'
  return 'pill-normal'
}

function getLoadStatusText(pct) {
  if (pct >= 85) return 'Heavy'
  if (pct >= 50) return 'Active'
  if (pct >= 15) return 'Moderate'
  return 'Idle'
}

function getLoadColor(pct) {
  if (pct >= 85) return '#ef4444'
  if (pct >= 60) return '#f59e0b'
  if (pct >= 20) return '#00d4aa'
  return '#7c6ff7'
}

function getLoadGradient(pct) {
  if (pct >= 85) return 'linear-gradient(90deg, #f59e0b, #ef4444)'
  if (pct >= 50) return 'linear-gradient(90deg, #00d4aa, #f59e0b)'
  return 'linear-gradient(90deg, #7c6ff7, #00d4aa)'
}

function getTempColor(c) {
  if (c >= 80) return '#ef4444'
  if (c >= 70) return '#f59e0b'
  if (c >= 55) return '#00d4aa'
  return '#38bdf8'
}
</script>

<style scoped>
.system-info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sys-badge {
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.25);
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 20px;
  padding: 2px 8px;
  margin-left: 4px;
}

.telemetry-time {
  font-size: 0.68rem;
  color: var(--color-text-subtle);
  font-family: var(--font-mono, monospace);
}

.system-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, 1fr);
  align-items: stretch;
}

@media (max-width: 768px) {
  .system-grid {
    grid-template-columns: 1fr;
  }
}

.hardware-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(18, 22, 34, 0.65);
  border-radius: 12px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.gpu-card:hover {
  border-color: rgba(16, 185, 129, 0.25);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.08);
}

.cpu-card:hover {
  border-color: rgba(245, 158, 11, 0.25);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.08);
}

.ram-card:hover {
  border-color: rgba(6, 182, 212, 0.25);
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.08);
}

.psu-card:hover {
  border-color: rgba(234, 179, 8, 0.25);
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.08);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hardware-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.gpu-icon {
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
  border: 1px solid rgba(0, 212, 170, 0.25);
}

.cpu-icon {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.ram-icon {
  background: rgba(6, 182, 212, 0.12);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.psu-icon {
  background: rgba(234, 179, 8, 0.12);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.hardware-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.hardware-sub {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.status-pill {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 12px;
  font-family: var(--font-mono, monospace);
  white-space: nowrap;
}

.pill-normal {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pill-sweet-spot {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.pill-warn {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.pill-high {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Metric block with Progress Meter */
.metric-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: 10px 12px;
  border-radius: 8px;
}

.metric-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.metric-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.metric-val-main {
  font-family: var(--font-mono, monospace);
  font-size: 0.85rem;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.highlight-val {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--color-text);
}

.total-text {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.pct-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 6px;
  margin-left: 4px;
}

.meter-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.vram-fill {
  background: linear-gradient(90deg, #10b981, #00d4aa);
  box-shadow: 0 0 8px rgba(0, 212, 170, 0.4);
}

.ram-fill {
  background: linear-gradient(90deg, #38bdf8, #06b6d4);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
}

.psu-fill {
  background: linear-gradient(90deg, #10b981, #eab308);
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.4);
}

/* Specs Grid */
.specs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 12px;
  padding-top: 4px;
}

.spec-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec-label {
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  font-weight: 600;
}

.spec-val {
  font-size: 0.84rem;
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--color-text);
}

.sub-unit {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
  font-weight: 500;
}

.text-amber { color: #f59e0b; }
.text-yellow { color: #eab308; }
.text-teal { color: #00d4aa; }
.text-cyan { color: #06b6d4; }
.text-green { color: #10b981; }
.text-muted { color: var(--color-text-muted); }
</style>
