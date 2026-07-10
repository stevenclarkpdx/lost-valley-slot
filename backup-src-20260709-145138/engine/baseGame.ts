import type {
  BaseSpinResult,
  Board,
  EvidenceSymbolId,
  FieldNotesResult,
  GameConfig,
  SymbolId,
} from './types'
import type { Rng } from './rng'
import { calculateClusterWins, EVIDENCE_SYMBOLS } from './payouts'

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

export function isFeatureTriggered(board: Board): boolean {
  return countFootprints(board) >= 3
}

export function getFeatureStartingRespins(footprintCount: number, baseRespins: number): number {
  if (footprintCount >= 5) return baseRespins + 2
  if (footprintCount === 4) return baseRespins + 1
  return baseRespins
}

export function calculateFieldNotes(board: Board): FieldNotesResult {
  const boardSymbols = new Set(board.flat())
  const uniqueEvidence = EVIDENCE_SYMBOLS.filter((symbol) =>
    boardSymbols.has(symbol),
  ) as EvidenceSymbolId[]
  const bonus =
    uniqueEvidence.length >= 5
      ? 50
      : uniqueEvidence.length === 4
        ? 15
        : uniqueEvidence.length === 3
          ? 5
          : 0
  return { uniqueEvidence, bonus }
}

export function spinBaseGame(config: GameConfig, rng: Rng): BaseSpinResult {
  const board: Board = Array.from({ length: config.boardSize }, () =>
    Array.from({ length: config.boardSize }, () => pickSymbol(config, rng)),
  )
  const footprintCount = countFootprints(board)
  const payout = calculateClusterWins(board, config)
  const fieldNotes = calculateFieldNotes(board)

  return {
    board,
    footprintCount,
    featureTriggered: footprintCount >= 3,
    featureStartingRespins: getFeatureStartingRespins(
      footprintCount,
      config.featureProfile.startingRespins,
    ),
    clusterWins: payout.wins,
    clusterWin: payout.total,
    fieldNotes,
    baseWin: payout.total + fieldNotes.bonus,
  }
}
