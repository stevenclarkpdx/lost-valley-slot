import { SYMBOLS, type GameConfig } from './types'
import type { FeatureProfile } from './featureTypes'

const SCHEMA_VERSION = 6

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isProbability(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

function validateFeatureProfile(profile: Partial<FeatureProfile> | undefined): void {
  if (
    !profile ||
    typeof profile.id !== 'string' ||
    typeof profile.displayName !== 'string' ||
    !Number.isInteger(profile.startingRespins) ||
    profile.startingRespins! < 1 ||
    !Number.isInteger(profile.boardWidth) ||
    profile.boardWidth! < 1 ||
    !Number.isInteger(profile.boardHeight) ||
    profile.boardHeight! < 1
  ) {
    throw new Error('Feature identity, board dimensions, or starting respins are invalid.')
  }

  const hits = profile.hitGeneration
  if (
    !hits ||
    !isProbability(hits.hitProbability) ||
    !isProbability(hits.multiHitProbability) ||
    !Number.isInteger(hits.maxTilesPerHit) ||
    hits.maxTilesPerHit < 1
  ) {
    throw new Error('Feature hit-generation settings are invalid.')
  }

  if (
    !isProbability(profile.collectorProbability) ||
    !Array.isArray(profile.collectors) ||
    profile.collectors.some(
      (collector) =>
        typeof collector.id !== 'string' ||
        typeof collector.displayName !== 'string' ||
        !isFiniteNumber(collector.rarityWeight) ||
        collector.rarityWeight <= 0 ||
        !isFiniteNumber(collector.payoutMultiplier) ||
        collector.payoutMultiplier < 0,
    )
  ) {
    throw new Error('Feature collector settings are invalid.')
  }

  if (
    !isProbability(profile.jackpotProbability) ||
    profile.collectorProbability + profile.jackpotProbability > 1 ||
    !Array.isArray(profile.jackpotWeights) ||
    profile.jackpotWeights.some(
      (jackpot) =>
        typeof jackpot.id !== 'string' ||
        typeof jackpot.displayName !== 'string' ||
        !isFiniteNumber(jackpot.weight) ||
        jackpot.weight <= 0 ||
        !isFiniteNumber(jackpot.payoutValue) ||
        jackpot.payoutValue < 0,
    )
  ) {
    throw new Error('Feature jackpot settings are invalid.')
  }

  if (
    !Array.isArray(profile.tileTable) ||
    profile.tileTable.length === 0 ||
    profile.tileTable.some(
      (tile) =>
        typeof tile.id !== 'string' ||
        typeof tile.displayName !== 'string' ||
        !['common', 'uncommon', 'rare', 'legendary'].includes(tile.rarity) ||
        !isFiniteNumber(tile.rarityWeight) ||
        tile.rarityWeight <= 0 ||
        !isFiniteNumber(tile.payoutValue) ||
        tile.payoutValue < 0 ||
        (tile.assemblyContribution !== undefined &&
          (typeof tile.assemblyContribution.sectionId !== 'string' ||
            !isFiniteNumber(tile.assemblyContribution.pieces) ||
            tile.assemblyContribution.pieces <= 0)) ||
        (tile.classificationTag !== undefined && typeof tile.classificationTag !== 'string'),
    )
  ) {
    throw new Error('Feature tile table is invalid.')
  }

  if (profile.assembly !== undefined) {
    const assembly = profile.assembly
    if (
      typeof assembly.id !== 'string' ||
      typeof assembly.displayName !== 'string' ||
      !Array.isArray(assembly.sections) ||
      assembly.sections.length === 0 ||
      assembly.sections.some(
        (section) =>
          typeof section.id !== 'string' ||
          typeof section.displayName !== 'string' ||
          !Number.isInteger(section.requiredPieces) ||
          section.requiredPieces < 1 ||
          !isFiniteNumber(section.completionBonus) ||
          section.completionBonus < 0,
      ) ||
      !isFiniteNumber(assembly.fullCompletionBonus) ||
      assembly.fullCompletionBonus < 0 ||
      !Array.isArray(assembly.classificationRules) ||
      assembly.classificationRules.some(
        (rule) =>
          typeof rule.id !== 'string' ||
          typeof rule.displayName !== 'string' ||
          !Array.isArray(rule.requiredTags) ||
          rule.requiredTags.some((tag) => typeof tag !== 'string') ||
          !isFiniteNumber(rule.bonus) ||
          rule.bonus < 0,
      )
    ) {
      throw new Error('Feature assembly settings are invalid.')
    }
  }

  const payoutRules = profile.payoutRules
  if (
    !payoutRules ||
    !isFiniteNumber(payoutRules.tileValueMultiplier) ||
    payoutRules.tileValueMultiplier < 0 ||
    typeof payoutRules.collectorCollectsExistingTiles !== 'boolean' ||
    !Number.isInteger(payoutRules.hitResetsRespinsTo) ||
    payoutRules.hitResetsRespinsTo < 1 ||
    !isFiniteNumber(profile.completionReward) ||
    profile.completionReward < 0
  ) {
    throw new Error('Feature payout rules are invalid.')
  }
}

export function serializeConfig(config: GameConfig): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, config }, null, 2)
}

export function parseConfig(json: string): GameConfig {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Config must be a JSON object.')
  }

  const envelope = parsed as { schemaVersion?: unknown; config?: unknown }
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported config schema. Expected version ${SCHEMA_VERSION}.`)
  }

  const config = envelope.config as Partial<GameConfig> | undefined
  if (
    !config ||
    !Number.isInteger(config.boardSize) ||
    config.boardSize !== 5 ||
    !Array.isArray(config.symbolWeights) ||
    config.symbolWeights.length !== SYMBOLS.length
  ) {
    throw new Error('Config must define a 5x5 board and every symbol weight.')
  }

  const suppliedSymbols = new Set(
    config.symbolWeights.map((item) => item?.symbol),
  )
  if (
    SYMBOLS.some((symbol) => !suppliedSymbols.has(symbol)) ||
    config.symbolWeights.some(
      (item) => !isFiniteNumber(item?.weight) || item.weight <= 0,
    )
  ) {
    throw new Error('Every known symbol needs one positive numeric weight.')
  }

  const lowPays = config.clusterPays?.low
  const premiumPays = config.clusterPays?.premium
  const goldenAmberPays = config.clusterPays?.goldenAmber
  if (
    !Array.isArray(lowPays) ||
    lowPays.length !== 5 ||
    !lowPays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(premiumPays) ||
    premiumPays.length !== 5 ||
    !premiumPays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(goldenAmberPays) ||
    goldenAmberPays.length !== 5 ||
    !goldenAmberPays.every((value) => isFiniteNumber(value) && value >= 0)
  ) {
    throw new Error('Low, premium, and Golden Amber cluster paytables need five non-negative values.')
  }

  const fieldNotesPays = config.fieldNotesPays
  if (
    !fieldNotesPays ||
    !isFiniteNumber(fieldNotesPays[3]) ||
    fieldNotesPays[3] < 0 ||
    !isFiniteNumber(fieldNotesPays[4]) ||
    fieldNotesPays[4] < fieldNotesPays[3] ||
    !isFiniteNumber(fieldNotesPays[5]) ||
    fieldNotesPays[5] < fieldNotesPays[4]
  ) {
    throw new Error('Field Notes payouts need non-negative scaling values for 3, 4, and 5 evidence.')
  }

  validateFeatureProfile(config.featureProfile)

  return config as GameConfig
}
