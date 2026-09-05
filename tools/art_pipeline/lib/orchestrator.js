import fs from 'node:fs'
import path from 'node:path'
import { approveCandidate, rejectCandidate } from './approval.js'
import { createContactSheet } from './contactSheet.js'
import { exportRuntime } from './exportRuntime.js'
import { createCanonicalCandidate } from './imageProcessing.js'
import { loadManifest, assetsForSelection, dimensionsForAsset, getAssetClass, ensureArtDirectories } from './manifest.js'
import { candidateDirectory, candidateFilename, nextVersion, rawDirectory } from './naming.js'
import { compilePrompt, saveCompiledPrompt } from './prompts.js'
import { createProvider } from './provider.js'
import { providerRequestSizeForAsset, resizePlan } from './providerSizing.js'
import { selectReferences } from './references.js'
import { validateCandidate } from './validation.js'

export function planGeneration({ batch, assets = [], candidates, dryRun = true, providerName = undefined }) {
  ensureArtDirectories()
  const context = loadManifest()
  const selected = assetsForSelection(context.manifest, { batch, assets })
  const items = []
  const resolvedProviderName = providerName ?? process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai'
  for (const { assetId, asset } of selected) {
    const familyBatch = batch ?? context.manifest.families[asset.family].batch_id ?? 'manual'
    const count = candidates ?? context.manifest.global_defaults.generation_count_default
    const version = nextVersion(familyBatch, assetId, asset)
    const references = selectReferences(context.manifest, assetId, asset)
    const canonicalSize = dimensionsForAsset(context.manifest, asset)
    const providerRequestSize = providerRequestSizeForAsset({
      providerName: resolvedProviderName,
      canonicalSize,
    })
    const compiled = compilePrompt({
      manifest: context.manifest,
      artBibleText: context.artBible.text,
      assetId,
      asset,
      references,
    })
    const filenames = Array.from({ length: count }, (_, index) =>
      candidateFilename(assetId, asset, version, index + 1),
    )
    items.push({
      assetId,
      family: asset.family,
      assetClass: getAssetClass(context.manifest, asset),
      dimensions: canonicalSize,
      canonicalOutputSize: canonicalSize,
      providerRequestSize,
      resizePlan: resizePlan({ providerSize: providerRequestSize, canonicalSize }),
      version,
      candidates: filenames,
      references,
      prompt: compiled.prompt,
      candidateDir: candidateDirectory(familyBatch, assetId),
      rawDir: rawDirectory(familyBatch, assetId),
    })
  }
  return {
    dryRun,
    manifestVersion: context.manifest.version,
    warnings: context.warnings,
    requestCount: items.reduce((sum, item) => sum + item.candidates.length, 0),
    items,
  }
}

export async function generate({ batch, assets = [], candidates, dryRun = true, providerName = undefined }) {
  const plan = planGeneration({ batch, assets, candidates, dryRun, providerName })
  for (const item of plan.items) {
    fs.mkdirSync(item.candidateDir, { recursive: true })
    fs.mkdirSync(item.rawDir, { recursive: true })
    item.compiledPromptPaths = []
    for (const filename of item.candidates) {
      const promptPath = saveCompiledPrompt({
        batchId: batch ?? 'manual',
        assetId: item.assetId,
        filename,
        prompt: item.prompt,
      })
      item.compiledPromptPaths.push(promptPath)
      if (dryRun) continue
      const provider = createProvider(providerName)
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
        expectedCandidateCount: item.candidates.length,
      })
      fs.writeFileSync(
        `${outputPath}.json`,
        JSON.stringify(
          {
            asset_id: item.assetId,
            manifest_version: plan.manifestVersion,
            asset_family: item.family,
            candidate_number: filename.match(/_c(\d{2})\.png$/)?.[1],
            requested_dimensions: item.dimensions,
            provider_request_size: item.providerRequestSize,
            canonical_output_size: item.canonicalOutputSize,
            raw_provider_output_path: rawPath,
            canonicalization: canonical,
            compiled_prompt: item.prompt,
            compiled_prompt_path: promptPath,
            reference_files_used: item.references,
            provider: providerName ?? process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai',
            generation_timestamp: new Date().toISOString(),
            output_filename: filename,
            validation,
          },
          null,
          2,
        ),
      )
    }
  }
  return plan
}

export function review({ batch }) {
  const { manifest } = loadManifest()
  return createContactSheet({ manifest, batchId: batch })
}

export function approve({ assetId, candidatePath, notes = '' }) {
  const { manifest } = loadManifest()
  return approveCandidate({ manifest, assetId, candidatePath, notes })
}

export function reject({ candidatePath, reason = '' }) {
  return rejectCandidate({ candidatePath, reason })
}

export async function exportApproved({ batch = null } = {}) {
  const { manifest } = loadManifest()
  return exportRuntime({ manifest, batchId: batch })
}
