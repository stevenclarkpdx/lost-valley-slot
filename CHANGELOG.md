# Lost Valley Changelog

Brief summaries of significant project changes. Version numbers are prototype milestones, not release tags unless later matched to commits.

## Unreleased

- Added The Lost Valley as a rare mega feature profile triggered by completing all five Field Notes Evidence entries on one spin.
- Reframed Field Notes so 3 and 4 unique Evidence pay instant Discovery Bonuses, while 5 unique Evidence opens the Lost Valley instead of paying an ordinary notebook bonus.
- Added Lost Valley simulation reporting for trigger frequency, expected triggers per 100K spins, average payout, percentiles, and RTP contribution.
- Added Lost Valley transition, Field Notes mystery/completion presentation, and a distinct sanctuary feature treatment.
- Integrated the Nesting Grounds art sheet into the Nesting feature background, intro treatment, survey button, panel framing, trigger symbol, and discovery tiles.
- Added Nesting Grounds as the third major valley profile, triggered by Nesting Eggs.
- Added generic profile-driven tile evolution so revealed Eggs can hatch into Hatchlings without valley-name branching in the feature engine.
- Tuned Nesting Grounds toward high hit frequency, higher reveal counts, lower tile values, and hatch-chain momentum while keeping total RTP in the current 94-97% target band.
- Added Nesting-specific simulation diagnostics for eggs created, eggs hatched, hatch value, hatch chains, reveal count, and per-feature RTP/percentiles.
- Updated the base destination-cue panel, reel anticipation, feature screen language, and discovery presentation to support Fossil Valley, Predator Valley, and Nesting Grounds.
- Added tests for Nesting trigger routing, Nesting Eggs exclusion from cluster/evidence/wild behavior, generic tile evolution, and the new three-valley deterministic simulation baseline.
- Tightened main and feature screen presentation so symbols, feature grid rows, sidebar stats, and field logs fit more cleanly before alpha publishing.
- Replaced the muddy Fossil Footprint crop with a clearer blue fossil-track symbol for better scatter readability.
- Integrated the latest main-screen art sheet across reel symbols and side panels while preserving the existing cabinet layout.
- Replaced Satellite Map with Compass and Mining Pick as active cluster symbols.
- Converted cluster payouts to a color-tier hierarchy: gray, brown, green, blue, and Golden Amber.
- Retuned color-tier cluster paytables to keep the combined two-valley build inside the current 94-97% RTP target.
- Reworked the left Trail Markers panel into a stable Destination Cues tracker that shows Fossil Footprints and Predator Tracks at the same time.
- Updated reel anticipation timing so later reels linger after either valley cue family appears, with stronger suspense when a matching cue count reaches two.
- Added a lightweight procedural Web Audio layer for jungle ambience, reel motion, result hits, valley triggers, and feature survey/reveal feedback.
- Strengthened destination-cue reel slowdown so one cue is noticeable, two cues create a heavier final-reel sweat moment, and feature-trigger spins hold longest.
- Locked feature screens to the cabinet viewport by compacting the feature board/sidebar/footer layout and making the Field Log the primary scrollable region.
- Retuned valley trigger symbol weights upward and scaled feature tile values down so valley discovery lands closer to a 50-75 spin cadence while preserving the 94-97% RTP target.
- Expanded the metrics report script to include per-valley feature breakdowns and Predator two-track anticipation frequency.
- Minimized base-game resolution flow by removing separate Field Notes, trail-marker, and credit presentation beats; clusters now animate once and resolved panel states hold quietly.
- Disabled Field Notes, Destination Cues, and secondary feature survey idle animations to create a simpler foundation for future intentional animation rebuilds.

## v0.56 - Fossil Assembly Progression

- Added configurable Fossil Assembly support to the generic feature engine without hard-coding Fossil Valley-specific logic.
- Converted Fossil Valley discoveries into archaeological evidence that can fill Skull, Spine, Limbs, and Tail specimen sections.
- Added section-completion bonuses, final specimen classification, notable discoveries, and expedition-summary state.
- Updated the Fossil Valley sidebar to show live specimen assembly progress, classification, section status, and assembly breakthroughs.
- Added tests for assembly progress, section rewards, classification rewards, and updated deterministic simulation baselines.

## v0.55 - Fossil Valley Excavation Site Presentation

- Reframed Fossil Valley as a grounded archaeological dig site with expedition props, ropes, lanterns, survey grid signage, and stone excavation squares.
- Restyled feature reveal tiles so the existing 5x5 board reads as embedded excavation ground rather than a floating reward grid.
- Redesigned the feature sidebar as an expedition dossier with field instruments and a dormant specimen assembly placeholder for future Fossil Assembly work.
- Added atmospheric state feedback for survey, reveal, miss, ready, and complete moments while preserving current feature mechanics.

## v0.53 - Commercial Presentation Flow

- Reordered the base-game presentation flow so Footprint anticipation resolves before cluster wins, Evidence resolves before total spin win, and feature transitions wait until all base rewards are clear.
- Added a dedicated credit presentation beat so total spin wins no longer reuse cluster animation state.
- Strengthened Evidence discovery presentation with board-level artifact focus and milestone escalation for four and five discoveries.
- Added Fossil Valley survey column anticipation, ready-state button feedback, and clearer feature-complete summary emphasis.

## v0.52 - Presentation State Machine

- Replaced loose presentation flags with a typed player-facing presentation phase flow.
- Sequenced base spins through reel motion, result evaluation, cluster, credit, Evidence, Trail Marker, and feature-transition beats before unlocking input.
- Limited two-Footprint anticipation to the final reel decision point.
- Added explicit Fossil Valley survey and reveal phases so the player sees immediate survey feedback before the next input window.

## v0.54 - Evidence System Progression

- Redesigned Field Notes around explicit 3/4/5 Evidence milestones with scaling rewards.
- Increased natural Evidence frequency so the notebook produces more regular progression and rarer major discoveries.
- Added per-milestone Evidence RTP and frequency diagnostics for simulation validation.
- Updated the notebook panel to show current discoveries, next milestone, remaining discoveries, and next reward.
- Updated config import/export validation for tunable Field Notes payout values.

## v0.51 - Session Pacing Rebalance

- Retuned default symbol weights to make Fossil Valley, Field Notes, Golden Amber, and Wild-assisted clusters appear more regularly in typical sessions.
- Redistributed value from ordinary cluster wins into higher-attention discovery moments while preserving roughly 91-92% total RTP.
- Added simulation diagnostics for exact two-Footprint events and base wins over 10x.
- Updated deterministic math tests to lock the new pacing profile.

## v0.5 - Juice Pass and Presentation Improvements

- Added presentation-only outcome tiers for dead, tiny, small, medium, and large base-game results.
- Made dead spins quieter while giving medium/large wins stronger cabinet emphasis and credit count-up pacing.
- Strengthened two-Footprint anticipation, Field Notes journal reactions, Expedition Camp Wild assistance, and Golden Amber pay emphasis.
- Added restrained ambient cabinet life and rarity-sensitive Fossil Valley discovery reveal timing.

## v0.411 - Atomic Fossil Valley Reveal Rendering

- Fixed Fossil Valley reveal animation so fog clears from an overlay instead of clipping the discovery card itself.
- Replaced reveal-order-only presentation state with atomic reveal events containing discovery payload, payout, rarity, respin, and feature value context.
- Added tests protecting reveal payload synchronization between feature step events and board tile state.

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
