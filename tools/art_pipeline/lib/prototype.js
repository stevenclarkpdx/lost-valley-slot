import fs from 'node:fs'
import path from 'node:path'
import { createCanonicalCandidate } from './imageProcessing.js'
import {
  assetsForSelection,
  dimensionsForAsset,
  ensureArtDirectories,
  getAssetClass,
  loadManifest,
} from './manifest.js'
import { candidateDirectory, candidateFilename, nextVersion, rawDirectory } from './naming.js'
import { fromRoot } from './paths.js'
import { compilePrompt, saveCompiledPrompt } from './prompts.js'
import { createProvider } from './provider.js'
import { providerRequestSizeForAsset, resizePlan } from './providerSizing.js'
import { selectReferences } from './references.js'
import { validateCandidate, readPngInfo } from './validation.js'

const SYMBOL_CLASSES = new Set(['reel_symbol', 'feature_symbol'])
const UI_CLASSES = new Set(['ui_panel_background', 'ui_art'])

export function prototypeStableNames(assetId, asset) {
  return [...new Set([assetId, ...(asset.runtime_aliases ?? [])])].map((name) => `${name}.png`)
}

export function prototypeOutputDirectory(assetClass) {
  return SYMBOL_CLASSES.has(assetClass) ? fromRoot('art', 'prototype', 'symbols') : fromRoot('art', 'prototype', 'ui')
}

export function prototypeGameDirectory() {
  return fromRoot('src', 'assets', 'concept')
}

export function prototypeOutputPaths(assetId, asset, assetClass) {
  const outDir = prototypeOutputDirectory(assetClass)
  return prototypeStableNames(assetId, asset).map((name) => path.join(outDir, name))
}

export function hasValidPrototype({ manifest, assetId, asset }) {
  const assetClass = getAssetClass(manifest, asset)
  const canonicalSize = SYMBOL_CLASSES.has(assetClass)
    ? manifest.runtime_export.symbols.resize_to_px
    : dimensionsForAsset(manifest, asset)
  const paths = prototypeOutputPaths(assetId, asset, assetClass)
  return paths.length > 0 && paths.every((filePath) => {
    if (!fs.existsSync(filePath)) return false
    try {
      const info = readPngInfo(filePath)
      return info.width === canonicalSize[0] && info.height === canonicalSize[1]
    } catch {
      return false
    }
  })
}

export function auditGameAssetReferences({ manifest } = loadManifest()) {
  const files = [fromRoot('src', 'App.tsx'), fromRoot('src', 'styles.css')]
  const referencedFiles = new Set()
  const referenceRegex = /\.\/assets\/concept\/([^'")]+\.png)/g
  const artUrlRegex = /artUrl\(['"]([^'"]+\.png)['"]\)/g
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue
    const text = fs.readFileSync(filePath, 'utf8')
    for (const match of text.matchAll(referenceRegex)) {
      if (match[1] !== '*.png') referencedFiles.add(match[1])
    }
    for (const match of text.matchAll(artUrlRegex)) referencedFiles.add(match[1])
  }

  const manifestRuntimeNames = new Map()
  for (const [assetId, asset] of Object.entries(manifest.assets)) {
    for (const name of prototypeStableNames(assetId, asset)) {
      manifestRuntimeNames.set(name, assetId)
    }
  }

  const referenced = [...referencedFiles].sort()
  const manifestFiles = [...manifestRuntimeNames.keys()].sort()
  return {
    referencedFiles: referenced,
    placeholdersToReplace: referenced.map((file) => `src/assets/concept/${file}`),
    gameReferencedAssetsMissingFromManifest: referenced
      .filter((file) => !manifestRuntimeNames.has(file))
      .map((file) => `src/assets/concept/${file}`),
    manifestAssetsNotUsedByCurrentGame: [...Object.entries(manifest.assets)]
      .filter(([assetId, asset]) => !prototypeStableNames(assetId, asset).some((name) => referencedFiles.has(name)))
      .map(([assetId]) => assetId)
      .sort(),
    manifestRuntimeFiles: manifestFiles,
  }
}

export function planPrototype({
  batch = null,
  assets = [],
  all = false,
  dryRun = true,
  force = false,
  providerName = undefined,
} = {}) {
  ensureArtDirectories()
  const context = loadManifest()
  const selected = all
    ? Object.entries(context.manifest.assets).map(([assetId, asset]) => ({ assetId, asset }))
    : assetsForSelection(context.manifest, { batch, assets })
  const resolvedProviderName = providerName ?? process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai'
  const items = selected.map(({ assetId, asset }) => {
    const assetClass = getAssetClass(context.manifest, asset)
    const canonicalSize = dimensionsForAsset(context.manifest, asset)
    const providerRequestSize = providerRequestSizeForAsset({
      providerName: resolvedProviderName,
      canonicalSize,
    })
    const familyBatch = batch ?? context.manifest.families[asset.family].batch_id ?? 'manual'
    const version = nextVersion(familyBatch, assetId, asset)
    const references = selectReferences(context.manifest, assetId, asset)
    const compiled = compilePrompt({
      manifest: context.manifest,
      artBibleText: context.artBible.text,
      assetId,
      asset,
      references,
    })
    const prototypePaths = prototypeOutputPaths(assetId, asset, assetClass)
    const skipped = !force && hasValidPrototype({ manifest: context.manifest, assetId, asset })
    return {
      assetId,
      family: asset.family,
      assetClass,
      dimensions: canonicalSize,
      canonicalOutputSize: canonicalSize,
      providerRequestSize,
      resizePlan: resizePlan({ providerSize: providerRequestSize, canonicalSize }),
      version,
      candidates: [candidateFilename(assetId, asset, version, 1)],
      references,
      prompt: compiled.prompt,
      candidateDir: candidateDirectory(familyBatch, assetId),
      rawDir: rawDirectory(familyBatch, assetId),
      prototypePaths,
      runtimeNames: prototypeStableNames(assetId, asset),
      skipped,
      skipReason: skipped ? 'valid prototype already exists; use --force to overwrite' : null,
    }
  })
  const requests = items.filter((item) => !item.skipped).length
  return {
    mode: 'prototype',
    dryRun,
    force,
    manifestVersion: context.manifest.version,
    warnings: context.warnings,
    missingAssetAudit: auditGameAssetReferences({ manifest: context.manifest }),
    requestCount: requests,
    skippedCount: items.length - requests,
    items,
  }
}

export async function generatePrototype({
  batch = null,
  assets = [],
  all = false,
  dryRun = true,
  force = false,
  providerName = undefined,
  integrateGame = false,
} = {}) {
  const plan = planPrototype({ batch, assets, all, dryRun, force, providerName })
  for (const item of plan.items) {
    fs.mkdirSync(item.candidateDir, { recursive: true })
    fs.mkdirSync(item.rawDir, { recursive: true })
    item.compiledPromptPaths = []
    const filename = item.candidates[0]
    const promptPath = saveCompiledPrompt({
      batchId: batch ?? 'prototype',
      assetId: item.assetId,
      filename,
      prompt: item.prompt,
    })
    item.compiledPromptPaths.push(promptPath)
    if (item.skipped || dryRun) continue

    const provider = createProvider(providerName ?? process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai')
    const outputPath = path.join(item.candidateDir, filename)
    const rawPath = path.join(item.rawDir, filename.replace(/\.png$/, '_raw.png'))
    await provider.generateImage({
      prompt: item.prompt,
      width: item.providerRequestSize[0],
      height: item.providerRequestSize[1],
      referenceImages: item.references,
      outputPath: rawPath,
    })
    const canonical = await createCanonicalCandidate({
      rawPath,
      outputPath,
      canonicalSize: item.canonicalOutputSize,
      providerSize: item.providerRequestSize,
    })
    const validation = validateCandidate({
      filePath: outputPath,
      expectedDimensions: item.canonicalOutputSize,
      expectedDirectory: item.candidateDir,
      expectedAssetId: item.assetId,
      expectedCandidateCount: 1,
    })
    if (!validation.ok) {
      throw new Error(`Prototype candidate validation failed for ${item.assetId}: ${validation.errors.join('; ')}`)
    }
    await exportPrototypeCandidate({
      manifest: loadManifest().manifest,
      item,
      candidatePath: outputPath,
      integrateGame,
    })
    fs.writeFileSync(
      `${outputPath}.json`,
      JSON.stringify(
        {
          asset_id: item.assetId,
          status: 'prototype',
          approved: false,
          production_reference_eligible: false,
          manifest_version: plan.manifestVersion,
          asset_family: item.family,
          candidate_number: '01',
          provider_request_size: item.providerRequestSize,
          canonical_output_size: item.canonicalOutputSize,
          raw_provider_output_path: rawPath,
          canonicalization: canonical,
          compiled_prompt_path: promptPath,
          reference_files_used: item.references,
          provider: providerName ?? process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai',
          generation_timestamp: new Date().toISOString(),
          output_filename: filename,
          prototype_paths: item.prototypePaths,
          runtime_names: item.runtimeNames,
          validation,
        },
        null,
        2,
      ),
    )
  }
  return plan
}

export async function exportPrototypeCandidate({ manifest, item, candidatePath, integrateGame = false }) {
  const asset = manifest.assets[item.assetId]
  const assetClass = getAssetClass(manifest, asset)
  const outputDir = prototypeOutputDirectory(assetClass)
  const gameDir = prototypeGameDirectory()
  fs.mkdirSync(outputDir, { recursive: true })
  if (integrateGame) fs.mkdirSync(gameDir, { recursive: true })
  const targets = [...item.prototypePaths]
  if (integrateGame) {
    targets.push(...item.runtimeNames.map((name) => path.join(gameDir, name)))
  }
  for (const outputPath of targets) {
    if (SYMBOL_CLASSES.has(assetClass)) {
      const [width, height] = manifest.runtime_export.symbols.resize_to_px
      await resizeWithSharp(candidatePath, outputPath, width, height)
    } else {
      fs.copyFileSync(candidatePath, outputPath)
    }
    if (integrateGame && path.resolve(path.dirname(outputPath)) === path.resolve(gameDir)) continue
    fs.writeFileSync(
      `${outputPath}.json`,
      JSON.stringify(
        {
          status: 'prototype',
          approved: false,
          production_reference_eligible: false,
          asset_id: item.assetId,
          source_candidate: candidatePath,
          output_path: outputPath,
          generated_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  }
}

async function resizeWithSharp(inputPath, outputPath, width, height) {
  const sharp = (await import('sharp')).default
  await sharp(inputPath).resize(width, height, { fit: 'contain', withoutEnlargement: true }).png().toFile(outputPath)
}
