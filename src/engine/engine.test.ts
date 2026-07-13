import { describe, expect, it } from 'vitest'
import {
  calculateFieldNotes,
  getFeatureStartingRespins,
  isFeatureTriggered,
  resolveTriggeredFeature,
} from './baseGame'
import { DEFAULT_CONFIG } from './config'
import { getPrimaryFeatureProfile, getTriggeredFeatureProfile } from './featureProfiles'
import { parseConfig, serializeConfig } from './configIO'
import {
  createFeatureSession,
  featureEngine,
  featureSessionToResult,
  playFeatureToCompletion,
  stepFeatureSession,
} from './featureEngine'
import type { FeatureProfile } from './featureTypes'
import { calculateClusterWins } from './payouts'
import { createSeededRng, type Rng } from './rng'
import type { Board } from './types'
import { runSimulation } from './simulation'

const fossilProfile = getPrimaryFeatureProfile(DEFAULT_CONFIG)
const unscaledFossilProfile: FeatureProfile = {
  ...fossilProfile,
  payoutRules: {
    ...fossilProfile.payoutRules,
    tileValueMultiplier: 1,
  },
}

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createSeededRng(8675309)
    const second = createSeededRng(8675309)
    expect(Array.from({ length: 10 }, () => first.next())).toEqual(
      Array.from({ length: 10 }, () => second.next()),
    )
  })
})

describe('config JSON', () => {
  it('round-trips a versioned config', () => {
    expect(parseConfig(serializeConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG)
  })
})

describe('feature trigger', () => {
  it('requires at least three Footprints anywhere on the board', () => {
    const board = Array.from({ length: 5 }, () => Array(5).fill('compass')) as Board
    board[0][0] = 'footprint'
    board[2][3] = 'footprint'
    expect(isFeatureTriggered(board)).toBe(false)
    board[4][4] = 'footprint'
    expect(isFeatureTriggered(board)).toBe(true)
  })

  it('awards extra starting respins for four and five Footprints', () => {
    expect(getFeatureStartingRespins(3, 3)).toBe(3)
    expect(getFeatureStartingRespins(4, 3)).toBe(4)
    expect(getFeatureStartingRespins(5, 3)).toBe(5)
    expect(getFeatureStartingRespins(7, 3)).toBe(5)
  })

  it('routes Predator Tracks to Predator Valley without using Fossil Footprints', () => {
    const board = Array.from({ length: 5 }, () => Array(5).fill('jeep')) as Board
    board[0][0] = 'predatorTracks'
    board[2][3] = 'predatorTracks'
    board[4][4] = 'predatorTracks'

    const result = resolveTriggeredFeature(board, DEFAULT_CONFIG)

    expect(result.profile?.id).toBe('predator-valley')
    expect(result.triggerCounts['fossil-valley']).toBe(0)
    expect(result.triggerCounts['predator-valley']).toBe(3)
    expect(result.startingRespins).toBe(3)
  })

  it('routes Nesting Eggs to Nesting Grounds without using other valley cues', () => {
    const board = Array.from({ length: 5 }, () => Array(5).fill('jeep')) as Board
    board[0][0] = 'nestingEggs'
    board[2][3] = 'nestingEggs'
    board[4][4] = 'nestingEggs'

    const result = resolveTriggeredFeature(board, DEFAULT_CONFIG)

    expect(result.profile?.id).toBe('nesting-grounds')
    expect(result.triggerCounts['fossil-valley']).toBe(0)
    expect(result.triggerCounts['predator-valley']).toBe(0)
    expect(result.triggerCounts['nesting-grounds']).toBe(3)
    expect(result.startingRespins).toBe(3)
  })

  it('adds extra starting respins for four and five Predator Tracks', () => {
    const board = Array.from({ length: 5 }, () => Array(5).fill('jeep')) as Board
    board[0][0] = 'predatorTracks'
    board[1][0] = 'predatorTracks'
    board[2][0] = 'predatorTracks'
    board[3][0] = 'predatorTracks'

    expect(resolveTriggeredFeature(board, DEFAULT_CONFIG).startingRespins).toBe(4)

    board[4][0] = 'predatorTracks'
    expect(resolveTriggeredFeature(board, DEFAULT_CONFIG).startingRespins).toBe(5)
  })

  it('selects the triggered feature profile through the shared resolver', () => {
    expect(
      getTriggeredFeatureProfile(DEFAULT_CONFIG, { triggeredFeatureId: 'fossil-valley' })
        .displayName,
    ).toBe('Fossil Valley')
    expect(
      getTriggeredFeatureProfile(DEFAULT_CONFIG, { triggeredFeatureId: 'predator-valley' })
        .displayName,
    ).toBe('Predator Valley')
    expect(
      getTriggeredFeatureProfile(DEFAULT_CONFIG, { triggeredFeatureId: 'nesting-grounds' })
        .displayName,
    ).toBe('Nesting Grounds')
  })
})

describe('FeatureEngine', () => {
  it('creates an active session with starting respins and no reveals', () => {
    const session = createFeatureSession(
      fossilProfile,
      createSeededRng(1),
      4,
    )
    expect(session.respinsRemaining).toBe(4)
    expect(session.tiles.every((tile) => tile === null)).toBe(true)
    expect(session.steps).toHaveLength(0)
    expect(session.totalWin).toBe(0)
    expect(session.isComplete).toBe(false)
  })

  it('can attach feature debug metadata without changing starting state', () => {
    const session = createFeatureSession(
      fossilProfile,
      createSeededRng(1),
      3,
      {
        sessionId: 7,
        featureRngSeed: 12345,
        boardGenerationSeed: 12345,
      },
    )
    expect(session.debug).toEqual({
      sessionId: 7,
      featureRngSeed: 12345,
      boardGenerationSeed: 12345,
    })
    expect(session.tiles.every((tile) => tile === null)).toBe(true)
    expect(session.steps).toHaveLength(0)
  })

  it('decrements respins by one on a miss', () => {
    const missRng: Rng = { next: () => 0.99, int: (min) => min }
    const session = createFeatureSession(fossilProfile, missRng)
    const next = stepFeatureSession(session)
    expect(next.respinsRemaining).toBe(2)
    expect(next.steps.at(-1)?.hit).toBe(false)
    expect(next.isComplete).toBe(false)
  })

  it('reveals a tile and resets respins on a hit', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(fossilProfile, hitRng)
    const next = stepFeatureSession(session)
    expect(next.tiles.filter((tile) => tile !== null).length).toBeGreaterThanOrEqual(1)
    expect(next.respinsRemaining).toBe(
      fossilProfile.payoutRules.hitResetsRespinsTo,
    )
    expect(next.steps.at(-1)?.hit).toBe(true)
  })

  it('returns successful reveal events with complete tile payloads', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(fossilProfile, hitRng)
    const next = stepFeatureSession(session)
    const reveal = next.steps.at(-1)?.reveals[0]

    expect(reveal).toBeDefined()
    expect(reveal?.tile.id).toBeTruthy()
    expect(reveal?.tile.displayName).toBeTruthy()
    expect(reveal?.tile.payoutValue).toBeGreaterThan(0)
  })

  it('updates the board tile and reveal event together on the same feature step', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(fossilProfile, hitRng)
    const next = stepFeatureSession(session)
    const reveal = next.steps.at(-1)?.reveals[0]

    expect(reveal).toBeDefined()
    expect(next.tiles[reveal!.index]).toEqual(reveal!.tile)
  })

  it('never leaves a revealed board tile without a discovery id or value', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(fossilProfile, hitRng)
    const next = stepFeatureSession(session)

    for (const tile of next.tiles.filter((tile) => tile !== null)) {
      expect(tile.id).toBeTruthy()
      expect(tile.payoutValue).toBeGreaterThan(0)
    }
  })

  it('returns complete payloads for every tile in a multi-hit feature step', () => {
    const multiHitProfile: FeatureProfile = {
      ...fossilProfile,
      hitGeneration: {
        hitProbability: 1,
        multiHitProbability: 1,
        maxTilesPerHit: 3,
      },
    }
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(multiHitProfile, hitRng)
    const next = stepFeatureSession(session)
    const reveals = next.steps.at(-1)?.reveals ?? []

    expect(reveals).toHaveLength(3)
    for (const reveal of reveals) {
      expect(reveal.tile.id).toBeTruthy()
      expect(reveal.tile.displayName).toBeTruthy()
      expect(reveal.tile.payoutValue).toBeGreaterThan(0)
      expect(next.tiles[reveal.index]).toEqual(reveal.tile)
    }
  })

  it('produces no reveal event on a miss and preserves existing tile payloads', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const first = stepFeatureSession(createFeatureSession(fossilProfile, hitRng))
    const revealedBeforeMiss = first.tiles.map((tile) => (tile ? { ...tile } : null))
    const missRng: Rng = { next: () => 0.99, int: (min) => min }
    const next = stepFeatureSession({ ...first, rng: missRng })

    expect(next.steps.at(-1)?.hit).toBe(false)
    expect(next.steps.at(-1)?.reveals).toEqual([])
    expect(next.tiles).toEqual(revealedBeforeMiss)
  })

  it('matches the completion runner when stepped with the same seed', () => {
    const resolved = playFeatureToCompletion(
      fossilProfile,
      createSeededRng(2468),
    )
    let session = createFeatureSession(
      fossilProfile,
      createSeededRng(2468),
    )
    while (!session.isComplete) session = stepFeatureSession(session)
    expect(featureSessionToResult(session)).toEqual(resolved)
  })

  it('ends after three consecutive misses', () => {
    const missRng: Rng = { next: () => 0.99, int: (min) => min }
    const result = featureEngine.play(fossilProfile, missRng)
    expect(result.steps).toHaveLength(3)
    expect(result.steps.at(-1)?.respinsRemaining).toBe(0)
    expect(result.totalWin).toBe(0)
  })

  it('ends when every tile has been revealed', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const result = featureEngine.play(fossilProfile, hitRng)
    expect(result.fullyRevealed).toBe(true)
    expect(result.tiles.every((tile) => tile !== null)).toBe(true)
    expect(result.steps).toHaveLength(25)
  })

  it('uses bonus respins initially but resets to the standard three after a hit', () => {
    const rolls = [0, 0.99, 0.99, 0.99]
    const rng: Rng = {
      next: () => rolls.shift() ?? 0.99,
      int: (min) => min,
    }
    const result = featureEngine.play(fossilProfile, rng, 5)
    expect(result.startingRespins).toBe(5)
    expect(result.steps[0].respinsRemaining).toBe(3)
    expect(result.steps.at(-1)?.respinsRemaining).toBe(0)
    expect(result.steps).toHaveLength(4)
  })

  it('executes a non-themed profile with collectors, jackpots, and completion pay', () => {
    const profile: FeatureProfile = {
      id: 'test-profile',
      displayName: 'Test Feature',
      startingRespins: 1,
      boardWidth: 1,
      boardHeight: 1,
      hitGeneration: {
        hitProbability: 1,
        multiHitProbability: 0,
        maxTilesPerHit: 1,
      },
      collectorProbability: 0,
      collectors: [],
      jackpotProbability: 1,
      jackpotWeights: [
        { id: 'top-award', displayName: 'Top Award', weight: 1, payoutValue: 10 },
      ],
      tileTable: [
        {
          id: 'basic',
          displayName: 'Basic',
          rarity: 'common',
          rarityWeight: 1,
          payoutValue: 1,
        },
      ],
      payoutRules: {
        tileValueMultiplier: 1,
        collectorCollectsExistingTiles: true,
        hitResetsRespinsTo: 1,
      },
      completionReward: 5,
    }
    const rng: Rng = { next: () => 0, int: (min) => min }
    const result = featureEngine.play(profile, rng)
    expect(result.tiles[0]?.kind).toBe('jackpot')
    expect(result.totalWin).toBe(15)
    expect(result.completionReward).toBe(5)
  })

  it('uses named tile definitions from the supplied profile', () => {
    const rng: Rng = { next: () => 0, int: (min) => min }
    const result = featureEngine.play(fossilProfile, rng)
    expect(result.tiles[0]?.id).toBe('small-fossil')
    expect(result.tiles[0]?.displayName).toBe('Small Fossil')
  })

  it('adds Fossil Progression progress from configured tile contributions', () => {
    const rng: Rng = { next: () => 0, int: (min) => min }
    const next = stepFeatureSession(createFeatureSession(fossilProfile, rng))
    const limbs = next.progression?.sections.find((section) => section.id === 'limbs')

    expect(limbs?.piecesFound).toBe(1)
    expect(limbs?.completed).toBe(false)
    expect(next.steps.at(-1)?.progressionEvents).toContainEqual({
      type: 'piece-found',
      sectionId: 'limbs',
      sectionName: 'Limbs',
      piecesAdded: 1,
    })
  })

  it('awards section completion bonuses once when Progression sections complete', () => {
    const rng: Rng = { next: () => 0, int: (min) => min }
    let session = createFeatureSession(unscaledFossilProfile, rng)
    session = stepFeatureSession(session)
    session = stepFeatureSession(session)
    session = stepFeatureSession(session)
    const limbs = session.progression?.sections.find((section) => section.id === 'limbs')

    expect(limbs?.completed).toBe(true)
    expect(session.steps.at(-1)?.progressionEvents).toContainEqual({
      type: 'section-complete',
      sectionId: 'limbs',
      sectionName: 'Limbs',
      bonusAwarded: 6,
    })
    expect(session.steps.at(-1)?.bonusAwarded).toBe(6)
    expect(session.totalWin).toBe(24)
  })

  it('awards classification bonuses at feature completion', () => {
    const profile: FeatureProfile = {
      ...fossilProfile,
      boardWidth: 1,
      boardHeight: 1,
      payoutRules: {
        ...fossilProfile.payoutRules,
        tileValueMultiplier: 1,
      },
      hitGeneration: {
        hitProbability: 1,
        multiHitProbability: 0,
        maxTilesPerHit: 1,
      },
      tileTable: [
        {
          id: 'amber-test',
          displayName: 'Amber Test',
          rarity: 'rare',
          rarityWeight: 1,
          payoutValue: 5,
          classificationTag: 'amber-sample',
        },
      ],
      progression: {
        id: 'test-progression',
        displayName: 'Test Progression',
        sections: [{ id: 'skull', displayName: 'Skull', requiredPieces: 1, completionBonus: 0 }],
        fullCompletionBonus: 0,
        classificationRules: [
          {
            id: 'amber-preserved',
            displayName: 'Amber Preserved',
            requiredTags: ['amber-sample'],
            bonus: 7,
          },
        ],
      },
    }
    const rng: Rng = { next: () => 0, int: (min) => min }
    const result = featureEngine.play(profile, rng)

    expect(result.progression?.classificationName).toBe('Amber Preserved')
    expect(result.totalWin).toBe(12)
    expect(result.steps.at(-1)?.bonusAwarded).toBe(7)
  })

  it('evolves existing tiles through generic profile configuration', () => {
    const profile: FeatureProfile = {
      id: 'evolution-test',
      displayName: 'Evolution Test',
      startingRespins: 3,
      boardWidth: 2,
      boardHeight: 1,
      hitGeneration: {
        hitProbability: 1,
        multiHitProbability: 0,
        maxTilesPerHit: 1,
      },
      collectorProbability: 0,
      collectors: [],
      jackpotProbability: 0,
      jackpotWeights: [],
      tileTable: [
        {
          id: 'egg',
          displayName: 'Egg',
          rarity: 'common',
          rarityWeight: 1,
          payoutValue: 2,
        },
      ],
      tileEvolution: [
        {
          fromTileId: 'egg',
          probability: 1,
          toTile: {
            id: 'hatchling',
            displayName: 'Hatchling',
            rarity: 'uncommon',
            rarityWeight: 1,
            payoutValue: 10,
          },
        },
      ],
      payoutRules: {
        tileValueMultiplier: 1,
        collectorCollectsExistingTiles: true,
        hitResetsRespinsTo: 3,
      },
      completionReward: 0,
    }
    const rng: Rng = { next: () => 0, int: (min) => min }
    const first = stepFeatureSession(createFeatureSession(profile, rng))
    const second = stepFeatureSession(first)

    expect(first.steps.at(-1)?.reveals[0].tile.id).toBe('egg')
    expect(first.steps.at(-1)?.evolutionEvents).toEqual([])
    expect(first.totalWin).toBe(2)
    expect(second.tiles[0]?.id).toBe('hatchling')
    expect(second.tiles[1]?.id).toBe('egg')
    expect(second.steps.at(-1)?.evolutionEvents?.[0]).toMatchObject({
      index: 0,
      fromTile: {
        id: 'egg',
        displayName: 'Egg',
        payoutValue: 2,
      },
      toTile: {
        id: 'hatchling',
        displayName: 'Hatchling',
        payoutValue: 10,
      },
      payoutIncrease: 8,
    })
    expect(second.steps.at(-1)?.evolutionEvents).toHaveLength(1)
    expect(second.totalWin).toBe(12)
  })

  it('does not evolve newly revealed tiles until a future successful survey', () => {
    const profile: FeatureProfile = {
      id: 'new-reveal-evolution-test',
      displayName: 'New Reveal Evolution Test',
      startingRespins: 3,
      boardWidth: 1,
      boardHeight: 1,
      hitGeneration: {
        hitProbability: 1,
        multiHitProbability: 0,
        maxTilesPerHit: 1,
      },
      collectorProbability: 0,
      collectors: [],
      jackpotProbability: 0,
      jackpotWeights: [],
      tileTable: [
        {
          id: 'egg',
          displayName: 'Egg',
          rarity: 'common',
          rarityWeight: 1,
          payoutValue: 2,
        },
      ],
      tileEvolution: [
        {
          fromTileId: 'egg',
          probability: 1,
          toTile: {
            id: 'hatchling',
            displayName: 'Hatchling',
            rarity: 'uncommon',
            rarityWeight: 1,
            payoutValue: 10,
          },
        },
      ],
      payoutRules: {
        tileValueMultiplier: 1,
        collectorCollectsExistingTiles: true,
        hitResetsRespinsTo: 3,
      },
      completionReward: 0,
    }
    const rng: Rng = { next: () => 0, int: (min) => min }
    const next = stepFeatureSession(createFeatureSession(profile, rng))

    expect(next.tiles[0]?.id).toBe('egg')
    expect(next.steps.at(-1)?.evolutionEvents).toEqual([])
  })
})

describe('payout calculation', () => {
  it('pays orthogonal clusters of four or more and excludes Footprints', () => {
    const board: Board = [
      ['trexTooth', 'trexTooth', 'raptorClaw', 'crate', 'crate'],
      ['trexTooth', 'campWild', 'raptorClaw', 'crate', 'crate'],
      ['trexTooth', 'raptorClaw', 'raptorClaw', 'footprint', 'footprint'],
      ['jeep', 'scientist', 'raptorClaw', 'footprint', 'footprint'],
      ['helicopter', 'scientist', 'compass', 'crate', 'footprint'],
    ]
    const result = calculateClusterWins(board, DEFAULT_CONFIG)
    expect(result.wins.map((win) => [win.symbol, win.size, win.payout])).toEqual([
      ['trexTooth', 5, 0.512],
      ['raptorClaw', 6, 1.281],
      ['crate', 4, 0.146],
    ])
    expect(result.wins.some((win) => win.symbol === 'trexTooth' && win.wildAssisted)).toBe(
      true,
    )
    expect(result.total).toBeCloseTo(1.939)
  })

  it('uses Expedition Camp Wild as a substitute for premium clusters', () => {
    const board: Board = [
      ['jeep', 'campWild', 'jeep', 'jeep', 'footprint'],
      ['crate', 'helicopter', 'scientist', 'compass', 'footprint'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['crate', 'helicopter', 'scientist', 'compass', 'footprint'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    const result = calculateClusterWins(board, DEFAULT_CONFIG)
    expect(result.wins).toContainEqual({
      symbol: 'jeep',
      size: 4,
      cells: [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 0, column: 2 },
        { row: 0, column: 3 },
      ],
      payout: 0.268,
      wildAssisted: true,
    })
  })

  it('does not let Expedition Camp Wild substitute for Footprints', () => {
    const board: Board = [
      ['footprint', 'campWild', 'footprint', 'footprint', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toHaveLength(0)
    expect(isFeatureTriggered(board)).toBe(true)

    const twoFootprintsAndWild: Board = [
      ['footprint', 'campWild', 'footprint', 'crate', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(isFeatureTriggered(twoFootprintsAndWild)).toBe(false)
  })

  it('does not let Expedition Camp Wild substitute for Predator Tracks', () => {
    const board: Board = [
      ['predatorTracks', 'campWild', 'predatorTracks', 'predatorTracks', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    const trigger = resolveTriggeredFeature(board, DEFAULT_CONFIG)
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toHaveLength(0)
    expect(trigger.profile?.id).toBe('predator-valley')

    const twoTracksAndWild: Board = [
      ['predatorTracks', 'campWild', 'predatorTracks', 'crate', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(resolveTriggeredFeature(twoTracksAndWild, DEFAULT_CONFIG).profile).toBeNull()
  })

  it('does not let Expedition Camp Wild substitute for Nesting Eggs', () => {
    const board: Board = [
      ['nestingEggs', 'campWild', 'nestingEggs', 'nestingEggs', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    const trigger = resolveTriggeredFeature(board, DEFAULT_CONFIG)
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toHaveLength(0)
    expect(trigger.profile?.id).toBe('nesting-grounds')

    const twoEggsAndWild: Board = [
      ['nestingEggs', 'campWild', 'nestingEggs', 'crate', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(resolveTriggeredFeature(twoEggsAndWild, DEFAULT_CONFIG).profile).toBeNull()
  })

  it("uses Golden Amber's dedicated paytable", () => {
    const board: Board = [
      ['goldenAmber', 'goldenAmber', 'goldenAmber', 'goldenAmber', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'pickaxe', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toContainEqual({
      symbol: 'goldenAmber',
      size: 4,
      cells: [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 0, column: 2 },
        { row: 0, column: 3 },
      ],
      payout: 1.103,
      wildAssisted: false,
    })
  })

  it('does not connect matching symbols diagonally', () => {
    const board: Board = [
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['raptorClaw', 'trexTooth', 'pterosaurFeather', 'sauropodHorn', 'triceratopsEggshell'],
      ['triceratopsEggshell', 'pterosaurFeather', 'trexTooth', 'raptorClaw', 'sauropodHorn'],
      ['pterosaurFeather', 'sauropodHorn', 'raptorClaw', 'trexTooth', 'triceratopsEggshell'],
      ['sauropodHorn', 'triceratopsEggshell', 'pterosaurFeather', 'raptorClaw', 'trexTooth'],
    ]
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toHaveLength(0)
  })

  it('awards Field Notes only for unique natural evidence symbols', () => {
    const board: Board = [
      ['trexTooth', 'trexTooth', 'campWild', 'jeep', 'crate'],
      ['raptorClaw', 'jeep', 'crate', 'scientist', 'compass'],
      ['triceratopsEggshell', 'jeep', 'crate', 'scientist', 'compass'],
      ['footprint', 'helicopter', 'crate', 'scientist', 'compass'],
      ['footprint', 'helicopter', 'crate', 'scientist', 'compass'],
    ]
    expect(calculateFieldNotes(board, DEFAULT_CONFIG)).toEqual({
      uniqueEvidence: ['trexTooth', 'raptorClaw', 'triceratopsEggshell'],
      bonus: 3.2,
      milestone: 3,
      milestoneReward: 3.2,
      nextMilestone: 4,
      nextMilestoneReward: 11.5,
      remainingToNextMilestone: 1,
    })
  })

  it('does not count wilds, footprints, valley cues, or premium symbols as Field Notes evidence', () => {
    const board: Board = [
      ['campWild', 'campWild', 'footprint', 'predatorTracks', 'nestingEggs'],
      ['helicopter', 'scientist', 'compass', 'crate', 'jeep'],
      ['crate', 'jeep', 'pickaxe', 'scientist', 'helicopter'],
      ['footprint', 'campWild', 'crate', 'scientist', 'compass'],
      ['jeep', 'helicopter', 'crate', 'scientist', 'pickaxe'],
    ]
    expect(calculateFieldNotes(board, DEFAULT_CONFIG)).toEqual({
      uniqueEvidence: [],
      bonus: 0,
      milestone: null,
      milestoneReward: 0,
      nextMilestone: 3,
      nextMilestoneReward: 3.2,
      remainingToNextMilestone: 3,
    })
  })
})

describe('simulation diagnostics', () => {
  it('is reproducible and normalizes core distributions', () => {
    const first = runSimulation(DEFAULT_CONFIG, 1_000, 123)
    const second = runSimulation(DEFAULT_CONFIG, 1_000, 123)
    expect(first).toEqual(second)
    expect(
      Object.values(first.footprintDistribution).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1)
    expect(
      Object.values(first.symbolFrequencyDistribution).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(1)
  })

  it('preserves the tuned three-valley payout stream', () => {
    const result = runSimulation(DEFAULT_CONFIG, 10_000, 123)
    expect(result.baseRtp).toBeCloseTo(0.2623461, 4)
    expect(result.evidenceRtp).toBeCloseTo(0.20393, 4)
    expect(result.evidenceRtpByMilestone['3']).toBeCloseTo(0.13888, 4)
    expect(result.evidenceRtpByMilestone['4']).toBeCloseTo(0.04255, 4)
    expect(result.evidenceRtpByMilestone['5']).toBeCloseTo(0.0225, 4)
    expect(result.featureRtp).toBeCloseTo(0.516328, 4)
    expect(result.totalRtp).toBeCloseTo(0.9826041, 4)
    expect(result.triggerFrequency).toBeCloseTo(0.0113, 4)
    expect(result.averageFeatureWin).toBeCloseTo(45.69274336283186, 4)
    expect(result.evidenceBonusFrequency).toBeCloseTo(0.0474, 4)
    expect(result.evidenceMilestoneFrequency['3']).toBeCloseTo(0.0434, 4)
    expect(result.evidenceMilestoneFrequency['4']).toBeCloseTo(0.0037, 4)
    expect(result.evidenceMilestoneFrequency['5']).toBeCloseTo(0.0003, 4)
    expect(result.wildAppearanceRate).toBeCloseTo(0.012224, 4)
    expect(result.wildAssistedClusterFrequency).toBeCloseTo(0.0962, 4)
    expect(result.goldenAmberHitFrequency).toBeCloseTo(0.0239, 4)
    expect(result.twoFootprintFrequency).toBeCloseTo(0.0339, 4)
    expect(result.twoPredatorTrackFrequency).toBeCloseTo(0.0327, 4)
    expect(result.twoNestingEggFrequency).toBeCloseTo(0.0348, 4)
    expect(result.baseWinsOver10Frequency).toBeCloseTo(0.0065, 4)
    expect(result.predatorTrackDistribution['2']).toBeGreaterThan(0)
    expect(result.nestingEggDistribution['2']).toBeGreaterThan(0)
    expect(result.featureBreakdown['fossil-valley'].triggerFrequency).toBeCloseTo(0.0049, 4)
    expect(result.featureBreakdown['predator-valley'].triggerFrequency).toBeCloseTo(0.0027, 4)
    expect(result.featureBreakdown['nesting-grounds'].triggerFrequency).toBeCloseTo(0.0037, 4)
    expect(result.featureBreakdown['fossil-valley'].rtp).toBeCloseTo(0.155824, 4)
    expect(result.featureBreakdown['predator-valley'].rtp).toBeCloseTo(0.07694, 4)
    expect(result.featureBreakdown['nesting-grounds'].rtp).toBeCloseTo(0.283564, 4)
    expect(
      result.featureBreakdown['nesting-grounds'].evolutionDiagnostics?.averageSourceTilesCreated,
    ).toBeGreaterThan(2)
    expect(
      result.featureBreakdown['nesting-grounds'].evolutionDiagnostics?.averageEvolvedTiles,
    ).toBeGreaterThan(1)
  })
})
