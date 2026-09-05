import fs from 'node:fs'
import path from 'node:path'
import { approvedAssets } from './references.js'
import { fromRoot } from './paths.js'
import { readPngInfo } from './validation.js'

export async function exportRuntime({ manifest, batchId = null } = {}) {
  const allowed = batchId
    ? new Set(manifest.batches.find((batch) => batch.id === batchId)?.assets ?? [])
    : null
  if (batchId && allowed.size === 0) throw new Error(`Unknown or empty batch ${batchId}`)

  const exported = []
  for (const item of approvedAssets()) {
    if (allowed && !allowed.has(item.assetId)) continue
    const asset = manifest.assets[item.assetId]
    const assetClass = item.assetClass
    const runtime =
      assetClass === 'ui_panel_background' || assetClass === 'ui_art'
        ? manifest.runtime_export.ui
        : manifest.runtime_export.symbols
    const outDir = fromRoot(runtime.output_directory)
    fs.mkdirSync(outDir, { recursive: true })
    const outputPath = path.join(outDir, `${item.assetId}.png`)
    const info = readPngInfo(item.masterPath)

    if (assetClass === 'ui_panel_background' || assetClass === 'ui_art') {
      fs.copyFileSync(item.masterPath, outputPath)
      exported.push({ assetId: item.assetId, outputPath, action: 'copied-ui-master' })
      continue
    }

    const [targetWidth, targetHeight] = runtime.resize_to_px
    if (info.width === targetWidth && info.height === targetHeight) {
      fs.copyFileSync(item.masterPath, outputPath)
      exported.push({ assetId: item.assetId, outputPath, action: 'copied-matching-size' })
      continue
    }

    await resizeWithSharpOrFail(item.masterPath, outputPath, targetWidth, targetHeight)
    exported.push({ assetId: item.assetId, outputPath, action: 'resized' })
  }
  return exported
}

async function resizeWithSharpOrFail(inputPath, outputPath, width, height) {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    throw new Error(
      `Runtime export requires resizing ${inputPath} to ${width}x${height}, but optional dependency sharp is not installed. Install project-local sharp or provide approved masters at runtime dimensions.`,
    )
  }
  await sharp(inputPath).resize(width, height, { fit: 'contain', withoutEnlargement: true }).png().toFile(outputPath)
}

