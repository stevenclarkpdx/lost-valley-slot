import { runSimulation } from './simulation'
import type { GameConfig, SimulationResult } from './types'

export interface TargetRange {
  min: number
  max: number
}

export interface TuningTargets {
  baseRtp: TargetRange
  featureRtp: TargetRange
  totalRtp: TargetRange
  triggerFrequency: TargetRange
  averageFeatureWin: TargetRange
  medianFeatureWin: TargetRange
  p99FeatureWin: TargetRange
}

export interface TuningSweepResult {
  name: string
  score: number
  config: GameConfig
  simulation: SimulationResult
  notes: string[]
}

export const DEFAULT_TUNING_TARGETS: TuningTargets = {
  baseRtp: { min: 0.25, max: 0.35 },
  featureRtp: { min: 0.45, max: 0.55 },
  totalRtp: { min: 0.9, max: 0.93 },
  triggerFrequency: { min: 1 / 110, max: 1 / 100 },
  averageFeatureWin: { min: 45, max: 70 },
  medianFeatureWin: { min: 15, max: 30 },
  p99FeatureWin: { min: 150, max: 300 },
}

function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig
}

function scaleClusterPays(config: GameConfig, lowScale: number, premiumScale: number) {
  config.clusterPays.low = config.clusterPays.low.map((value) =>
    roundTuningValue(value * lowScale),
  ) as GameConfig['clusterPays']['low']
  config.clusterPays.premium = config.clusterPays.premium.map((value) =>
    roundTuningValue(value * premiumScale),
  ) as GameConfig['clusterPays']['premium']
  config.clusterPays.goldenAmber = config.clusterPays.goldenAmber.map((value) =>
    roundTuningValue(value * premiumScale),
  ) as GameConfig['clusterPays']['goldenAmber']
}

function scaleTilePayouts(config: GameConfig, scale: number) {
  config.featureProfile.tileTable = config.featureProfile.tileTable.map((tile) => ({
    ...tile,
    payoutValue: Math.max(0, roundTuningValue(tile.payoutValue * scale)),
  }))
}

function roundTuningValue(value: number): number {
  return Math.round(value * 100) / 100
}

function metricScore(value: number, range: TargetRange): number {
  if (value >= range.min && value <= range.max) return 0
  const center = (range.min + range.max) / 2
  const halfWidth = Math.max((range.max - range.min) / 2, Math.abs(center) * 0.05, 0.0001)
  const distance = value < range.min ? range.min - value : value - range.max
  return distance / halfWidth
}

function scoreSimulation(simulation: SimulationResult, targets: TuningTargets): number {
  return (
    metricScore(simulation.baseRtp, targets.baseRtp) +
    metricScore(simulation.featureRtp, targets.featureRtp) +
    metricScore(simulation.totalRtp, targets.totalRtp) * 1.5 +
    metricScore(simulation.triggerFrequency, targets.triggerFrequency) +
    metricScore(simulation.averageFeatureWin, targets.averageFeatureWin) +
    metricScore(simulation.percentiles.p50, targets.medianFeatureWin) +
    metricScore(simulation.percentiles.p99, targets.p99FeatureWin)
  )
}

export function describeMetricStatus(value: number, range: TargetRange): 'under' | 'in' | 'over' {
  if (value < range.min) return 'under'
  if (value > range.max) return 'over'
  return 'in'
}

export function runTuningSweep(
  baseConfig: GameConfig,
  targets: TuningTargets,
  spins: number,
  seed: number,
): TuningSweepResult[] {
  const presets: Array<{
    name: string
    lowScale: number
    premiumScale: number
    footprintWeight: number
    hitProbability: number
    multiHitProbability: number
    tileScale: number
    completionReward: number
  }> = []

  presets.push({
    name: 'Current config',
    lowScale: 1,
    premiumScale: 1,
    footprintWeight:
      baseConfig.symbolWeights.find((entry) => entry.symbol === 'footprint')?.weight ?? 1.35,
    hitProbability: baseConfig.featureProfile.hitGeneration.hitProbability,
    multiHitProbability: baseConfig.featureProfile.hitGeneration.multiHitProbability,
    tileScale: 1,
    completionReward: baseConfig.featureProfile.completionReward,
  })

  for (const clusterScale of [0.75, 1, 1.5, 2, 3]) {
    for (const footprintWeight of [1, 1.2, 1.35, 1.5, 1.8]) {
      for (const hitProbability of [0.3, 0.36, 0.4, 0.45]) {
        for (const tileScale of [0.75, 1, 2, 4, 8]) {
            presets.push({
              name: `cluster ${clusterScale} · FP ${footprintWeight} · hit ${hitProbability} · tile ${tileScale}`,
              lowScale: clusterScale,
              premiumScale: clusterScale,
              footprintWeight,
              hitProbability,
              multiHitProbability: baseConfig.featureProfile.hitGeneration.multiHitProbability,
              tileScale,
              completionReward: baseConfig.featureProfile.completionReward,
            })
        }
      }
    }
  }

  return presets
    .map((preset, index) => {
      const config = cloneConfig(baseConfig)
      scaleClusterPays(config, preset.lowScale, preset.premiumScale)
      config.symbolWeights = config.symbolWeights.map((entry) =>
        entry.symbol === 'footprint'
          ? { ...entry, weight: Math.max(0.1, roundTuningValue(preset.footprintWeight)) }
          : entry,
      )
      config.featureProfile.hitGeneration.hitProbability = preset.hitProbability
      config.featureProfile.hitGeneration.multiHitProbability = preset.multiHitProbability
      config.featureProfile.completionReward = preset.completionReward
      scaleTilePayouts(config, preset.tileScale)

      const simulation = runSimulation(config, spins, seed + index)
      return {
        name: preset.name,
        score: scoreSimulation(simulation, targets),
        config,
        simulation,
        notes: [
          `Footprint weight ${config.symbolWeights.find((entry) => entry.symbol === 'footprint')?.weight}`,
          `Hit ${(preset.hitProbability * 100).toFixed(0)}%`,
          `Tiles x${preset.tileScale}`,
        ],
      }
    })
    .sort((first, second) => first.score - second.score)
    .slice(0, 8)
}
