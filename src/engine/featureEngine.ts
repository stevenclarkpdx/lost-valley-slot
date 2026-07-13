import type {
  ProgressionEvent,
  ProgressionState,
  CollectorDefinition,
  FeatureEvolutionEvent,
  FeatureProfile,
  FeatureResult,
  FeatureSession,
  FeatureSessionDebug,
  JackpotDefinition,
  RevealedFeatureTile,
  TileDefinition,
} from './featureTypes'
import type { Rng } from './rng'

function pickWeighted<T>(
  entries: T[],
  weightOf: (entry: T) => number,
  rng: Rng,
): T {
  const totalWeight = entries.reduce((sum, entry) => sum + weightOf(entry), 0)
  let roll = rng.next() * totalWeight
  for (const entry of entries) {
    roll -= weightOf(entry)
    if (roll < 0) return entry
  }
  return entries[entries.length - 1]
}

function tileFromDefinition(
  profile: FeatureProfile,
  definition: TileDefinition,
): RevealedFeatureTile {
  return {
    kind: 'tile',
    id: definition.id,
    displayName: definition.displayName,
    payoutValue: definition.payoutValue * profile.payoutRules.tileValueMultiplier,
    discoveryCategory: definition.discoveryCategory,
    progressionContribution: definition.progressionContribution,
    classificationTag: definition.classificationTag,
  }
}

function generateStandardTile(
  profile: FeatureProfile,
  rng: Rng,
): RevealedFeatureTile {
  const definition = pickWeighted<TileDefinition>(
    profile.tileTable,
    (tile) => tile.rarityWeight,
    rng,
  )
  return tileFromDefinition(profile, definition)
}

function createProgressionState(profile: FeatureProfile): ProgressionState | undefined {
  if (!profile.progression) return undefined
  return {
    id: profile.progression.id,
    displayName: profile.progression.displayName,
    sections: profile.progression.sections.map((section) => ({
      id: section.id,
      displayName: section.displayName,
      requiredPieces: section.requiredPieces,
      piecesFound: 0,
      completed: false,
      completionBonus: section.completionBonus,
      bonusAwarded: false,
    })),
    tagsFound: [],
    classificationId: 'unknown',
    classificationName: 'Unknown Specimen',
    classificationBonus: 0,
    classificationBonusAwarded: false,
    fullCompletionBonus: profile.progression.fullCompletionBonus,
    fullCompletionBonusAwarded: false,
    notableDiscoveries: [],
  }
}

function applyProgressionReveal(
  profile: FeatureProfile,
  progression: ProgressionState | undefined,
  tile: RevealedFeatureTile,
): { progression?: ProgressionState; events: ProgressionEvent[]; bonus: number } {
  if (!profile.progression || !progression) return { progression, events: [], bonus: 0 }

  const events: ProgressionEvent[] = []
  let bonus = 0
  let sections = progression.sections

  if (tile.progressionContribution) {
    sections = sections.map((section) => {
      if (section.id !== tile.progressionContribution?.sectionId) return section
      const piecesFound = Math.min(
        section.requiredPieces,
        section.piecesFound + tile.progressionContribution.pieces,
      )
      const completed = piecesFound >= section.requiredPieces
      events.push({
        type: 'piece-found',
        sectionId: section.id,
        sectionName: section.displayName,
        piecesAdded: tile.progressionContribution.pieces,
      })
      if (completed && !section.bonusAwarded) {
        bonus += section.completionBonus
        events.push({
          type: 'section-complete',
          sectionId: section.id,
          sectionName: section.displayName,
          bonusAwarded: section.completionBonus,
        })
      }
      return {
        ...section,
        piecesFound,
        completed,
        bonusAwarded: section.bonusAwarded || completed,
      }
    })
  }

  let tagsFound = progression.tagsFound
  let notableDiscoveries = progression.notableDiscoveries
  if (tile.classificationTag && !tagsFound.includes(tile.classificationTag)) {
    tagsFound = [...tagsFound, tile.classificationTag]
    notableDiscoveries = [...notableDiscoveries, tile.displayName]
  }

  const eligibleClassifications = profile.progression.classificationRules.filter((rule) =>
    rule.requiredTags.every((tag) => tagsFound.includes(tag)),
  )
  const bestClassification = eligibleClassifications.at(-1)
  const classificationId = bestClassification?.id ?? progression.classificationId
  const classificationName = bestClassification?.displayName ?? progression.classificationName
  const classificationBonus = bestClassification?.bonus ?? progression.classificationBonus
  if (bestClassification && bestClassification.id !== progression.classificationId) {
    events.push({
      type: 'classification-upgrade',
      classificationId,
      classificationName,
    })
  }

  return {
    progression: {
      ...progression,
      sections,
      tagsFound,
      classificationId,
      classificationName,
      classificationBonus,
      notableDiscoveries,
    },
    events,
    bonus,
  }
}

function finalizeProgression(
  progression: ProgressionState | undefined,
): { progression?: ProgressionState; events: ProgressionEvent[]; bonus: number } {
  if (!progression) return { progression, events: [], bonus: 0 }
  const events: ProgressionEvent[] = []
  let bonus = 0
  const progressionComplete = progression.sections.every((section) => section.completed)
  let fullCompletionBonusAwarded = progression.fullCompletionBonusAwarded
  if (progressionComplete && !progression.fullCompletionBonusAwarded) {
    bonus += progression.fullCompletionBonus
    fullCompletionBonusAwarded = true
    events.push({
      type: 'progression-complete',
      bonusAwarded: progression.fullCompletionBonus,
    })
  }

  let classificationBonusAwarded = progression.classificationBonusAwarded
  if (progression.classificationBonus > 0 && !progression.classificationBonusAwarded) {
    bonus += progression.classificationBonus
    classificationBonusAwarded = true
    events.push({
      type: 'classification-upgrade',
      classificationId: progression.classificationId,
      classificationName: progression.classificationName,
      bonusAwarded: progression.classificationBonus,
    })
  }

  return {
    progression: {
      ...progression,
      fullCompletionBonusAwarded,
      classificationBonusAwarded,
    },
    events,
    bonus,
  }
}

function generateCollector(
  profile: FeatureProfile,
  existingTiles: Array<RevealedFeatureTile | null>,
  rng: Rng,
): RevealedFeatureTile {
  const definition = pickWeighted<CollectorDefinition>(
    profile.collectors,
    (collector) => collector.rarityWeight,
    rng,
  )
  const collectedValue = profile.payoutRules.collectorCollectsExistingTiles
    ? existingTiles.reduce<number>(
        (sum, tile) => sum + (tile?.payoutValue ?? 0),
        0,
      )
    : 0
  return {
    kind: 'collector',
    id: definition.id,
    displayName: definition.displayName,
    payoutValue: collectedValue * definition.payoutMultiplier,
  }
}

function generateJackpot(
  profile: FeatureProfile,
  rng: Rng,
): RevealedFeatureTile {
  const definition = pickWeighted<JackpotDefinition>(
    profile.jackpotWeights,
    (jackpot) => jackpot.weight,
    rng,
  )
  return {
    kind: 'jackpot',
    id: definition.id,
    displayName: definition.displayName,
    payoutValue: definition.payoutValue,
  }
}

function generateTile(
  profile: FeatureProfile,
  existingTiles: Array<RevealedFeatureTile | null>,
  rng: Rng,
): RevealedFeatureTile {
  const hasCollectors =
    profile.collectorProbability > 0 && profile.collectors.length > 0
  const hasJackpots =
    profile.jackpotProbability > 0 && profile.jackpotWeights.length > 0

  if (hasCollectors || hasJackpots) {
    const specialRoll = rng.next()
    if (hasCollectors && specialRoll < profile.collectorProbability) {
      return generateCollector(profile, existingTiles, rng)
    }
    if (
      hasJackpots &&
      specialRoll <
        profile.collectorProbability + profile.jackpotProbability
    ) {
      return generateJackpot(profile, rng)
    }
  }

  return generateStandardTile(profile, rng)
}

function applyTileEvolution(
  profile: FeatureProfile,
  tiles: Array<RevealedFeatureTile | null>,
  eligibleIndices: number[],
  rng: Rng,
): { tiles: Array<RevealedFeatureTile | null>; events: FeatureEvolutionEvent[]; payout: number } {
  if (!profile.tileEvolution || profile.tileEvolution.length === 0) {
    return { tiles, events: [], payout: 0 }
  }

  const evolvedTiles = [...tiles]
  const events: FeatureEvolutionEvent[] = []
  let payout = 0

  for (const index of eligibleIndices) {
    const currentTile = evolvedTiles[index]
    if (!currentTile) continue
    const rule = profile.tileEvolution.find((candidate) => candidate.fromTileId === currentTile.id)
    if (!rule || rng.next() >= rule.probability) continue

    const nextTile = tileFromDefinition(profile, rule.toTile)
    const payoutIncrease = Math.max(0, nextTile.payoutValue - currentTile.payoutValue)
    evolvedTiles[index] = nextTile
    payout += payoutIncrease
    events.push({
      index,
      fromTile: currentTile,
      toTile: nextTile,
      payoutIncrease,
    })
  }

  return { tiles: evolvedTiles, events, payout }
}

export class FeatureEngine {
  play(
    profile: FeatureProfile,
    rng: Rng,
    startingRespins = profile.startingRespins,
  ): FeatureResult {
    return playFeatureToCompletion(profile, rng, startingRespins)
  }

  createSession(
    profile: FeatureProfile,
    rng: Rng,
    startingRespins = profile.startingRespins,
  ): FeatureSession {
    return createFeatureSession(profile, rng, startingRespins)
  }

  step(session: FeatureSession): FeatureSession {
    return stepFeatureSession(session)
  }
}

export const featureEngine = new FeatureEngine()

export function createFeatureSession(
  profile: FeatureProfile,
  rng: Rng,
  startingRespins = profile.startingRespins,
  debug?: FeatureSessionDebug,
): FeatureSession {
  return {
    profile,
    rng,
    debug,
    tiles: Array(profile.boardWidth * profile.boardHeight).fill(null),
    steps: [],
    startingRespins,
    respinsRemaining: startingRespins,
    completionReward: 0,
    progression: createProgressionState(profile),
    totalWin: 0,
    fullyRevealed: false,
    isComplete: false,
  }
}

export function stepFeatureSession(session: FeatureSession): FeatureSession {
  if (session.isComplete) return session

  const { profile, rng } = session
  const tileCount = profile.boardWidth * profile.boardHeight
  const tiles = [...session.tiles]
  const hit = rng.next() < profile.hitGeneration.hitProbability

  if (!hit) {
    const respinsRemaining = session.respinsRemaining - 1
    const finalProgression = respinsRemaining === 0 ? finalizeProgression(session.progression) : undefined
    return {
      ...session,
      tiles,
      steps: [
        ...session.steps,
        {
          hit: false,
          respinsRemaining,
          reveals: [],
          progressionEvents: finalProgression?.events,
          bonusAwarded: finalProgression?.bonus,
        },
      ],
      progression: finalProgression?.progression ?? session.progression,
      respinsRemaining,
      totalWin: session.totalWin + (finalProgression?.bonus ?? 0),
      isComplete: respinsRemaining === 0,
    }
  }

  const revealedBefore = tiles.filter((tile) => tile !== null).length
  const evolutionEligibleIndices = tiles
    .map((value, index) => (value === null ? -1 : index))
    .filter((index) => index >= 0)
  let revealsThisHit = 1
  if (
    profile.hitGeneration.maxTilesPerHit > 1 &&
    profile.hitGeneration.multiHitProbability > 0 &&
    rng.next() < profile.hitGeneration.multiHitProbability
  ) {
    revealsThisHit = Math.min(
      profile.hitGeneration.maxTilesPerHit,
      tileCount - revealedBefore,
    )
  }

  const reveals = []
  let revealPayout = 0
  let progression = session.progression
  let progressionBonus = 0
  const progressionEvents: ProgressionEvent[] = []
  for (let revealIndex = 0; revealIndex < revealsThisHit; revealIndex += 1) {
    const hiddenIndices = tiles
      .map((value, index) => (value === null ? index : -1))
      .filter((index) => index >= 0)
    const index = hiddenIndices[rng.int(0, hiddenIndices.length - 1)]
    const tile = generateTile(profile, tiles, rng)
    tiles[index] = tile
    revealPayout += tile.payoutValue
    reveals.push({ index, tile })
    const progressionUpdate = applyProgressionReveal(profile, progression, tile)
    progression = progressionUpdate.progression
    progressionBonus += progressionUpdate.bonus
    progressionEvents.push(...progressionUpdate.events)
  }

  const evolution = applyTileEvolution(profile, tiles, evolutionEligibleIndices, rng)
  tiles.splice(0, tiles.length, ...evolution.tiles)
  for (const event of evolution.events) {
    const progressionUpdate = applyProgressionReveal(profile, progression, event.toTile)
    progression = progressionUpdate.progression
    progressionBonus += progressionUpdate.bonus
    progressionEvents.push(...progressionUpdate.events)
  }

  const fullyRevealed = tiles.every((tile) => tile !== null)
  const completionReward = fullyRevealed ? profile.completionReward : 0
  const finalProgression = fullyRevealed ? finalizeProgression(progression) : undefined
  const bonusAwarded = progressionBonus + (finalProgression?.bonus ?? 0)
  const respinsRemaining = profile.payoutRules.hitResetsRespinsTo
  return {
    ...session,
    tiles,
    steps: [
      ...session.steps,
      {
        hit: true,
        respinsRemaining,
        reveals,
        evolutionEvents: evolution.events,
        progressionEvents: [...progressionEvents, ...(finalProgression?.events ?? [])],
        bonusAwarded,
      },
    ],
    respinsRemaining,
    completionReward,
    progression: finalProgression?.progression ?? progression,
    totalWin:
      session.totalWin +
      revealPayout +
      evolution.payout +
      progressionBonus +
      (finalProgression?.bonus ?? 0) +
      completionReward,
    fullyRevealed,
    isComplete: fullyRevealed,
  }
}

export function featureSessionToResult(session: FeatureSession): FeatureResult {
  return {
    profileId: session.profile.id,
    displayName: session.profile.displayName,
    boardWidth: session.profile.boardWidth,
    boardHeight: session.profile.boardHeight,
    tiles: session.tiles,
    steps: session.steps,
    startingRespins: session.startingRespins,
    completionReward: session.completionReward,
    progression: session.progression,
    totalWin: session.totalWin,
    fullyRevealed: session.fullyRevealed,
  }
}

export function playFeatureToCompletion(
  profile: FeatureProfile,
  rng: Rng,
  startingRespins = profile.startingRespins,
): FeatureResult {
  let session = createFeatureSession(profile, rng, startingRespins)
  while (!session.isComplete) {
    session = stepFeatureSession(session)
  }
  return featureSessionToResult(session)
}
