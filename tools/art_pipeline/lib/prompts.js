import fs from 'node:fs'
import path from 'node:path'
import { dimensionsForAsset, getAssetClass, getFamily } from './manifest.js'
import { fromRoot } from './paths.js'

const STYLE_MARKERS = [
  'premium 1990s American animated action-cartoon paleontology adventure',
  'drawn like a serious animation-cel prop rather than realistic concept art',
  'heavy expressive dark exterior ink contours',
  'bold simplified interior construction lines',
  'strong readable silhouette with slight purposeful exaggeration',
  'moderately saturated flat color masses',
  'clear separation between major color regions',
  'hard-edged graphic cel-shadow shapes',
  'selective bold graphic highlight shapes',
  'warm/cool color contrast',
  'high visual punch at small slot-symbol size',
  'adult pulp expedition tone',
]

const NEGATIVE_MARKERS = [
  'no photorealism',
  'no 3D render appearance',
  'no painterly concept-art treatment',
  'no realistic material rendering',
  'no product-rendering realism',
  'no glossy mobile-game rendering',
  'no chibi or cute styling',
  'no pixel art',
  'no airbrushed or smoothly modeled volume',
  'no subtle tonal transitions as the main shading method',
  'no dozens of intermediate shades',
  'no realistic reflections or physically accurate metallic shading',
  'no muted muddy desaturation',
  'no excessive texture',
  'no bloom',
  'no depth of field',
  'no ornamental AI clutter',
  'no readable text or nonsense lettering',
]

export function globalStyleBlock(manifest) {
  return [
    `Lost Valley visual style: ${manifest.style_profile?.summary ?? STYLE_MARKERS[0]}.`,
    `Required traits: ${STYLE_MARKERS.join('; ')}.`,
    `Negative constraints: ${NEGATIVE_MARKERS.join('; ')}.`,
    'Color construction: prefer a small number of deliberate color masses: dominant local-color region, darker cel-shadow region, brighter highlight/accent region, and very dark ink outlines. Avoid realistic gradients and tiny representational detail.',
    'Style test: the asset should look like a prop painted onto an animation cel in a serious 1990s dinosaur adventure cartoon. If it looks like a realistic object illustration with outlines applied afterward, push it further toward bold cel animation.',
    'Readability first. Consistency second. Style third. Detail last.',
  ].join('\n')
}

export function assetClassBlock(assetClass, dimensions) {
  const [width, height] = dimensions
  if (assetClass === 'reel_symbol' || assetClass === 'feature_symbol') {
    return [
      `${assetClass} production rules: exact square ${width}x${height}px PNG master.`,
      'One isolated primary subject, centered, fully contained inside safe margins.',
      'Consistent perceived subject scale, roughly 70-80% of usable area.',
      'Simple contained background supporting the symbol category.',
      'No neighboring symbols, no contact-sheet border, no baked gameplay label, no readable text.',
    ].join('\n')
  }
  if (assetClass === 'ui_panel_background') {
    return [
      `UI panel background production rules: exact ${width}x${height}px PNG master.`,
      'Readable quiet zones for runtime text and counters.',
      'World materials may include parchment, jungle, stone, rope, metal, canvas, leather.',
      'No required gameplay text baked into the art.',
      'Decoration must not compete with runtime overlays.',
    ].join('\n')
  }
  return [
    `UI art production rules: exact ${width}x${height}px PNG master.`,
    'Preserve functional hierarchy and avoid baked final gameplay text.',
  ].join('\n')
}

export function assetSpecificBlock(manifest, assetId, asset) {
  const family = getFamily(manifest, asset)
  return [
    `Asset id: ${assetId}.`,
    `Family: ${asset.family}. Tier: ${asset.tier ?? family.tier ?? 'unspecified'}.`,
    `Subject: ${asset.subject}.`,
    `Composition: ${asset.composition}.`,
    `Background: ${asset.background ?? family.default_background_palette?.join(', ') ?? 'simple contained background'}.`,
    `Palette notes: ${asset.palette_notes ?? family.default_background_palette?.join(', ') ?? 'Lost Valley palette'}.`,
    asset.special_constraints?.length
      ? `Special constraints: ${asset.special_constraints.join('; ')}.`
      : 'Special constraints: follow manifest and art bible.',
  ].join('\n')
}

export function compilePrompt({ manifest, artBibleText, assetId, asset, references = [] }) {
  const dimensions = dimensionsForAsset(manifest, asset)
  const assetClass = getAssetClass(manifest, asset)
  const prompt = [
    globalStyleBlock(manifest, artBibleText),
    '',
    assetClassBlock(assetClass, dimensions),
    '',
    assetSpecificBlock(manifest, assetId, asset),
    '',
    references.length > 0
      ? `Approved Lost Valley references to use for style consistency: ${references.map((ref) => path.basename(ref)).join(', ')}.`
      : 'No approved reference images selected for this request.',
    '',
    'Generate only the requested asset. The result must be production-clean and reviewable as a standalone asset.',
  ].join('\n')

  return { prompt, dimensions, assetClass }
}

export function saveCompiledPrompt({ batchId, assetId, filename, prompt }) {
  const promptDir = fromRoot('art', 'prompts', 'compiled', batchId, assetId)
  fs.mkdirSync(promptDir, { recursive: true })
  const promptPath = path.join(promptDir, filename.replace(/\.png$/, '.txt'))
  fs.writeFileSync(promptPath, prompt)
  return promptPath
}
