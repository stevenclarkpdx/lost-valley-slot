import type { TileRarity } from './engine/featureTypes'

type AudioVoice = AudioBufferSourceNode | OscillatorNode
type WinTier = 'dead' | 'tiny' | 'small' | 'medium' | 'large'

const masterVolume = 0.36

function createNoiseBuffer(context: AudioContext, duration = 1) {
  const buffer = context.createBuffer(1, Math.max(1, context.sampleRate * duration), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  return buffer
}

function stopVoice(voice: AudioVoice | null) {
  if (!voice) return
  try {
    voice.stop()
  } catch {
    // Already stopped.
  }
}

export class LostValleyAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: AudioBufferSourceNode | null = null
  private ambientGain: GainNode | null = null
  private muted = false
  private started = false
  private chirpTimer: number | null = null

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : masterVolume, this.now(), 0.03)
    if (muted) this.stopAmbience()
    else if (this.started) void this.startAmbience()
  }

  async unlock() {
    if (this.muted) return
    this.ensureContext()
    if (!this.context) return
    if (this.context.state !== 'running') await this.context.resume()
    this.started = true
    await this.startAmbience()
  }

  dispose() {
    this.stopAmbience()
    this.context?.close().catch(() => undefined)
    this.context = null
    this.master = null
    this.started = false
  }

  spinStart() {
    if (!this.isReady()) return
    this.noiseSweep(0.42, 260, 95, 0.09, 'lowpass')
    this.tone(58, 0.2, 'sawtooth', 0.035, 0.005)
  }

  reelStop(reelIndex: number) {
    if (!this.isReady()) return
    this.tone(120 + reelIndex * 18, 0.055, 'triangle', 0.035, 0.004)
    this.noiseBurst(0.035, 900, 0.025)
  }

  anticipation() {
    if (!this.isReady()) return
    this.tone(74, 0.42, 'sine', 0.045, 0.02)
    this.noiseSweep(0.36, 180, 70, 0.035, 'lowpass')
  }

  clusterWin(tier: WinTier) {
    if (!this.isReady() || tier === 'dead') return
    const tierScale: Record<WinTier, number> = {
      dead: 0,
      tiny: 0.55,
      small: 0.72,
      medium: 1,
      large: 1.32,
    }
    const scale = tierScale[tier]
    this.tone(220, 0.1 * scale, 'triangle', 0.035 * scale, 0.005)
    this.tone(330, 0.14 * scale, 'triangle', 0.025 * scale, 0.055)
    if (tier === 'medium' || tier === 'large') this.noiseBurst(0.12, 1500, 0.035)
  }

  evidence(count: number, bonus: number) {
    if (!this.isReady() || count <= 0) return
    const volume = bonus > 0 ? 0.055 : 0.032
    for (let index = 0; index < Math.min(count, 5); index += 1) {
      this.tone(420 + index * 55, 0.055, 'sine', volume, index * 0.065)
    }
    if (bonus > 0) this.tone(290, 0.28, 'triangle', 0.04, 0.26)
  }

  featureTrigger(kind: 'standard' | 'predator' | 'lost' = 'standard') {
    if (!this.isReady()) return
    const predator = kind === 'predator'
    const lost = kind === 'lost'
    this.noiseSweep(lost ? 1.45 : 1.15, predator ? 520 : lost ? 680 : 360, predator ? 90 : lost ? 42 : 55, lost ? 0.095 : 0.08, 'lowpass')
    this.tone(predator ? 52 : lost ? 47 : 62, lost ? 1.15 : 0.9, 'sawtooth', lost ? 0.075 : 0.06, 0)
    this.tone(predator ? 130 : lost ? 196 : 174, lost ? 0.8 : 0.55, 'triangle', lost ? 0.052 : 0.04, 0.25)
    if (lost) this.tone(392, 0.55, 'sine', 0.035, 0.68)
  }

  featureSurvey() {
    if (!this.isReady()) return
    this.noiseSweep(0.28, 900, 240, 0.04, 'bandpass')
    this.tone(118, 0.12, 'triangle', 0.025, 0.02)
  }

  featureReveal(rarity: TileRarity = 'common') {
    if (!this.isReady()) return
    const rarityLift: Record<TileRarity, number> = {
      common: 0,
      uncommon: 35,
      rare: 82,
      legendary: 160,
    }
    const lift = rarityLift[rarity]
    this.noiseBurst(rarity === 'common' ? 0.055 : 0.11, 1800 + lift * 4, 0.026)
    this.tone(250 + lift, 0.12, 'sine', 0.032, 0.02)
    if (rarity === 'rare' || rarity === 'legendary') {
      this.tone(375 + lift, 0.22, 'triangle', 0.04, 0.12)
    }
  }

  featureMiss() {
    if (!this.isReady()) return
    this.noiseSweep(0.18, 260, 110, 0.025, 'lowpass')
    this.tone(82, 0.12, 'sine', 0.018, 0.02)
  }

  featureComplete() {
    if (!this.isReady()) return
    this.tone(164, 0.22, 'triangle', 0.035, 0)
    this.tone(246, 0.28, 'triangle', 0.035, 0.12)
    this.tone(328, 0.36, 'sine', 0.04, 0.24)
  }

  private ensureContext() {
    if (this.context) return
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const master = context.createGain()
    master.gain.value = this.muted ? 0 : masterVolume
    master.connect(context.destination)
    this.context = context
    this.master = master
  }

  private isReady() {
    if (this.muted) return false
    this.ensureContext()
    return Boolean(this.context && this.master && this.context.state === 'running')
  }

  private now() {
    return this.context?.currentTime ?? 0
  }

  private output() {
    this.ensureContext()
    return { context: this.context, master: this.master }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const { context, master } = this.output()
    if (!context || !master) return
    const startedAt = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startedAt)
    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), startedAt + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(startedAt)
    oscillator.stop(startedAt + duration + 0.03)
  }

  private noiseBurst(duration: number, frequency: number, volume: number) {
    const { context, master } = this.output()
    if (!context || !master) return
    const startedAt = context.currentTime
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = createNoiseBuffer(context, duration)
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = 1.5
    gain.gain.setValueAtTime(volume, startedAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(startedAt)
    source.stop(startedAt + duration + 0.02)
  }

  private noiseSweep(
    duration: number,
    fromFrequency: number,
    toFrequency: number,
    volume: number,
    filterType: BiquadFilterType,
  ) {
    const { context, master } = this.output()
    if (!context || !master) return
    const startedAt = context.currentTime
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = createNoiseBuffer(context, duration)
    filter.type = filterType
    filter.frequency.setValueAtTime(fromFrequency, startedAt)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, toFrequency), startedAt + duration)
    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(volume, startedAt + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(startedAt)
    source.stop(startedAt + duration + 0.02)
  }

  private async startAmbience() {
    if (this.muted || this.ambient) return
    this.ensureContext()
    if (!this.context || !this.master) return
    const context = this.context
    if (context.state !== 'running') return
    const source = context.createBufferSource()
    const lowpass = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = createNoiseBuffer(context, 2.2)
    source.loop = true
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 520
    gain.gain.value = 0.015
    source.connect(lowpass)
    lowpass.connect(gain)
    gain.connect(this.master)
    source.start()
    this.ambient = source
    this.ambientGain = gain
    this.scheduleChirps()
  }

  private stopAmbience() {
    stopVoice(this.ambient)
    this.ambient = null
    this.ambientGain = null
    if (this.chirpTimer !== null) {
      window.clearTimeout(this.chirpTimer)
      this.chirpTimer = null
    }
  }

  private scheduleChirps() {
    if (this.muted || this.chirpTimer !== null) return
    const tick = () => {
      this.chirpTimer = null
      if (!this.isReady()) return
      const pitch = 1600 + Math.random() * 900
      this.tone(pitch, 0.04, 'sine', 0.01, 0)
      this.tone(pitch * 1.16, 0.035, 'sine', 0.008, 0.055)
      this.chirpTimer = window.setTimeout(tick, 3500 + Math.random() * 4500)
    }
    this.chirpTimer = window.setTimeout(tick, 2500 + Math.random() * 3500)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
