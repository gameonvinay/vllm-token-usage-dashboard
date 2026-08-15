import { execSync } from 'node:child_process'
import fs from 'node:fs'

let prevCpu = null

function getCpuLoad() {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf8')
    const line = stat.split('\n')[0]
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    const idle = parts[3] + (parts[4] || 0)
    const total = parts.reduce((a, b) => a + b, 0)

    let load = 0
    if (prevCpu) {
      const idleDelta = idle - prevCpu.idle
      const totalDelta = total - prevCpu.total
      if (totalDelta > 0) {
        load = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100))
      }
    }
    prevCpu = { idle, total }
    return Math.round(load * 10) / 10
  } catch {
    return 0
  }
}

export function getSystemMetrics() {
  const start = Date.now()

  // 1. GPU (NVIDIA GeForce RTX 5090 / Asus ROG Astral OC)
  let gpu = {
    name: 'NVIDIA GeForce RTX 5090',
    customName: 'Asus ROG Astral OC 5090',
    vramUsedMB: 0,
    vramTotalMB: 32768,
    vramUsedGB: 0,
    vramTotalGB: 32,
    vramPercent: 0,
    powerDrawW: 0,
    powerLimitW: 600,
    gpuUtil: 0,
    tempC: 0,
    fanPercent: 0,
    isAvailable: false
  }

  try {
    const out = execSync(
      'nvidia-smi --query-gpu=name,memory.used,memory.total,power.draw,power.limit,utilization.gpu,temperature.gpu,fan.speed --format=csv,noheader,nounits',
      { timeout: 1500 }
    ).toString().trim()

    const [name, used, total, power, limit, util, temp, fan] = out.split(',').map(s => s.trim())
    const usedMB = parseFloat(used) || 0
    const totalMB = parseFloat(total) || 32768

    gpu = {
      name: name || 'NVIDIA GeForce RTX 5090',
      customName: 'Asus ROG Astral OC 5090',
      vramUsedMB: Math.round(usedMB),
      vramTotalMB: Math.round(totalMB),
      vramUsedGB: Math.round((usedMB / 1024) * 10) / 10,
      vramTotalGB: Math.round((totalMB / 1024) * 10) / 10,
      vramPercent: Math.round((usedMB / totalMB) * 1000) / 10,
      powerDrawW: Math.round(parseFloat(power) || 0),
      powerLimitW: Math.round(parseFloat(limit) || 600),
      gpuUtil: Math.round(parseFloat(util) || 0),
      tempC: Math.round(parseFloat(temp) || 0),
      fanPercent: fan && fan !== '[N/A]' ? Math.round(parseFloat(fan)) : null,
      isAvailable: true
    }
  } catch (e) {
    gpu.error = e.message
  }

  // 2. CPU (AMD Ryzen 9 9950X - 16 Cores / 32 Threads)
  let cpuTemp = null
  try {
    const hwmons = fs.readdirSync('/sys/class/hwmon')
    for (const d of hwmons) {
      try {
        const name = fs.readFileSync(`/sys/class/hwmon/${d}/name`, 'utf8').trim()
        if (name.includes('k10temp')) {
          const t1 = `/sys/class/hwmon/${d}/temp1_input`
          const t3 = `/sys/class/hwmon/${d}/temp3_input`
          if (fs.existsSync(t1)) {
            cpuTemp = Math.round(parseInt(fs.readFileSync(t1, 'utf8').trim()) / 100) / 10
            break
          } else if (fs.existsSync(t3)) {
            cpuTemp = Math.round(parseInt(fs.readFileSync(t3, 'utf8').trim()) / 100) / 10
            break
          }
        }
      } catch {}
    }
  } catch {}

  const cpuLoad = getCpuLoad()
  // Power consumption estimation for Ryzen 9 9950X (base ~42W SoC + load curve up to 170W-220W PPT)
  const cpuPower = Math.round(42 + (cpuLoad / 100) * 165)

  const cpu = {
    name: 'AMD Ryzen 9 9950X',
    customName: 'AMD RYZEN 9950x',
    cores: 16,
    threads: 32,
    loadPercent: cpuLoad,
    tempC: cpuTemp || 55,
    powerW: cpuPower,
    powerTdpW: 170
  }

  // 3. RAM (G.Skill Trident Z DDR5 64 GB)
  let ram = {
    name: 'G.Skill Trident Z DDR5',
    customName: 'G.Skill Trident Z DDR5 64 GB',
    totalGB: 64,
    usedGB: 0,
    availGB: 0,
    usedPercent: 0,
    dimmTemps: []
  }

  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8')
    let totalKB = 0
    let availKB = 0
    for (const line of meminfo.split('\n')) {
      if (line.startsWith('MemTotal:')) totalKB = parseInt(line.split(/\s+/)[1])
      if (line.startsWith('MemAvailable:')) availKB = parseInt(line.split(/\s+/)[1])
    }
    const usedKB = totalKB - availKB
    const totalGB = Math.round((totalKB / 1048576) * 10) / 10
    const usedGB = Math.round((usedKB / 1048576) * 10) / 10
    const availGB = Math.round((availKB / 1048576) * 10) / 10
    const pct = totalKB ? Math.round((usedKB / totalKB) * 1000) / 10 : 0

    // DDR5 RAM temperatures from spd5118 sensors
    const hwmons = fs.readdirSync('/sys/class/hwmon')
    const dimmTemps = []
    for (const d of hwmons) {
      try {
        const name = fs.readFileSync(`/sys/class/hwmon/${d}/name`, 'utf8').trim()
        if (name.includes('spd5118')) {
          const t = `/sys/class/hwmon/${d}/temp1_input`
          if (fs.existsSync(t)) {
            dimmTemps.push(Math.round(parseInt(fs.readFileSync(t, 'utf8').trim()) / 100) / 10)
          }
        }
      } catch {}
    }

    ram = {
      name: 'G.Skill Trident Z DDR5',
      customName: 'G.Skill Trident Z DDR5 64 GB',
      totalGB,
      usedGB,
      availGB,
      usedPercent: pct,
      dimmTemps
    }
  } catch (e) {
    ram.error = e.message
  }

  // 4. Total System Power & PSU (Cooler Master V Platinum 1600W V2 ATX 3.1)
  const platformBaseW = 58 // Motherboard, X670/X870 chipsets, RAM, Kraken Elite AIO pump, CM ARGB, Fans, NVMe SSDs
  const totalDcW = (gpu.powerDrawW || 0) + (cpu.powerW || 0) + platformBaseW
  // Cooler Master V Platinum 1600W V2 operates at ~92.5% efficiency curve around 500-800W load
  const efficiency = 0.925
  const totalAcWallW = Math.round(totalDcW / efficiency)
  const psuCapacityW = 1600
  const psuLoadPct = Math.round((totalAcWallW / psuCapacityW) * 1000) / 10

  const psu = {
    name: 'Cooler Master V Platinum 1600W V2',
    customName: 'Cooler Master V Platinum 1600W',
    spec: 'ATX 3.1 · 80 PLUS Platinum',
    capacityW: psuCapacityW,
    wallPowerW: totalAcWallW,
    dcPowerW: totalDcW,
    gpuPowerW: gpu.powerDrawW || 0,
    cpuPowerW: cpu.powerW || 0,
    platformPowerW: platformBaseW,
    efficiencyPct: 92.5,
    loadPercent: psuLoadPct,
    headroomW: Math.max(0, psuCapacityW - totalAcWallW)
  }

  return {
    gpu,
    cpu,
    ram,
    psu,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - start
  }
}
