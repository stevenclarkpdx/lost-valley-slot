import type {
  AssemblyEvent,
  AssemblyState,
  CollectorDefinition,
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

function generateStandardTile(
  profile: FeatureProfile,
  rng: Rng,
): RevealedFeatureTile {
  const definition = pickWeighted<TileDefinition>(
    profile.tileTable,
    (tile) => tile.rarityWeight,
    rng,
  )
  return {
    kind: 'tile',
    id: definition.id,
    displayName: definition.displayName,
    payoutValue: definition.payoutValue * profile.payoutRules.tileValueMultiplier,
    discoveryCategory: definition.discoveryCategory,
    assemblyContribution: definition.assemblyContribution,
    classificationTag: definition.classificationTag,
  }
}

function createAssemblyState(profile: FeatureProfile): AssemblyState | undefined {
  if (!profile.assembly) return undefined
  return {
    id: profile.assembly.id,
    displayName: profile.assembly.displayName,
    sections: profile.assembly.sections.map((section) => ({
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
    fullCompletionBonus: profile.assembly.fullCompletionBonus,
    fullCompletionBonusAwarded: false,
    notableDiscoveries: [],
  }
}

function applyAssemblyReveal(
  profile: FeatureProfile,
  assembly: AssemblyState | undefined,
  tile: RevealedFeatureTile,
): { assembly?: AssemblyState; events: AssemblyEvent[]; bonus: number } {
  if (!profile.assembly || !assembly) return { assembly, events: [], bonus: 0 }

  const events: AssemblyEvent[] = []
  let bonus = 0
  let sections = assembly.sections

  if (tile.assemblyContribution) {
    sections = sections.map((section) => {
      if (section.id !== tile.assemblyContribution?.sectionId) return section
      const piecesFound = Math.min(
        section.requiredPieces,
        section.piecesFound + tile.assemblyContribution.pieces,
      )
      const completed = piecesFound >= section.requiredPieces
      events.push({
        type: 'piece-found',
        sectionId: section.id,
        sectionName: section.displayName,
        piecesAdded: tile.assemblyContribution.pieces,
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

  let tagsFound = assembly.tagsFound
  let notableDiscoveries = assembly.notableDiscoveries
  if (tile.classificationTag && !tagsFound.includes(tile.classificationTag)) {
    tagsFound = [...tagsFound, tile.classificationTag]
    notableDiscoveries = [...notableDiscoveries, tile.displayName]
  }

  const eligibleClassifications = profile.assembly.classificationRules.filter((rule) =>
    rule.requiredTags.every((tag) => tagsFound.includes(tag)),
  )
  const bestClassification = eligibleClassifications.at(-1)
  const classificationId = bestClassification?.id ?? assembly.classificationId
  const classificationName = bestClassification?.displayName ?? assembly.classificationName
  const classificationBonus = bestClassification?.bonus ?? assembly.classificationBonus
  if (bestClassification && bestClassification.id !== assembly.classificationId) {
    events.push({
      type: 'classification-upgrade',
      classificationId,
      classificationName,
    })
  }

  return {
    assembly: {
      ...assembly,
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

function finalizeAssembly(
  assembly: AssemblyState | undefined,
): { assembly?: AssemblyState; events: AssemblyEvent[]; bonus: number } {
  if (!assembly) return { assembly, events: [], bonus: 0 }
  const events: AssemblyEvent[] = []
  let bonus = 0
  const specimenComplete = assembly.sections.every((section) => section.completed)
  let fullCompletionBonusAwarded = assembly.fullCompletionBonusAwarded
  if (specimenComplete && !assembly.fullCompletionBonusAwarded) {
    bonus += assembly.fullCompletionBonus
    fullCompletionBonusAwarded = true
    events.push({
      type: 'specimen-complete',
      bonusAwarded: assembly.fullCompletionBonus,
    })
  }

  let classificationBonusAwarded = assembly.classificationBonusAwarded
  if (assembly.classificationBonus > 0 && !assembly.classificationBonusAwarded) {
    bonus += assembly.classificationBonus
    classificationBonusAwarded = true
    events.push({
      type: 'classification-upgrade',
      classificationId: assembly.classificationId,
      classificationName: assembly.classificationName,
      bonusAwarded: assembly.classificationBonus,
    })
  }

  return {
    assembly: {
      ...assembly,
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
    assembly: createAssemblyState(profile),
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
    const finalAssembly = respinsRemaining === 0 ? finalizeAssembly(session.assembly) : undefined
    return {
      ...session,
      tiles,
      steps: [
        ...session.steps,
        {
          hit: false,
          respinsRemaining,
          reveals: [],
          assemblyEvents: finalAssembly?.events,
          bonusAwarded: finalAssembly?.bonus,
        },
      ],
      assembly: finalAssembly?.assembly ?? session.assembly,
      respinsRemaining,
      totalWin: session.totalWin + (finalAssembly?.bonus ?? 0),
      isComplete: respinsRemaining === 0,
    }
  }

  const revealedBefore = tiles.filter((tile) => tile !== null).length
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
  let assembly = session.assembly
  let assemblyBonus = 0
  const assemblyEvents: AssemblyEvent[] = []
  for (let revealIndex = 0; revealIndex < revealsThisHit; revealIndex += 1) {
    const hiddenIndices = tiles
      .map((value, index) => (value === null ? index : -1))
      .filter((index) => index >= 0)
    const index = hiddenIndices[rng.int(0, hiddenIndices.length - 1)]
    const tile = generateTile(profile, tiles, rng)
    tiles[index] = tile
    revealPayout += tile.payoutValue
    reveals.push({ index, tile })
    const assemblyUpdate = applyAssemblyReveal(profile, assembly, tile)
    assembly = assemblyUpdate.assembly
    assemblyBonus += assemblyUpdate.bonus
    assemblyEvents.push(...assemblyUpdate.events)
  }

  const fullyRevealed = tiles.every((tile) => tile !== null)
  const completionReward = fullyRevealed ? profile.completionReward : 0
  const finalAssembly = fullyRevealed ? finalizeAssembly(assembly) : undefined
  const bonusAwarded = assemblyBonus + (finalAssembly?.bonus ?? 0)
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
        assemblyEvents: [...assemblyEvents, ...(finalAssembly?.events ?? [])],
        bonusAwarded,
      },
    ],
    respinsRemaining,
    completionReward,
    assembly: finalAssembly?.assembly ?? assembly,
    totalWin: session.totalWin + revealPayout + assemblyBonus + (finalAssembly?.bonus ?? 0) + completionReward,
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
    assembly: session.assembly,
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
