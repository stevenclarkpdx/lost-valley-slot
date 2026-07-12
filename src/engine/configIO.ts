import { SYMBOLS, type GameConfig } from './types'
import type { FeatureProfile } from './featureTypes'

const SCHEMA_VERSION = 7

type LegacyGameConfig = Partial<GameConfig> & {
  featureProfile?: FeatureProfile
  featureProfiles?: FeatureProfile[]
  clusterPays?: Partial<GameConfig['clusterPays']> & {
    low?: [number, number, number, number, number]
    premium?: [number, number, number, number, number]
  }
}

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

  if (
    profile.triggerSymbol !== undefined &&
    !SYMBOLS.includes(profile.triggerSymbol as (typeof SYMBOLS)[number])
  ) {
    throw new Error('Feature trigger symbol is invalid.')
  }

  if (
    profile.triggerDisplayName !== undefined &&
    typeof profile.triggerDisplayName !== 'string'
  ) {
    throw new Error('Feature trigger display name is invalid.')
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
        (tile.progressionContribution !== undefined &&
          (typeof tile.progressionContribution.sectionId !== 'string' ||
            !isFiniteNumber(tile.progressionContribution.pieces) ||
            tile.progressionContribution.pieces <= 0)) ||
        (tile.classificationTag !== undefined && typeof tile.classificationTag !== 'string'),
    )
  ) {
    throw new Error('Feature tile table is invalid.')
  }

  if (profile.progression !== undefined) {
    const progression = profile.progression
    if (
      typeof progression.id !== 'string' ||
      typeof progression.displayName !== 'string' ||
      !Array.isArray(progression.sections) ||
      progression.sections.length === 0 ||
      progression.sections.some(
        (section) =>
          typeof section.id !== 'string' ||
          typeof section.displayName !== 'string' ||
          !Number.isInteger(section.requiredPieces) ||
          section.requiredPieces < 1 ||
          !isFiniteNumber(section.completionBonus) ||
          section.completionBonus < 0,
      ) ||
      !isFiniteNumber(progression.fullCompletionBonus) ||
      progression.fullCompletionBonus < 0 ||
      !Array.isArray(progression.classificationRules) ||
      progression.classificationRules.some(
        (rule) =>
          typeof rule.id !== 'string' ||
          typeof rule.displayName !== 'string' ||
          !Array.isArray(rule.requiredTags) ||
          rule.requiredTags.some((tag) => typeof tag !== 'string') ||
          !isFiniteNumber(rule.bonus) ||
          rule.bonus < 0,
      )
    ) {
      throw new Error('Feature progression settings are invalid.')
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

function migrateConfig(config: LegacyGameConfig, schemaVersion: number): LegacyGameConfig {
  if (schemaVersion >= SCHEMA_VERSION) return config

  if (schemaVersion === 6) {
    const oldMapWeight = config.symbolWeights?.find(
      (item) => item?.symbol === ('map' as never),
    )?.weight
    const symbolWeights = (config.symbolWeights ?? [])
      .filter((item) => item?.symbol !== ('map' as never))

    if (!symbolWeights.some((item) => item?.symbol === 'compass')) {
      symbolWeights.push({ symbol: 'compass', weight: oldMapWeight ?? 1 })
    }
    if (!symbolWeights.some((item) => item?.symbol === 'pickaxe')) {
      symbolWeights.push({ symbol: 'pickaxe', weight: oldMapWeight ?? 1 })
    }

    const low = config.clusterPays?.low
    const premium = config.clusterPays?.premium
    config.symbolWeights = symbolWeights
    config.clusterPays = {
      gray: config.clusterPays?.gray ?? premium,
      brown: config.clusterPays?.brown ?? low,
      green: config.clusterPays?.green ?? premium,
      blue: config.clusterPays?.blue ?? premium,
      goldenAmber: config.clusterPays?.goldenAmber,
    } as GameConfig['clusterPays']
    return config
  }

  throw new Error(`Unsupported config schema. Expected version ${SCHEMA_VERSION}.`)
}

export function parseConfig(json: string): GameConfig {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Config must be a JSON object.')
  }

  const envelope = parsed as { schemaVersion?: unknown; config?: unknown }
  if (!Number.isInteger(envelope.schemaVersion)) {
    throw new Error(`Unsupported config schema. Expected version ${SCHEMA_VERSION}.`)
  }

  const config =
    envelope.config && typeof envelope.config === 'object'
      ? migrateConfig(envelope.config as LegacyGameConfig, envelope.schemaVersion as number)
      : undefined
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

  const grayPays = config.clusterPays?.gray
  const brownPays = config.clusterPays?.brown
  const greenPays = config.clusterPays?.green
  const bluePays = config.clusterPays?.blue
  const goldenAmberPays = config.clusterPays?.goldenAmber
  if (
    !Array.isArray(grayPays) ||
    grayPays.length !== 5 ||
    !grayPays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(brownPays) ||
    brownPays.length !== 5 ||
    !brownPays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(greenPays) ||
    greenPays.length !== 5 ||
    !greenPays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(bluePays) ||
    bluePays.length !== 5 ||
    !bluePays.every((value) => isFiniteNumber(value) && value >= 0) ||
    !Array.isArray(goldenAmberPays) ||
    goldenAmberPays.length !== 5 ||
    !goldenAmberPays.every((value) => isFiniteNumber(value) && value >= 0)
  ) {
    throw new Error('Gray, brown, green, blue, and Golden Amber cluster paytables need five non-negative values.')
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

  if (config.featureProfiles !== undefined) {
    if (!Array.isArray(config.featureProfiles) || config.featureProfiles.length === 0) {
      throw new Error('Feature profiles must be a non-empty array when supplied.')
    }
  } else if (config.featureProfile !== undefined) {
    config.featureProfiles = [config.featureProfile]
  } else {
    throw new Error('Config must define at least one feature profile.')
  }
  config.featureProfiles.forEach(validateFeatureProfile)
  delete config.featureProfile

  return config as GameConfig
}
