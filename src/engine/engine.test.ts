import { describe, expect, it } from 'vitest'
import {
  calculateFieldNotes,
  getFeatureStartingRespins,
  isFeatureTriggered,
} from './baseGame'
import { DEFAULT_CONFIG } from './config'
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
})

describe('FeatureEngine', () => {
  it('creates an active session with starting respins and no reveals', () => {
    const session = createFeatureSession(
      DEFAULT_CONFIG.featureProfile,
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
      DEFAULT_CONFIG.featureProfile,
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
    const session = createFeatureSession(DEFAULT_CONFIG.featureProfile, missRng)
    const next = stepFeatureSession(session)
    expect(next.respinsRemaining).toBe(2)
    expect(next.steps.at(-1)?.hit).toBe(false)
    expect(next.isComplete).toBe(false)
  })

  it('reveals a tile and resets respins on a hit', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(DEFAULT_CONFIG.featureProfile, hitRng)
    const next = stepFeatureSession(session)
    expect(next.tiles.filter((tile) => tile !== null).length).toBeGreaterThanOrEqual(1)
    expect(next.respinsRemaining).toBe(
      DEFAULT_CONFIG.featureProfile.payoutRules.hitResetsRespinsTo,
    )
    expect(next.steps.at(-1)?.hit).toBe(true)
  })

  it('returns successful reveal events with complete tile payloads', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(DEFAULT_CONFIG.featureProfile, hitRng)
    const next = stepFeatureSession(session)
    const reveal = next.steps.at(-1)?.reveals[0]

    expect(reveal).toBeDefined()
    expect(reveal?.tile.id).toBeTruthy()
    expect(reveal?.tile.displayName).toBeTruthy()
    expect(reveal?.tile.payoutValue).toBeGreaterThan(0)
  })

  it('updates the board tile and reveal event together on the same feature step', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(DEFAULT_CONFIG.featureProfile, hitRng)
    const next = stepFeatureSession(session)
    const reveal = next.steps.at(-1)?.reveals[0]

    expect(reveal).toBeDefined()
    expect(next.tiles[reveal!.index]).toEqual(reveal!.tile)
  })

  it('never leaves a revealed board tile without a discovery id or value', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const session = createFeatureSession(DEFAULT_CONFIG.featureProfile, hitRng)
    const next = stepFeatureSession(session)

    for (const tile of next.tiles.filter((tile) => tile !== null)) {
      expect(tile.id).toBeTruthy()
      expect(tile.payoutValue).toBeGreaterThan(0)
    }
  })

  it('returns complete payloads for every tile in a multi-hit feature step', () => {
    const multiHitProfile: FeatureProfile = {
      ...DEFAULT_CONFIG.featureProfile,
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
    const first = stepFeatureSession(createFeatureSession(DEFAULT_CONFIG.featureProfile, hitRng))
    const revealedBeforeMiss = first.tiles.map((tile) => (tile ? { ...tile } : null))
    const missRng: Rng = { next: () => 0.99, int: (min) => min }
    const next = stepFeatureSession({ ...first, rng: missRng })

    expect(next.steps.at(-1)?.hit).toBe(false)
    expect(next.steps.at(-1)?.reveals).toEqual([])
    expect(next.tiles).toEqual(revealedBeforeMiss)
  })

  it('matches the completion runner when stepped with the same seed', () => {
    const resolved = playFeatureToCompletion(
      DEFAULT_CONFIG.featureProfile,
      createSeededRng(2468),
    )
    let session = createFeatureSession(
      DEFAULT_CONFIG.featureProfile,
      createSeededRng(2468),
    )
    while (!session.isComplete) session = stepFeatureSession(session)
    expect(featureSessionToResult(session)).toEqual(resolved)
  })

  it('ends after three consecutive misses', () => {
    const missRng: Rng = { next: () => 0.99, int: (min) => min }
    const result = featureEngine.play(DEFAULT_CONFIG.featureProfile, missRng)
    expect(result.steps).toHaveLength(3)
    expect(result.steps.at(-1)?.respinsRemaining).toBe(0)
    expect(result.totalWin).toBe(0)
  })

  it('ends when every tile has been revealed', () => {
    const hitRng: Rng = { next: () => 0, int: (min) => min }
    const result = featureEngine.play(DEFAULT_CONFIG.featureProfile, hitRng)
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
    const result = featureEngine.play(DEFAULT_CONFIG.featureProfile, rng, 5)
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
    const result = featureEngine.play(DEFAULT_CONFIG.featureProfile, rng)
    expect(result.tiles[0]?.id).toBe('small-fossil')
    expect(result.tiles[0]?.displayName).toBe('Small Fossil')
  })
})

describe('payout calculation', () => {
  it('pays orthogonal clusters of four or more and excludes Footprints', () => {
    const board: Board = [
      ['trexTooth', 'trexTooth', 'raptorClaw', 'crate', 'crate'],
      ['trexTooth', 'campWild', 'raptorClaw', 'crate', 'crate'],
      ['trexTooth', 'raptorClaw', 'raptorClaw', 'footprint', 'footprint'],
      ['jeep', 'scientist', 'raptorClaw', 'footprint', 'footprint'],
      ['helicopter', 'scientist', 'map', 'crate', 'footprint'],
    ]
    const result = calculateClusterWins(board, DEFAULT_CONFIG)
    expect(result.wins.map((win) => [win.symbol, win.size, win.payout])).toEqual([
      ['trexTooth', 5, 0.44],
      ['raptorClaw', 6, 0.88],
      ['crate', 4, 0.14],
    ])
    expect(result.wins.some((win) => win.symbol === 'trexTooth' && win.wildAssisted)).toBe(
      true,
    )
    expect(result.total).toBeCloseTo(1.46)
  })

  it('uses Expedition Camp Wild as a substitute for premium clusters', () => {
    const board: Board = [
      ['jeep', 'campWild', 'jeep', 'jeep', 'footprint'],
      ['crate', 'helicopter', 'scientist', 'map', 'footprint'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['crate', 'helicopter', 'scientist', 'map', 'footprint'],
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
      payout: 0.14,
      wildAssisted: true,
    })
  })

  it('does not let Expedition Camp Wild substitute for Footprints', () => {
    const board: Board = [
      ['footprint', 'campWild', 'footprint', 'footprint', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(calculateClusterWins(board, DEFAULT_CONFIG).wins).toHaveLength(0)
    expect(isFeatureTriggered(board)).toBe(true)

    const twoFootprintsAndWild: Board = [
      ['footprint', 'campWild', 'footprint', 'crate', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
    ]
    expect(isFeatureTriggered(twoFootprintsAndWild)).toBe(false)
  })

  it("uses Golden Amber's dedicated high-value paytable", () => {
    const board: Board = [
      ['goldenAmber', 'goldenAmber', 'goldenAmber', 'goldenAmber', 'crate'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
      ['trexTooth', 'raptorClaw', 'triceratopsEggshell', 'pterosaurFeather', 'sauropodHorn'],
      ['jeep', 'helicopter', 'scientist', 'map', 'crate'],
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
      payout: 10,
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
      ['raptorClaw', 'jeep', 'crate', 'scientist', 'map'],
      ['triceratopsEggshell', 'jeep', 'crate', 'scientist', 'map'],
      ['footprint', 'helicopter', 'crate', 'scientist', 'map'],
      ['footprint', 'helicopter', 'crate', 'scientist', 'map'],
    ]
    expect(calculateFieldNotes(board)).toEqual({
      uniqueEvidence: ['trexTooth', 'raptorClaw', 'triceratopsEggshell'],
      bonus: 5,
    })
  })

  it('does not count wilds, footprints, or premium symbols as Field Notes evidence', () => {
    const board: Board = [
      ['campWild', 'campWild', 'footprint', 'jeep', 'crate'],
      ['helicopter', 'scientist', 'map', 'crate', 'jeep'],
      ['crate', 'jeep', 'map', 'scientist', 'helicopter'],
      ['footprint', 'campWild', 'crate', 'scientist', 'map'],
      ['jeep', 'helicopter', 'crate', 'scientist', 'map'],
    ]
    expect(calculateFieldNotes(board)).toEqual({
      uniqueEvidence: [],
      bonus: 0,
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

  it('preserves the tuned Fossil Valley payout stream', () => {
    const result = runSimulation(DEFAULT_CONFIG, 10_000, 123)
    expect(result.baseRtp).toBeCloseTo(0.48869, 4)
    expect(result.evidenceRtp).toBeCloseTo(0.04, 4)
    expect(result.featureRtp).toBeCloseTo(0.4074, 4)
    expect(result.totalRtp).toBeCloseTo(0.93609, 4)
    expect(result.triggerFrequency).toBeCloseTo(0.009, 4)
    expect(result.averageFeatureWin).toBeCloseTo(45.27, 2)
    expect(result.evidenceBonusFrequency).toBeCloseTo(0.0072, 4)
    expect(result.wildAppearanceRate).toBeCloseTo(0.011944, 4)
    expect(result.wildAssistedClusterFrequency).toBeCloseTo(0.1555, 4)
  })
})
