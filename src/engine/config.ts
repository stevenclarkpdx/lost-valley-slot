import type { GameConfig } from './types'
import { FOSSIL_VALLEY_PROFILE } from './profiles/fossilValley'
import { PREDATOR_VALLEY_PROFILE } from './profiles/predatorValley'
import { NESTING_GROUNDS_PROFILE } from './profiles/nestingGrounds'
import { LOST_VALLEY_PROFILE } from './profiles/lostValley'

export const DEFAULT_CONFIG: GameConfig = {
  boardSize: 5,
  symbolWeights: [
    { symbol: 'trexTooth', weight: 0.82 },
    { symbol: 'raptorClaw', weight: 0.82 },
    { symbol: 'triceratopsEggshell', weight: 0.82 },
    { symbol: 'pterosaurFeather', weight: 0.82 },
    { symbol: 'sauropodHorn', weight: 0.82 },
    { symbol: 'campWild', weight: 1.15 },
    { symbol: 'goldenAmber', weight: 10 },
    { symbol: 'compass', weight: 13.1 },
    { symbol: 'pickaxe', weight: 13.1 },
    { symbol: 'jeep', weight: 13.1 },
    { symbol: 'helicopter', weight: 13.1 },
    { symbol: 'scientist', weight: 13.1 },
    { symbol: 'crate', weight: 13.1 },
    { symbol: 'footprint', weight: 1.2 },
    { symbol: 'predatorTracks', weight: 1.2 },
    { symbol: 'nestingEggs', weight: 1.2 },
  ],
  clusterPays: {
    gray: [0.146, 0.439, 1.159, 2.806, 7.076],
    brown: [0.195, 0.512, 1.281, 3.05, 7.686],
    green: [0.268, 0.793, 2.074, 5.002, 12.444],
    blue: [0.39, 1.159, 3.05, 7.32, 18.3],
    goldenAmber: [1.103, 3.309, 8.272, 16.543, 33.086],
  },
  fieldNotesPays: {
    3: 3.2,
    4: 11.5,
    5: 0,
  },
  featureProfiles: [
    FOSSIL_VALLEY_PROFILE,
    PREDATOR_VALLEY_PROFILE,
    NESTING_GROUNDS_PROFILE,
    LOST_VALLEY_PROFILE,
  ],
}
