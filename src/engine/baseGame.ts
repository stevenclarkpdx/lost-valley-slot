import type {
  BaseSpinResult,
  Board,
  EvidenceSymbolId,
  FieldNotesResult,
  GameConfig,
  SymbolId,
} from './types'
import type { FeatureProfile } from './featureTypes'
import type { Rng } from './rng'
import { calculateClusterWins, EVIDENCE_SYMBOLS } from './payouts'
import { getFeatureProfiles, getFeatureTriggerSymbol } from './featureProfiles'

function pickSymbol(config: GameConfig, rng: Rng): SymbolId {
  const totalWeight = config.symbolWeights.reduce((sum, item) => sum + item.weight, 0)
  let roll = rng.next() * totalWeight
  for (const item of config.symbolWeights) {
    roll -= item.weight
    if (roll < 0) return item.symbol
  }
  return config.symbolWeights[config.symbolWeights.length - 1].symbol
}

export function countFootprints(board: Board): number {
  return board.flat().filter((symbol) => symbol === 'footprint').length
}

export function countSymbol(board: Board, symbol: SymbolId): number {
  return board.flat().filter((cell) => cell === symbol).length
}

export function isFeatureTriggered(board: Board): boolean {
  return countFootprints(board) >= 3
}

export function getFeatureStartingRespins(footprintCount: number, baseRespins: number): number {
  if (footprintCount >= 5) return baseRespins + 2
  if (footprintCount === 4) return baseRespins + 1
  return baseRespins
}

export function resolveTriggeredFeature(
  board: Board,
  config: GameConfig,
): {
  triggerCounts: Record<string, number>
  profile: FeatureProfile | null
  count: number
  startingRespins: number
} {
  const profiles = getFeatureProfiles(config)
  const triggerCounts = Object.fromEntries(
    profiles.map((profile) => [profile.id, countSymbol(board, getFeatureTriggerSymbol(profile))]),
  )

  const profile =
    profiles.find((candidate) => triggerCounts[candidate.id] >= 3) ?? null
  const count = profile ? triggerCounts[profile.id] : 0
  return {
    triggerCounts,
    profile,
    count,
    startingRespins: profile
      ? getFeatureStartingRespins(count, profile.startingRespins)
      : 0,
  }
}

export function calculateFieldNotes(board: Board, config: GameConfig): FieldNotesResult {
  const boardSymbols = new Set(board.flat())
  const uniqueEvidence = EVIDENCE_SYMBOLS.filter((symbol) =>
    boardSymbols.has(symbol),
  ) as EvidenceSymbolId[]
  const uniqueCount = uniqueEvidence.length
  const milestone = uniqueCount >= 5 ? 5 : uniqueCount >= 4 ? 4 : uniqueCount >= 3 ? 3 : null
  const nextMilestone = uniqueCount < 3 ? 3 : uniqueCount < 4 ? 4 : uniqueCount < 5 ? 5 : null
  const remainingToNextMilestone =
    nextMilestone === null ? 0 : Math.max(0, nextMilestone - uniqueCount)
  const bonus = milestone === null ? 0 : config.fieldNotesPays[milestone]
  const nextMilestoneReward = nextMilestone === null ? 0 : config.fieldNotesPays[nextMilestone]

  return {
    uniqueEvidence,
    bonus,
    milestone,
    milestoneReward: bonus,
    nextMilestone,
    nextMilestoneReward,
    remainingToNextMilestone,
  }
}

export function spinBaseGame(config: GameConfig, rng: Rng): BaseSpinResult {
  const board: Board = Array.from({ length: config.boardSize }, () =>
    Array.from({ length: config.boardSize }, () => pickSymbol(config, rng)),
  )
  const footprintCount = countFootprints(board)
  const predatorTrackCount = countSymbol(board, 'predatorTracks')
  const nestingEggCount = countSymbol(board, 'nestingEggs')
  const triggered = resolveTriggeredFeature(board, config)
  const payout = calculateClusterWins(board, config)
  const fieldNotes = calculateFieldNotes(board, config)

  return {
    board,
    footprintCount,
    predatorTrackCount,
    nestingEggCount,
    triggerCounts: triggered.triggerCounts,
    featureTriggered: triggered.profile !== null,
    triggeredFeatureId: triggered.profile?.id ?? null,
    triggeredFeatureName: triggered.profile?.displayName ?? null,
    featureStartingRespins: triggered.startingRespins,
    clusterWins: payout.wins,
    clusterWin: payout.total,
    fieldNotes,
    baseWin: payout.total + fieldNotes.bonus,
  }
}
