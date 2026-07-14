import type { FeatureProfile } from '../featureTypes'
import { FOSSIL_VALLEY_PROFILE } from './fossilValley'

export const LOST_VALLEY_PROFILE: FeatureProfile = {
  ...FOSSIL_VALLEY_PROFILE,
  id: 'lost-valley',
  displayName: 'The Lost Valley',
  triggerKind: 'evidence-completion',
  triggerSymbol: undefined,
  triggerDisplayName: 'Field Notes Complete',
  theme: 'lost',
  startingRespins: 5,
  hitGeneration: {
    hitProbability: 0.43,
    multiHitProbability: 0.12,
    maxTilesPerHit: 2,
  },
  collectorProbability: 0.035,
  collectors: [
    {
      id: 'expedition-survey-team',
      displayName: 'Survey Team',
      rarityWeight: 1,
      payoutMultiplier: 0.18,
    },
  ],
  jackpotProbability: 0,
  jackpotWeights: [],
  tileTable: FOSSIL_VALLEY_PROFILE.tileTable.map((tile) => {
    const rarityBoost =
      tile.rarity === 'legendary'
        ? 4
        : tile.rarity === 'rare'
          ? 3
          : tile.rarity === 'uncommon'
            ? 1.35
            : 0.82
    return {
      ...tile,
      rarityWeight: Math.max(1, Number((tile.rarityWeight * rarityBoost).toFixed(3))),
      payoutValue:
        tile.rarity === 'legendary'
          ? tile.payoutValue + 12
          : tile.rarity === 'rare'
            ? tile.payoutValue + 8
            : tile.payoutValue,
    }
  }),
  progression: {
    ...FOSSIL_VALLEY_PROFILE.progression!,
    id: 'lost-valley-sanctuary',
    displayName: 'Hidden Sanctuary',
    fullCompletionBonus: 28,
    classificationRules: FOSSIL_VALLEY_PROFILE.progression!.classificationRules.map((rule) => ({
      ...rule,
      bonus: rule.bonus + 2,
    })),
  },
  payoutRules: {
    ...FOSSIL_VALLEY_PROFILE.payoutRules,
    tileValueMultiplier: 0.58,
    hitResetsRespinsTo: 3,
  },
  completionReward: 18,
}
