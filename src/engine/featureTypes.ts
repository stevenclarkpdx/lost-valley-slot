import type { Rng } from './rng'

export type TileRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface TileDefinition {
  id: string
  displayName: string
  rarity: TileRarity
  rarityWeight: number
  payoutValue: number
  discoveryCategory?: string
  progressionContribution?: {
    sectionId: string
    pieces: number
  }
  classificationTag?: string
}

export interface TileEvolutionRule {
  fromTileId: string
  toTile: TileDefinition
  probability: number
}

export interface ProgressionSectionDefinition {
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

export interface ProgressionProfile {
  id: string
  displayName: string
  sections: ProgressionSectionDefinition[]
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
  triggerKind?: 'symbol' | 'evidence-completion'
  triggerSymbol?: string
  triggerDisplayName?: string
  theme?: 'fossil' | 'predator' | 'nesting' | 'lost'
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
  tileEvolution?: TileEvolutionRule[]
  progression?: ProgressionProfile
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
  progressionContribution?: {
    sectionId: string
    pieces: number
  }
  classificationTag?: string
}

export interface FeatureReveal {
  index: number
  tile: RevealedFeatureTile
}

export interface FeatureEvolutionEvent {
  index: number
  fromTile: RevealedFeatureTile
  toTile: RevealedFeatureTile
  payoutIncrease: number
}

export interface ProgressionSectionState {
  id: string
  displayName: string
  requiredPieces: number
  piecesFound: number
  completed: boolean
  completionBonus: number
  bonusAwarded: boolean
}

export interface ProgressionEvent {
  type: 'piece-found' | 'section-complete' | 'classification-upgrade' | 'progression-complete'
  sectionId?: string
  sectionName?: string
  piecesAdded?: number
  bonusAwarded?: number
  classificationId?: string
  classificationName?: string
}

export interface ProgressionState {
  id: string
  displayName: string
  sections: ProgressionSectionState[]
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
  evolutionEvents?: FeatureEvolutionEvent[]
  progressionEvents?: ProgressionEvent[]
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
  progression?: ProgressionState
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
  progression?: ProgressionState
  totalWin: number
  fullyRevealed: boolean
  isComplete: boolean
}
