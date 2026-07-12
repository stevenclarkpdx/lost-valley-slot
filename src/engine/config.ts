import type { GameConfig } from './types'
import { FOSSIL_VALLEY_PROFILE } from './profiles/fossilValley'
import { PREDATOR_VALLEY_PROFILE } from './profiles/predatorValley'

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
    { symbol: 'footprint', weight: 1.5 },
    { symbol: 'predatorTracks', weight: 1.5 },
  ],
  clusterPays: {
    low: [0.237, 0.463, 0.927, 1.864, 3.729],
    premium: [0.124, 0.395, 1.051, 2.61, 6.52],
    goldenAmber: [0.904, 2.712, 6.78, 13.56, 27.12],
  },
  fieldNotesPays: {
    3: 3.2,
    4: 11.5,
    5: 75,
  },
  featureProfiles: [FOSSIL_VALLEY_PROFILE, PREDATOR_VALLEY_PROFILE],
}
