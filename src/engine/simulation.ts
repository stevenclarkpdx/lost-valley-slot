import { spinBaseGame } from './baseGame'
import { playFeatureToCompletion } from './featureEngine'
import { createSeededRng } from './rng'
import { SYMBOLS, type GameConfig, type SimulationResult, type SymbolId } from './types'

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil(fraction * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export function runSimulation(
  config: GameConfig,
  spins: number,
  seed: number,
): SimulationResult {
  const rng = createSeededRng(seed)
  const featureWins: number[] = []
  const footprintCounts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 }
  const clusterCounts: Record<string, number> = {}
  const clusterSizes = { '4': 0, '5': 0, '6': 0, '7': 0, '8+': 0 }
  const symbolCounts = Object.fromEntries(
    SYMBOLS.map((symbol) => [symbol, 0]),
  ) as Record<SymbolId, number>
  const revealCounts: Record<string, number> = {}
  const evidenceUniqueCounts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  const evidenceMilestoneCounts = { '3': 0, '4': 0, '5': 0 }
  const evidencePaidByMilestone = { '3': 0, '4': 0, '5': 0 }
  const baseWins: number[] = []
  let basePaid = 0
  let evidencePaid = 0
  let featurePaid = 0
  let evidenceBonusHits = 0
  let totalClusters = 0
  let fullReveals = 0
  let wildAssistedClusterHits = 0
  let goldenAmberClusterHits = 0
  let twoFootprintHits = 0
  let baseWinsOver10 = 0
  let largestBaseGameHit = 0

  for (let index = 0; index < spins; index += 1) {
    const base = spinBaseGame(config, rng)
    basePaid += base.clusterWin
    evidencePaid += base.fieldNotes.bonus
    if (base.fieldNotes.milestone !== null) {
      const milestone = String(base.fieldNotes.milestone) as keyof typeof evidenceMilestoneCounts
      evidenceMilestoneCounts[milestone] += 1
      evidencePaidByMilestone[milestone] += base.fieldNotes.bonus
    }
    baseWins.push(base.baseWin)
    if (base.baseWin > 10) baseWinsOver10 += 1
    if (base.baseWin > largestBaseGameHit) largestBaseGameHit = base.baseWin
    if (base.fieldNotes.bonus > 0) evidenceBonusHits += 1
    evidenceUniqueCounts[
      String(base.fieldNotes.uniqueEvidence.length) as keyof typeof evidenceUniqueCounts
    ] += 1
    const footprintBucket = base.footprintCount >= 5 ? '5+' : String(base.footprintCount)
    footprintCounts[footprintBucket as keyof typeof footprintCounts] += 1
    if (base.footprintCount === 2) twoFootprintHits += 1
    const clusterCountBucket = String(base.clusterWins.length)
    clusterCounts[clusterCountBucket] = (clusterCounts[clusterCountBucket] ?? 0) + 1
    totalClusters += base.clusterWins.length
    if (base.clusterWins.some((cluster) => cluster.wildAssisted)) {
      wildAssistedClusterHits += 1
    }
    if (base.clusterWins.some((cluster) => cluster.symbol === 'goldenAmber')) {
      goldenAmberClusterHits += 1
    }
    for (const cluster of base.clusterWins) {
      const sizeBucket = cluster.size >= 8 ? '8+' : String(cluster.size)
      clusterSizes[sizeBucket as keyof typeof clusterSizes] += 1
    }
    for (const symbol of base.board.flat()) {
      symbolCounts[symbol] += 1
    }

    if (base.featureTriggered) {
      const feature = playFeatureToCompletion(
        config.featureProfile,
        rng,
        base.featureStartingRespins,
      )
      featureWins.push(feature.totalWin)
      featurePaid += feature.totalWin
      const revealed = feature.tiles.filter((tile) => tile !== null).length
      revealCounts[String(revealed)] = (revealCounts[String(revealed)] ?? 0) + 1
      if (feature.fullyRevealed) fullReveals += 1
    }
  }

  featureWins.sort((a, b) => a - b)
  baseWins.sort((a, b) => a - b)
  const triggers = featureWins.length
  const normalize = (
    counts: Record<string, number>,
    denominator: number,
  ): Record<string, number> =>
    Object.fromEntries(
      Object.entries(counts)
        .sort(([first], [second]) => {
          const firstNumber = Number.parseInt(first)
          const secondNumber = Number.parseInt(second)
          return firstNumber - secondNumber
        })
        .map(([key, count]) => [key, denominator === 0 ? 0 : count / denominator]),
    )

  return {
    seed,
    spins,
    triggers,
    triggerFrequency: triggers / spins,
    averageFeatureWin: triggers === 0 ? 0 : featurePaid / triggers,
    baseRtp: basePaid / spins,
    evidenceRtp: evidencePaid / spins,
    evidenceRtpByMilestone: {
      '3': evidencePaidByMilestone['3'] / spins,
      '4': evidencePaidByMilestone['4'] / spins,
      '5': evidencePaidByMilestone['5'] / spins,
    },
    featureRtp: featurePaid / spins,
    totalRtp: (basePaid + evidencePaid + featurePaid) / spins,
    evidenceBonusFrequency: evidenceBonusHits / spins,
    evidenceMilestoneFrequency: normalize(evidenceMilestoneCounts, spins) as Record<
      '3' | '4' | '5',
      number
    >,
    evidenceUniqueDistribution: normalize(evidenceUniqueCounts, spins) as Record<
      '0' | '1' | '2' | '3' | '4' | '5',
      number
    >,
    averageEvidenceBonus:
      evidenceBonusHits === 0 ? 0 : evidencePaid / evidenceBonusHits,
    percentiles: {
      p50: percentile(featureWins, 0.5),
      p90: percentile(featureWins, 0.9),
      p99: percentile(featureWins, 0.99),
    },
    footprintDistribution: normalize(footprintCounts, spins),
    clusterCountDistribution: normalize(clusterCounts, spins),
    clusterSizeDistribution: normalize(clusterSizes, totalClusters),
    symbolFrequencyDistribution: normalize(
      symbolCounts,
      spins * config.boardSize * config.boardSize,
    ) as Record<SymbolId, number>,
    finalRevealDistribution: normalize(revealCounts, triggers),
    fullRevealRate: triggers === 0 ? 0 : fullReveals / triggers,
    totalClusters,
    wildAppearanceRate: symbolCounts.campWild / (spins * config.boardSize * config.boardSize),
    wildAssistedClusterFrequency: wildAssistedClusterHits / spins,
    goldenAmberHitFrequency: goldenAmberClusterHits / spins,
    twoFootprintFrequency: twoFootprintHits / spins,
    baseWinsOver10Frequency: baseWinsOver10 / spins,
    largestBaseGameHit,
    baseWinPercentiles: {
      p95: percentile(baseWins, 0.95),
      p99: percentile(baseWins, 0.99),
    },
  }
}
