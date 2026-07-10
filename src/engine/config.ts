import type { GameConfig } from './types'
import { FOSSIL_VALLEY_PROFILE } from './profiles/fossilValley'

export const DEFAULT_CONFIG: GameConfig = {
  boardSize: 5,
  symbolWeights: [
    { symbol: 'trexTooth', weight: 0.35 },
    { symbol: 'raptorClaw', weight: 0.35 },
    { symbol: 'triceratopsEggshell', weight: 0.35 },
    { symbol: 'pterosaurFeather', weight: 0.35 },
    { symbol: 'sauropodHorn', weight: 0.35 },
    { symbol: 'campWild', weight: 1 },
    { symbol: 'goldenAmber', weight: 0.55 },
    { symbol: 'jeep', weight: 15.72 },
    { symbol: 'helicopter', weight: 15.72 },
    { symbol: 'scientist', weight: 15.72 },
    { symbol: 'map', weight: 15.72 },
    { symbol: 'crate', weight: 15.72 },
    { symbol: 'footprint', weight: 1.35 },
  ],
  clusterPays: {
    low: [0.22, 0.44, 0.88, 1.76, 3.52],
    premium: [0.14, 0.42, 1.12, 2.8, 7],
    goldenAmber: [10, 30, 75, 150, 300],
  },
  featureProfile: FOSSIL_VALLEY_PROFILE,
}
