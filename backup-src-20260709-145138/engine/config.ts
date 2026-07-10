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
    { symbol: 'campWild', weight: 0.05 },
    { symbol: 'jeep', weight: 16 },
    { symbol: 'helicopter', weight: 16 },
    { symbol: 'scientist', weight: 16 },
    { symbol: 'map', weight: 16 },
    { symbol: 'crate', weight: 16 },
    { symbol: 'footprint', weight: 1.35 },
  ],
  clusterPays: {
    low: [0.28, 0.56, 1.12, 2.24, 4.48],
    premium: [0.17472, 0.52416, 1.39776, 3.4944, 8.736],
  },
  featureProfile: FOSSIL_VALLEY_PROFILE,
}
