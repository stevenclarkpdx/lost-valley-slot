# Lost Valley Changelog

Brief summaries of significant project changes. Version numbers are prototype milestones, not release tags unless later matched to commits.

## v0.41 - Fossil Valley Integrity

- Isolated interactive Fossil Valley sessions behind per-feature RNG seeds while preserving deterministic simulation behavior.
- Fixed feature stepping so reveal animation state is updated from the resolved engine step rather than from inside a React state updater.
- Added development-only feature debug readouts for session ID, feature RNG seed, board generation seed, reveal count, hidden tiles, respins, and state.
- Added test coverage for debug metadata on feature sessions.

## v0.6 - Fossil Valley Polish

- Added stepwise Fossil Valley feature sessions for interactive play while preserving deterministic simulation resolution.
- Reworked feature presentation into discovery cards, reveal log, rarity treatment, and cinematic valley framing.
- Added game-feel improvements for reel motion, sequential result beats, persistent win highlights, and Footprint anticipation holds.
- Fixed visual/state issues where reel layout shifted during spin or old results were exposed before the new result settled.

## v0.5 - Presentation

- Integrated Lost Valley concept-sheet artwork for reel symbols, evidence symbols, discovery tiles, side panels, and feature background.
- Refined visual hierarchy so Evidence, Footprints, Expedition Camp Wild, and Golden Amber read more clearly than common equipment.
- Improved main-game and feature layouts to reduce overlap, clipping, and competing developer panels.
- Added lightweight CSS animation for reel stops, cluster wins, Footprints, Evidence checks, feature reveal, and feature completion.

## v0.4 - Game Feel

- Replaced simple symbol-swap presentation with vertical reel motion, staggered reel stops, motion blur, and restrained settle bounce.
- Added a presentation beat sequence for cluster wins, Wild-assisted wins, Golden Amber, Evidence, Footprints, and feature transition.
- Added reduced-motion and Skip Animation options for development and accessibility.
- Preserved deterministic engine results while keeping presentation timing in the React layer.

## v0.3 - Tuning and Diagnostics

- Added JSON config export/import, simulation seed input, and simulation volume controls.
- Added base-game, evidence, and feature diagnostics including RTP split, trigger rate, symbol distributions, cluster stats, feature percentiles, and reveal distributions.
- Added tuning targets and a tuning sweep workspace for Fossil Valley-only balancing.
- Tuned the default Fossil Valley configuration to the target RTP region.

## v0.2 - Base Game Model

- Replaced placeholder horizontal line payouts with orthogonal cluster pays on the 5x5 board.
- Added BASE_GAME_MODEL implementation, visible base-win output, cluster debug output, and simulation RTP breakdown.
- Added Field Notes Evidence bonuses as an instant base-game payout.
- Added Expedition Camp Wild substitution and Golden Amber as a high-paying premium cluster symbol.

## v0.1 - Vertical Slice

- Created the Vite React TypeScript prototype.
- Separated a deterministic TypeScript engine from React presentation.
- Added seeded RNG, 5x5 base board, Footprint feature trigger, and Fossil Valley-only feature loop.
- Added initial tests for RNG determinism, trigger detection, payout calculation, and feature termination.
