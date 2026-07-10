export type TileRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface TileDefinition {
  id: string
  displayName: string
  rarity: TileRarity
  rarityWeight: number
  payoutValue: number
  discoveryCategory?: string
}

export interface CollectorDefinition {
  id: string
  displayName: string
  rarityWeight: number
  payoutMultiplier: number
}

export interface JackpotDefinition {
  id: string
  displayName: string
  weight: number
  payoutValue: number
}

export interface FeatureProfile {
  id: string
  displayName: string
  startingRespins: number
  boardWidth: number
  boardHeight: number
  hitGeneration: {
    hitProbability: number
    multiHitProbability: number
    maxTilesPerHit: number
  }
  collectorProbability: number
  collectors: CollectorDefinition[]
  jackpotProbability: number
  jackpotWeights: JackpotDefinition[]
  tileTable: TileDefinition[]
  payoutRules: {
    tileValueMultiplier: number
    collectorCollectsExistingTiles: boolean
    hitResetsRespinsTo: number
  }
  completionReward: number
}

export interface RevealedFeatureTile {
  kind: 'tile' | 'collector' | 'jackpot'
  id: string
  displayName: string
  payoutValue: number
  discoveryCategory?: string
}

export interface FeatureReveal {
  index: number
  tile: RevealedFeatureTile
}

export interface FeatureStep {
  hit: boolean
  respinsRemaining: number
  reveals: FeatureReveal[]
}

export interface FeatureResult {
  profileId: string
  displayName: string
  boardWidth: number
  boardHeight: number
  tiles: Array<RevealedFeatureTile | null>
  steps: FeatureStep[]
  startingRespins: number
  completionReward: number
  totalWin: number
  fullyRevealed: boolean
}

export interface FeatureSession {
  profile: FeatureProfile
  rng: Rng
  tiles: Array<RevealedFeatureTile | null>
  steps: FeatureStep[]
  startingRespins: number
  respinsRemaining: number
  completionReward: number
  totalWin: number
  fullyRevealed: boolean
  isComplete: boolean
}
import type { Rng } from './rng'
