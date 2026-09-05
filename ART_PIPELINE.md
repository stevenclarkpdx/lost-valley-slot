# Lost Valley Art Pipeline

This project now has a reusable AI-assisted art production pipeline for generating, validating, reviewing, approving, and exporting Lost Valley assets.

The pipeline is intentionally conservative: dry-run is the default, generated candidates never overwrite approved masters, and runtime export only uses approved art.

Fast prototype generation is available for coherent playtest visuals, but the game itself now has one active art set: `src/assets/concept/`. Generated art can be promoted into that active set without requiring a separate prototype build.

## Source of truth

- `ART_BIBLE.md` defines the visual language and production rules.
- `ASSET_MANIFEST.json` defines assets, batches, dimensions, families, and export rules.

## Directory layout

```text
art/
  references/approved/       pinned style anchors
  prompts/compiled/          exact prompts produced for each candidate
  generated/<batch>/<asset>/candidates/
  review/contact_sheets/     SVG review sheets
  approved/symbols/          versioned approved symbol masters
  approved/ui/               versioned approved UI masters
  runtime/symbols/           stable runtime copies
  runtime/ui/                stable runtime copies
  prototype/symbols/         stable fast-prototype symbol exports
  prototype/ui/              stable fast-prototype UI exports

src/assets/concept/          active game art used by normal dev/build

tools/art_pipeline/
  art.js                     CLI
  lib/                       small pipeline modules
```

## Commands

Use npm:

```powershell
npm run art -- plan --batch base_utility
npm run art -- generate --batch base_utility --dry-run
npm run art -- generate --batch base_utility --generate
npm run art -- review --batch base_utility
npm run art -- approve compass --candidate art/generated/base_utility/compass/candidates/utility_compass_default_v001_c03.png
npm run art -- reject --candidate art/generated/base_utility/compass/candidates/utility_compass_default_v001_c01.png --reason "wrong silhouette"
npm run art -- regenerate compass --batch base_utility --dry-run
npm run art -- export --batch base_utility
npm run art -- prototype --all --dry-run
npm run art -- prototype --batch base_utility --dry-run
```

Or call the CLI directly:

```powershell
node tools/art_pipeline/art.js generate --batch base_utility --dry-run
```

## Dry-run

Dry-run compiles prompts, resolves dimensions, selects references, calculates filenames, and reports request count. It does not call an image provider.

This is the default behavior for `generate` unless `--generate` is supplied.

Dry-run reports two dimensions:

- `providerRequestSize`: the size requested from the image provider.
- `canonicalOutputSize`: the manifest-approved candidate size that validation/review/approval use.

For OpenAI Images, provider request sizes are mapped to currently supported sizes:

- square assets -> `1024x1024`
- portrait assets -> `1024x1536`
- landscape assets -> `1536x1024`

The manifest remains canonical. For example, reel symbols are still mastered as `512x512`; OpenAI may generate `1024x1024`, and the pipeline then downscales to the canonical `512x512` candidate.

## Provider setup

The provider boundary lives in `tools/art_pipeline/lib/provider.js`.

The initial real provider is OpenAI Images through environment variables:

```text
OPENAI_API_KEY=
LOST_VALLEY_IMAGE_PROVIDER=openai
LOST_VALLEY_IMAGE_MODEL=gpt-image-1
```

Copy `.env.example` into your local environment mechanism or set those variables in your shell. The pipeline never hard-codes API keys.

If credentials are absent, generation fails clearly. Dry-run still works.

## Prompt assembly

Each prompt is assembled from:

1. Global Lost Valley style block from the art bible and manifest style profile.
2. Asset-class block for reel symbols, feature symbols, or UI panel backgrounds.
3. Asset-specific block from `ASSET_MANIFEST.json`.
4. Deterministic approved reference selection.

Every compiled prompt is saved under `art/prompts/compiled/`.

## References

Only approved masters and pinned approved references can be used as future style references.

Prototype assets are intentionally excluded from reference selection. They are useful for playtesting coherence, not for establishing production style truth.

Pinned style anchors belong here:

```text
art/references/approved/style_anchor_01.png
art/references/approved/style_anchor_02.png
```

The reference selector prioritizes:

1. Approved assets from the same family.
2. Approved assets from the same asset class.
3. Pinned style anchors.

## Candidate metadata

For generated candidates, the pipeline saves metadata beside each image:

- asset id
- manifest version
- family
- candidate number
- provider request size
- canonical output size
- raw provider output path
- compiled prompt
- references used
- provider/model
- timestamp
- validation result

## Mechanical validation

Validation checks:

- file exists
- filename follows candidate naming
- output directory is correct
- PNG signature and dimensions are readable
- expected width/height
- square requirement for symbol assets
- candidate count sanity
- alpha/file-size warnings

Validation is always run against the canonical candidate output, not the raw provider image.

This does not judge art quality. Human approval is still required for silhouette, subject recognition, style consistency, and taste.

## Contact sheets

Create a review sheet with:

```powershell
npm run art -- review --batch base_utility
```

The result is an SVG in `art/review/contact_sheets/`. Contact sheets are review artifacts only.

Contact sheets embed canonical candidate PNGs directly as data URIs. This makes sheets self-contained and avoids renderer/path issues with local relative image references.

## Approval and rejection

Approval copies a candidate into `art/approved/symbols/` or `art/approved/ui/` as a versioned master and writes approval metadata.

Approval will not overwrite an existing master.

Rejection writes `.rejected.json` next to the rejected candidate. Rejected candidates are not exported.

## Runtime export

Runtime export only uses approved masters.

UI masters are copied as-is. Symbol masters must match runtime size or be resized. High-quality resizing is supported through optional project-local `sharp`. If `sharp` is not installed and a resize is required, export fails with a useful message rather than faking compliance.

Real provider generation also uses `sharp` to turn raw provider images into canonical manifest-sized candidates. This preserves aspect ratio and uses center cropping only when provider and manifest aspect ratios differ.

## Prototype art workflow

Prototype mode generates a complete playable art pass quickly while preserving the stricter approval workflow for later production review.

Use it when the goal is playtest cohesion rather than rigorous final asset approval.

```powershell
npm run art -- prototype --all --dry-run
npm run art -- prototype --batch base_utility --dry-run
npm run art -- prototype --all --provider openai --generate --integrate-game
```

Prototype behavior:

- Generates one candidate per asset by default.
- Uses `ART_BIBLE.md` and `ASSET_MANIFEST.json`.
- Uses approved style anchors if available.
- Mechanically validates canonical candidates.
- Exports stable runtime-style files into `art/prototype/symbols/` and `art/prototype/ui/`.
- With `--integrate-game`, also exports playable PNG copies into `src/assets/concept/`, the normal active game art folder.
- Skips assets that already have valid prototype exports unless `--force` is supplied.
- Supports `--dry-run`; dry-run compiles prompts and reports the request count without calling a provider.
- Never marks prototype assets as approved.
- Never writes into `art/approved/`.
- Never makes prototype assets eligible as production references.
- Never overwrites approved production masters.

Generated/versioned candidates remain preserved under `art/generated/<batch>/<asset>/candidates/`. The stable prototype files are convenience exports for playtesting and batch replacement.

### Prototype versus approved art

Approved production flow:

```text
candidate -> review sheet -> human approval -> art/approved -> art/runtime
```

Fast prototype flow:

```text
candidate -> mechanical validation -> art/prototype -> optional src/assets/concept
```

Prototype assets can later inspire a proper production generation pass, but approval metadata is still separate. If a prototype image is strong enough for production, it can be reviewed and approved through the normal candidate workflow.

### Active game art

The game uses one active art folder:

```text
src/assets/concept/
```

To replace the active art set from the fast-generation lane, run:

```powershell
npm run art -- prototype --all --provider openai --generate --integrate-game
```

There is no separate prototype server or prototype build mode. After integration, the normal dev server and production build use the new active art.

## Adding a new asset

1. Add the asset to `ASSET_MANIFEST.json`.
2. Assign it to a family and batch.
3. Provide subject, composition, background, palette notes, special constraints, and dimensions if not using defaults.
4. Run a dry-run for the asset or batch.
5. Generate candidates.
6. Review, approve, then export.

## First production test

Dry-run the first batch:

```powershell
npm run art -- generate --batch base_utility --asset mining_pick --asset canteen --asset compass --asset excavation_brush --dry-run
```

If `OPENAI_API_KEY` is configured and you are ready to spend generation requests:

```powershell
npm run art -- generate --batch base_utility --asset mining_pick --asset canteen --asset compass --asset excavation_brush --generate
npm run art -- review --batch base_utility
```

Do not approve anything automatically.

## Troubleshooting

- Missing `OPENAI_API_KEY`: dry-run works; real generation will stop before spending requests.
- Missing `ART_BIBLE.md`: currently expected; the pipeline warns and uses `LOST_VALLEY_ART_BIBLE.md`.
- Export resize failure: install project-local `sharp` or provide approved masters at runtime dimensions.
- Bad dimensions: reject candidate or regenerate; do not manually stretch assets.
- Style drift: pin strong approved style anchors and regenerate only selected assets.
