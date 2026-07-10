import type { GameConfig } from './types'
import { FOSSIL_VALLEY_PROFILE } from './profiles/fossilValley'

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
    { symbol: 'jeep', weight: 15.72 },
    { symbol: 'helicopter', weight: 15.72 },
    { symbol: 'scientist', weight: 15.72 },
    { symbol: 'map', weight: 15.72 },
    { symbol: 'crate', weight: 15.72 },
    { symbol: 'footprint', weight: 1.7 },
  ],
  clusterPays: {
    low: [0.21, 0.41, 0.82, 1.65, 3.3],
    premium: [0.11, 0.35, 0.93, 2.31, 5.77],
    goldenAmber: [0.8, 2.4, 6, 12, 24],
  },
  fieldNotesPays: {
    3: 3.2,
    4: 11.5,
    5: 75,
  },
  featureProfile: FOSSIL_VALLEY_PROFILE,
}
