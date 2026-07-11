export type TileRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface TileDefinition {
  id: string
  displayName: string
  rarity: TileRarity
  rarityWeight: number
  payoutValue: number
  discoveryCategory?: string
  assemblyContribution?: {
    sectionId: string
    pieces: number
  }
  classificationTag?: string
}

export interface AssemblySectionDefinition {
  id: string
  displayName: string
  requiredPieces: number
  completionBonus: number
}

export interface ClassificationRule {
  id: string
  displayName: string
  requiredTags: string[]
  bonus: number
}

export interface AssemblyProfile {
  id: string
  displayName: string
  sections: AssemblySectionDefinition[]
  fullCompletionBonus: number
  classificationRules: ClassificationRule[]
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
  assembly?: AssemblyProfile
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
  assemblyContribution?: {
    sectionId: string
    pieces: number
  }
  classificationTag?: string
}

export interface FeatureReveal {
  index: number
  tile: RevealedFeatureTile
}

export interface AssemblySectionState {
  id: string
  displayName: string
  requiredPieces: number
  piecesFound: number
  completed: boolean
  completionBonus: number
  bonusAwarded: boolean
}

export interface AssemblyEvent {
  type: 'piece-found' | 'section-complete' | 'classification-upgrade' | 'specimen-complete'
  sectionId?: string
  sectionName?: string
  piecesAdded?: number
  bonusAwarded?: number
  classificationId?: string
  classificationName?: string
}

export interface AssemblyState {
  id: string
  displayName: string
  sections: AssemblySectionState[]
  tagsFound: string[]
  classificationId: string
  classificationName: string
  classificationBonus: number
  classificationBonusAwarded: boolean
  fullCompletionBonus: number
  fullCompletionBonusAwarded: boolean
  notableDiscoveries: string[]
}

export interface FeatureStep {
  hit: boolean
  respinsRemaining: number
  reveals: FeatureReveal[]
  assemblyEvents?: AssemblyEvent[]
  bonusAwarded?: number
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
  assembly?: AssemblyState
  totalWin: number
  fullyRevealed: boolean
}

export interface FeatureSessionDebug {
  sessionId: number
  featureRngSeed: number
  boardGenerationSeed: number
}

export interface FeatureSession {
  profile: FeatureProfile
  rng: Rng
  debug?: FeatureSessionDebug
  tiles: Array<RevealedFeatureTile | null>
  steps: FeatureStep[]
  startingRespins: number
  respinsRemaining: number
  completionReward: number
  assembly?: AssemblyState
  totalWin: number
  fullyRevealed: boolean
  isComplete: boolean
}
import type { Rng } from './rng'
