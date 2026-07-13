export const SYMBOLS = [
  'trexTooth',
  'raptorClaw',
  'triceratopsEggshell',
  'pterosaurFeather',
  'sauropodHorn',
  'campWild',
  'goldenAmber',
  'compass',
  'pickaxe',
  'jeep',
  'helicopter',
  'scientist',
  'crate',
  'footprint',
  'predatorTracks',
  'nestingEggs',
] as const

export type SymbolId = (typeof SYMBOLS)[number]
export type Board = SymbolId[][]
export type EvidenceSymbolId = Extract<
  SymbolId,
  | 'trexTooth'
  | 'raptorClaw'
  | 'triceratopsEggshell'
  | 'pterosaurFeather'
  | 'sauropodHorn'
>
import type { FeatureProfile } from './featureTypes'

export interface WeightedSymbol {
  symbol: SymbolId
  weight: number
}

export interface GameConfig {
  boardSize: number
  symbolWeights: WeightedSymbol[]
  clusterPays: {
    gray: [number, number, number, number, number]
    brown: [number, number, number, number, number]
    green: [number, number, number, number, number]
    blue: [number, number, number, number, number]
    goldenAmber: [number, number, number, number, number]
  }
  fieldNotesPays: Record<3 | 4 | 5, number>
  featureProfiles: FeatureProfile[]
}

export interface CellPosition {
  row: number
  column: number
}

export interface ClusterWin {
  symbol: Exclude<SymbolId, 'footprint' | 'predatorTracks' | 'nestingEggs' | 'campWild'>
  size: number
  cells: CellPosition[]
  payout: number
  wildAssisted: boolean
}

export interface FieldNotesResult {
  uniqueEvidence: EvidenceSymbolId[]
  bonus: number
  milestone: 3 | 4 | 5 | null
  milestoneReward: number
  nextMilestone: 3 | 4 | 5 | null
  nextMilestoneReward: number
  remainingToNextMilestone: number
}

export interface BaseSpinResult {
  board: Board
  footprintCount: number
  predatorTrackCount: number
  nestingEggCount: number
  triggerCounts: Record<string, number>
  featureTriggered: boolean
  triggeredFeatureId: string | null
  triggeredFeatureName: string | null
  featureStartingRespins: number
  clusterWins: ClusterWin[]
  clusterWin: number
  fieldNotes: FieldNotesResult
  baseWin: number
}

export interface SimulationResult {
  seed: number
  spins: number
  triggers: number
  triggerFrequency: number
  averageFeatureWin: number
  baseRtp: number
  evidenceRtp: number
  evidenceRtpByMilestone: Record<'3' | '4' | '5', number>
  featureRtp: number
  totalRtp: number
  evidenceBonusFrequency: number
  evidenceMilestoneFrequency: Record<'3' | '4' | '5', number>
  evidenceUniqueDistribution: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  averageEvidenceBonus: number
  percentiles: {
    p50: number
    p90: number
    p99: number
  }
  footprintDistribution: Record<string, number>
  clusterCountDistribution: Record<string, number>
  clusterSizeDistribution: Record<string, number>
  symbolFrequencyDistribution: Record<SymbolId, number>
  finalRevealDistribution: Record<string, number>
  fullRevealRate: number
  totalClusters: number
  wildAppearanceRate: number
  wildAssistedClusterFrequency: number
  goldenAmberHitFrequency: number
  twoFootprintFrequency: number
  twoPredatorTrackFrequency: number
  nestingEggDistribution: Record<string, number>
  twoNestingEggFrequency: number
  baseWinsOver10Frequency: number
  largestBaseGameHit: number
  baseWinPercentiles: {
    p95: number
    p99: number
  }
  predatorTrackDistribution: Record<string, number>
  featureBreakdown: Record<
    string,
    {
      id: string
      displayName: string
      triggers: number
      triggerFrequency: number
      averageWin: number
      rtp: number
      percentiles: {
        p50: number
        p90: number
        p99: number
      }
      finalRevealDistribution: Record<string, number>
      fullRevealRate: number
      evolutionDiagnostics?: {
        averageSourceTilesCreated: number
        averageEvolvedTiles: number
        averageEvolutionValue: number
        largestEvolutionChain: number
        averageReveals: number
      }
    }
  >
}
