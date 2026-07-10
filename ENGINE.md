# Lost Valley Feature Engine

## Architecture

`FeatureEngine` is a pure TypeScript executor. It knows only about reveal boards,
respins, hits, weighted tiles, collectors, jackpots, payouts, and completion. It
contains no theme, valley, or presentation logic.

The main pieces are:

- `src/engine/featureEngine.ts` — executes any supplied profile using an injected
  seeded RNG.
- `src/engine/featureTypes.ts` — defines `FeatureProfile`, tile definitions,
  generated results, and supporting collector/jackpot contracts.
- `src/engine/profiles/` — contains feature-specific configuration. Fossil Valley
  is implemented entirely in `fossilValley.ts`.
- `src/engine/simulation.ts` — runs the same engine and profile used by manual
  play, keeping simulation results deterministic and representative.

A `FeatureProfile` completely describes:

- Identity and display name
- Board width and height
- Starting and hit-reset respins
- Hit and multi-hit probabilities
- Weighted tile definitions and payouts
- Collector and jackpot probabilities/tables
- Payout rules
- Full-board completion reward

The engine exposes one shared transition model:

- `createFeatureSession(profile, rng, startingRespins?)` creates an active
  zero-reveal session without consuming RNG.
- `stepFeatureSession(session)` executes exactly one respin and returns the next
  session state.
- `playFeatureToCompletion(profile, rng, startingRespins?)` repeatedly applies
  that same step function and returns a generic `FeatureResult` for simulation.

React stores a `FeatureSession` and advances it only on player input. It does not
calculate feature math. Simulation uses the completion runner, so interactive
play and bulk analytics cannot drift into separate rule implementations.

## Creating a fourth feature

1. Add a file such as `src/engine/profiles/fourthFeature.ts`.
2. Export an object satisfying `FeatureProfile`.
3. Give every tile, collector, and jackpot a stable unique ID.
4. Set all probabilities, weights, payout values, respin rules, and completion
   reward in that object.
5. Pass the new profile to `createFeatureSession()` for manual play and
   `playFeatureToCompletion()` for simulation.
6. Add seeded tests for termination, determinism, and the profile's intended
   payout behavior.

Example:

```ts
import type { FeatureProfile } from '../featureTypes'

export const FOURTH_FEATURE: FeatureProfile = {
  id: 'fourth-feature',
  displayName: 'Fourth Feature',
  startingRespins: 3,
  boardWidth: 5,
  boardHeight: 5,
  hitGeneration: {
    hitProbability: 0.25,
    multiHitProbability: 0,
    maxTilesPerHit: 1,
  },
  collectorProbability: 0,
  collectors: [],
  jackpotProbability: 0,
  jackpotWeights: [],
  tileTable: [
    {
      id: 'common-find',
      displayName: 'Common Find',
      rarity: 'common',
      rarityWeight: 10,
      payoutValue: 2,
    },
  ],
  payoutRules: {
    tileValueMultiplier: 1,
    collectorCollectsExistingTiles: true,
    hitResetsRespinsTo: 3,
  },
  completionReward: 0,
}
```

No changes to `featureEngine.ts` are required. Selecting profiles is an
application/configuration concern; executing them remains the engine's job.
