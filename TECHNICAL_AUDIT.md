# Lost Valley Technical Audit

Date: 2026-07-11

## Context

This audit was performed while the Predator Valley implementation was in progress. The working tree was not clean: source files contained intentional Predator Valley changes, and generated `dist` outputs from a production build were still present. Findings below should be read as a long-term technical-health review rather than a release signoff.

## Current technical posture

Lost Valley has a healthy core direction:

- The math engine is pure TypeScript.
- Randomness is injected through a seeded RNG.
- Base-game cluster logic and feature stepping are mostly deterministic and testable.
- Simulation and interactive feature play share the same feature session transition.
- The project has stayed dependency-light: React, Vite, TypeScript, Vitest.

The main risk is no longer whether the prototype can support interesting ideas. It clearly can. The risk is whether iteration stays fast as the number of valleys, presentation states, art assets, tuning controls, and reward channels grows.

## Critical findings

### 1. The working tree needs stabilization before the next feature/UX pass

Evidence:

- `git status --short` showed many modified source files from Predator Valley.
- Generated `dist` files were also present.
- `node_modules/.vite/vitest/results.json` and `tsconfig.app.tsbuildinfo` had been touched by validation commands.

Impact:

- Future work risks mixing implementation, generated output, and audit changes.
- Tests/builds may be hard to interpret because the baseline is not stable.
- Commits may accidentally include generated artifacts.

Recommended fix:

- Clean generated files.
- Run tests/build.
- Commit the intentional Predator Valley source/assets if they pass, or revert/park them if not ready.
- Only then begin UX/audio/publishing work.

Fix risk: low, but needs care because the Predator Valley work is real project work and should not be discarded accidentally.

### 2. `App.tsx` is overloaded and is now the main iteration bottleneck

Evidence:

- `src/App.tsx` is about 2,800 lines.
- It contains symbol metadata, asset mapping, presentation state, reel timing, feature UI, credit UI, simulation UI, tuning UI, diagnostics, and multiple panels.
- It has many direct `setTimeout` chains and presentation phases inside the same component that owns gameplay session state.

Impact:

- Small UX changes can accidentally affect math, input locking, or feature state.
- Animation timing bugs become hard to isolate.
- Adding Predator/Nesting/audio will require more conditionals unless this is split.

Recommended fix:

- Extract presentation state/timing into a dedicated controller hook.
- Extract UI panels/components into separate files.
- Move symbol/discovery asset metadata out of `App.tsx`.

Fix risk: medium. This is mostly refactor, but animation/input-locking regressions are possible without tests.

### 3. Presentation state is still timer-driven rather than event/sequence-driven

Evidence:

- `App.tsx` uses many `window.setTimeout` calls for spin phases, reel stops, feature survey, reveal, intro, feature exit, and simulation deferral.
- Timers are stored in a shared ref, but the flow is still distributed across one component.
- The presentation phase machine is typed, but transitions are not represented as a data structure that can be inspected, skipped, tested, or replayed.

Impact:

- Timing changes are fragile.
- Input locking can regress.
- Skip Anim/reduced-motion behavior has to be manually kept in sync.
- Audio timing will be difficult because audio needs a stable event timeline.

Recommended fix:

- Introduce a declarative presentation sequence runner.
- Represent each beat as `{ phase, duration, event, payload }`.
- Have base spin, evidence, trail marker, feature transition, survey, reveal, and feature complete consume the same sequencing system.

Fix risk: medium-high, but it is the most valuable refactor before another UX/audio pass.

## Important findings

### 4. The feature progression abstraction is useful but misnamed

Evidence:

- The generic engine now uses `assembly`, `AssemblyProfile`, `AssemblyState`, and `assemblyContribution`.
- Fossil Valley uses this naturally for specimen assembly.
- Predator Valley reuses it as Tracking Confidence.

Impact:

- The engine remains reusable, but future designers and implementers will be confused by Predator Valley having "assembly" state.
- Nesting Grounds or future valleys may force awkward naming and UI conditionals.

Recommended fix:

- Rename the generic abstraction from `Assembly*` to `Progression*`.
- Keep Fossil-specific display language in the Fossil profile/UI mapping.
- Treat "Fossil Assembly" as one implementation of generic feature progression.

Fix risk: medium. Mostly mechanical rename, but touches engine types, tests, and UI.

### 5. Config shape has both `featureProfile` and `featureProfiles`

Evidence:

- `GameConfig` contains both `featureProfile` and `featureProfiles`.
- Tuning and UI still use `config.featureProfile` heavily.
- Simulation uses `featureProfiles` for triggered feature resolution.

Impact:

- There is now an authoritative-source ambiguity.
- Tuning can change Fossil Valley while Predator Valley remains invisible.
- Imported configs may accidentally diverge.

Recommended fix:

- Make `featureProfiles` authoritative.
- Keep a compatibility helper only at import boundaries.
- Add helpers like `primaryFeatureProfile(config)` and `getFeatureProfile(config, id)`.

Fix risk: medium.

### 6. Tuning and diagnostics are no longer aligned with the game

Evidence:

- UI copy still says "Fossil Valley only."
- Tuning controls edit `config.featureProfile`, not a selected profile.
- Diagnostics report overall feature RTP but not Fossil vs Predator RTP.
- Simulation counts Footprint distribution but not Predator Track distribution beyond two-track frequency.

Impact:

- As soon as Predator Valley is active, tuning feedback becomes ambiguous.
- Designers cannot tell whether Fossil, Predator, base game, or Evidence is causing an RTP or pacing issue.

Recommended fix:

- Add per-feature simulation breakdown:
  - trigger count
  - trigger frequency
  - average feature win
  - feature RTP
  - P50/P90/P99
  - average reveals/progression completion
- Make the tuning panel choose a feature profile.

Fix risk: medium.

### 7. CSS is now too large and globally coupled

Evidence:

- `src/styles.css` is about 3,600 lines.
- It contains base game, cabinet, feature, tuning, diagnostics, animation, responsive, and reduced-motion rules.
- Classes like `trigger-footprint`, `footprint-track`, and `lost-valley-panel` are now reused for Predator concepts.

Impact:

- Visual changes are hard to reason about.
- Theme-specific overrides pile up.
- Naming drift makes future work feel slippery.

Recommended fix:

- Split CSS by domain:
  - `styles/base.css`
  - `styles/reels.css`
  - `styles/feature.css`
  - `styles/diagnostics.css`
  - `styles/tuning.css`
  - `styles/themes.css`
- Rename generic destination-cue classes away from Footprint-only language.

Fix risk: low-medium. Mostly organization, but visual regressions are possible.

### 8. Asset size is becoming a performance concern

Evidence:

- Feature/panel background PNGs are large:
  - Predator Valley background: ~951 KB
  - Fossil Valley background: ~747 KB
  - Field Notes panel: ~745 KB
  - Trail Markers panel: ~746 KB
- Production build output showed multiple large raster assets.

Impact:

- Local development is fine, but publishing an alpha for browser play will have unnecessary load cost.
- Friends/family on mobile or slow connections may see sluggish initial load.

Recommended fix:

- Convert large backgrounds/panels to WebP or AVIF.
- Keep source PNGs if desired, but ship compressed versions.
- Add a lightweight asset optimization script before alpha.

Fix risk: low.

### 9. Tests protect math better than presentation

Evidence:

- Engine tests cover RNG, triggers, feature sessions, payouts, Evidence, Wild, Golden Amber, Fossil Assembly, and Predator trigger routing.
- There are no component/integration tests for input locking, animation cancellation, feature entry/exit, or stale reveal rendering.

Impact:

- Math regressions are likely to be caught.
- UX/state-flow regressions may only appear during manual play.

Recommended fix:

- Add a small presentation-state reducer/runner that can be tested without a browser.
- Add tests for:
  - input remains locked until sequence completes
  - skip animation follows same state order
  - feature transition uses triggered feature profile
  - feature session exit updates credit ledger exactly once

Fix risk: low-medium.

## Minor findings

### 10. Documentation is stale

Evidence:

- `ARCHITECTURE.txt` still describes Fossil Valley only and mentions `src/components`, but the app currently has no `src/components` folder.
- `ENGINE.md` says Fossil Valley is the only profile example and does not explain generic progression.

Impact:

- Future prompts may be based on outdated assumptions.
- New design decisions may accidentally reverse useful architecture.

Recommended fix:

- Refresh docs after the Predator stabilization pass.
- Add a short `PROJECT_MEMORY.md` or `DESIGN_PRINCIPLES.md` for persistent design philosophy.

Fix risk: low.

### 11. Browser validation is blocked in the current environment

Evidence:

- Browser automation rejected use of `http://127.0.0.1:5173/` due to local browser policy.

Impact:

- Automated browser playthrough validation cannot currently be trusted as part of the workflow.

Recommended fix:

- Either unblock the local in-app browser policy or add a non-browser smoke test path for state-machine flows.

Fix risk: low.

## Recommended next improvement pass

Do one stabilization/refactor pass before UX/audio/publishing work.

Priorities:

1. Establish a clean baseline.
2. Generalize the progression and feature-profile architecture.
3. Extract a presentation sequence runner from `App.tsx`.
4. Split UI metadata/components enough to make future UX work fast.
5. Restore validation confidence.

Do not do a broad visual redesign in the same pass.
Do not add audio in the same pass.
Do not add Nesting Grounds in the same pass.

## Recommended prompt

```text
V0.57 – Technical Stabilization and Iteration-Speed Pass

This is a technical health pass, not a gameplay expansion.

Do NOT add new mechanics.
Do NOT add Nesting Grounds.
Do NOT redesign the UI.
Do NOT add audio yet.
Do NOT tune RTP except to fix obvious accidental drift from the current intended 94–97% target.

Goals:

1. Establish a clean baseline.
- Run git status.
- Preserve all intentional Predator Valley source/assets.
- Remove generated build artifacts from the working tree.
- Run TypeScript, tests, and production build.
- If tests fail due stale deterministic baselines, update only after verifying the new two-valley math is intentional.

2. Generalize feature progression terminology.
- Rename generic engine concepts currently called Assembly to Progression.
- Fossil Valley should still present as Fossil Assembly.
- Predator Valley should present as Tracking Confidence.
- The engine should not contain fossil-specific or predator-specific names.
- Keep profile-driven behavior.

3. Make multi-feature config authoritative.
- Make `featureProfiles` the source of truth.
- Keep legacy `featureProfile` only as import/backward-compatibility if needed.
- Add helpers for resolving feature profiles and trigger symbols.
- Update simulation, tuning, and UI to use the same profile-resolution path.

4. Add per-feature diagnostics.
- Report trigger frequency, average win, RTP contribution, and percentiles separately for Fossil Valley and Predator Valley.
- Keep combined feature RTP and total RTP.
- Add Predator Track count distribution alongside Footprint distribution.

5. Extract presentation sequencing.
- Move base spin and feature timing out of `App.tsx` into a small typed sequence runner or hook.
- Represent beats as data: phase, duration, payload, and completion action.
- Preserve current timing as closely as possible.
- Preserve Skip Anim and reduced-motion behavior.
- Add tests for sequence order, input locking, and feature transition profile selection.

6. Split high-churn UI code.
- Move symbol/discovery metadata and asset maps out of `App.tsx`.
- Extract BaseGame, FeatureBoard, FieldNotesPanel, CreditPanel, SimulationPanel, and Diagnostics into separate files.
- Avoid changing visuals beyond what the extraction requires.

7. Validation.
- Run TypeScript.
- Run all tests.
- Run production build.
- Run a deterministic 1M simulation with seed 424242 and report:
  - Base RTP
  - Evidence RTP
  - Fossil Valley RTP / trigger rate / avg win
  - Predator Valley RTP / trigger rate / avg win
  - Combined Feature RTP
  - Total RTP
- If browser automation is available, smoke-test:
  - base spin
  - two Footprint anticipation
  - two Predator Track anticipation
  - Fossil Valley entry/exit
  - Predator Valley entry/exit
  - Skip Anim

Deliverables:

- Source changes only; no generated dist/cache files.
- Updated tests.
- Updated ENGINE.md and ARCHITECTURE.txt to reflect two valleys and generic progression.
- A concise report explaining what changed, what was intentionally not changed, validation results, and remaining risks.
```
*** End Patch
 
