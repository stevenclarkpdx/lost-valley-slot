# Lost Valley Engine

## Current shape

The engine is pure TypeScript. It owns math, seeded randomness, profile
resolution, feature stepping, and simulation. React owns presentation and should
not make probability or payout decisions.

Core files:

- `src/engine/baseGame.ts` resolves weighted 5x5 spins, cluster pays, Field
  Notes, and profile-driven feature triggers.
- `src/engine/featureEngine.ts` executes any `FeatureProfile` through the same
  stepwise session API used by manual play and simulation.
- `src/engine/featureProfiles.ts` is the shared resolver for configured feature
  profiles, trigger symbols, primary-profile tuning, and triggered-profile
  lookup.
- `src/engine/profiles/fossilValley.ts` describes Fossil Valley.
- `src/engine/profiles/predatorValley.ts` describes Predator Valley.
- `src/engine/profiles/nestingGrounds.ts` describes Nesting Grounds.
- `src/engine/simulation.ts` runs the production engine headlessly and reports
  combined plus per-feature diagnostics.

`GameConfig.featureProfiles` is the authoritative multi-feature source of truth.
The legacy single `featureProfile` shape is accepted only by JSON import for
backward compatibility and is immediately normalized into `featureProfiles`.

## Feature profiles

A `FeatureProfile` describes:

- id, display name, trigger symbol, and optional theme tag;
- board dimensions;
- starting respins and hit-reset respins;
- hit probability, multi-hit probability, and max tiles per hit;
- weighted reveal tiles;
- optional generic tile evolution rules;
- optional collectors and jackpots;
- payout rules and completion reward;
- optional generic `progression` configuration.

The engine does not know about Fossil Assembly, Tracking Confidence, dinosaurs,
predators, or nesting grounds. It only understands reveal boards, respins, hits,
tile generation, profile-driven tile evolution, payouts, and generic progression
events. Presentation maps those generic events into theme-specific language:

- Fossil Valley presents progression as Fossil Assembly.
- Predator Valley presents progression as Tracking Confidence.
- Nesting Grounds presents progression as a Nesting Life Cycle, with Eggs
  hatching into Hatchlings via generic tile evolution.

## Runtime APIs

- `createFeatureSession(profile, rng, startingRespins?)` creates an active
  unrevealed session without resolving the feature.
- `stepFeatureSession(session)` executes exactly one survey/respin step.
- `playFeatureToCompletion(profile, rng, startingRespins?)` repeatedly steps the
  same session model for simulation.

Manual play and simulation therefore share one rule path.

## Adding another valley/profile

To add a fourth feature profile without modifying engine code:

1. Create `src/engine/profiles/newValley.ts`.
2. Export a `FeatureProfile` with a unique `id`, `triggerSymbol`, weighted tiles,
   hit settings, payout rules, optional `progression`, and optional
   `tileEvolution`.
3. Add the profile to `DEFAULT_CONFIG.featureProfiles`.
4. Add or import presentation assets for that profile in React.
5. Add tests for trigger routing, deterministic stepping, and profile-specific
   payout/progression behavior.

Do not add `if new-valley` branches to `featureEngine.ts`. If the feature cannot
be described as profile data, extend the generic profile contract first.
