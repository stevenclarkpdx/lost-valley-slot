import fs from 'node:fs'
import path from 'node:path'
import { ART_BIBLE_CANDIDATES, MANIFEST_CANDIDATES, fromRoot } from './paths.js'

const REQUIRED_ASSET_FIELDS = ['family', 'subject', 'composition', 'background', 'palette_notes']

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function findExistingFile(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

export function loadArtBible(manifest, manifestPath) {
  const warnings = []
  const declared = manifest.art_bible
  const declaredPath = declared
    ? path.resolve(path.dirname(manifestPath), declared)
    : null
  let biblePath = declaredPath && fs.existsSync(declaredPath) ? declaredPath : null

  if (!biblePath) {
    if (declaredPath) {
      warnings.push(
        `Manifest declares missing art bible ${declared}; using available Lost Valley art bible fallback.`,
      )
    }
    biblePath = findExistingFile(ART_BIBLE_CANDIDATES)
  }

  if (!biblePath) {
    throw new Error('No art bible found. Expected ART_BIBLE.md or LOST_VALLEY_ART_BIBLE.md.')
  }

  return {
    path: biblePath,
    text: fs.readFileSync(biblePath, 'utf8'),
    warnings,
  }
}

export function loadManifest(manifestPath = findExistingFile(MANIFEST_CANDIDATES)) {
  if (!manifestPath) {
    throw new Error('ASSET_MANIFEST.json was not found at project root or art/.')
  }

  const manifest = readJson(manifestPath)
  const validation = validateManifest(manifest)
  const artBible = loadArtBible(manifest, manifestPath)
  return {
    manifest,
    manifestPath,
    artBible,
    warnings: [...validation.warnings, ...artBible.warnings],
  }
}

export function validateManifest(manifest) {
  const errors = []
  const warnings = []

  if (!manifest.project) errors.push('manifest.project is required')
  if (!manifest.version) errors.push('manifest.version is required')
  if (!manifest.global_defaults) errors.push('manifest.global_defaults is required')
  if (!manifest.families) errors.push('manifest.families is required')
  if (!Array.isArray(manifest.batches)) errors.push('manifest.batches must be an array')
  if (!manifest.assets || typeof manifest.assets !== 'object') errors.push('manifest.assets is required')

  for (const [assetId, asset] of Object.entries(manifest.assets ?? {})) {
    for (const field of REQUIRED_ASSET_FIELDS) {
      if (!asset[field] && field !== 'background') {
        errors.push(`${assetId}.${field} is required`)
      }
    }
    if (!asset.family) continue
    const family = manifest.families?.[asset.family]
    if (!family) errors.push(`${assetId}.family references unknown family ${asset.family}`)
    if (!asset.asset_class && !family?.asset_class) {
      errors.push(`${assetId} has no asset_class and family ${asset.family} has no default`)
    }
  }

  for (const batch of manifest.batches ?? []) {
    if (!batch.id) errors.push('batch.id is required')
    for (const assetId of batch.assets ?? []) {
      if (!manifest.assets?.[assetId]) errors.push(`batch ${batch.id} references missing asset ${assetId}`)
    }
  }

  if (errors.length > 0) throw new Error(`Manifest validation failed:\n- ${errors.join('\n- ')}`)
  return { warnings }
}

export function getFamily(manifest, asset) {
  const family = manifest.families[asset.family]
  if (!family) throw new Error(`Unknown family ${asset.family}`)
  return family
}

export function getAssetClass(manifest, asset) {
  return asset.asset_class ?? getFamily(manifest, asset).asset_class
}

export function dimensionsForAsset(manifest, asset) {
  if (asset.dimensions_px) return asset.dimensions_px
  const assetClass = getAssetClass(manifest, asset)
  if (assetClass === 'reel_symbol' || assetClass === 'feature_symbol') {
    return manifest.global_defaults.master_symbol_size_px
  }
  throw new Error(`Asset ${asset.subject} must declare dimensions_px for class ${assetClass}`)
}

export function assetsForSelection(manifest, { batch, assets = [] } = {}) {
  const selected = new Set()
  if (batch) {
    const batchConfig = manifest.batches.find((candidate) => candidate.id === batch)
    if (!batchConfig) throw new Error(`Unknown batch ${batch}`)
    if (assets.length > 0) {
      for (const assetId of assets) {
        if (!batchConfig.assets.includes(assetId)) {
          throw new Error(`Asset ${assetId} is not in batch ${batch}`)
        }
        selected.add(assetId)
      }
    } else {
      for (const assetId of batchConfig.assets) selected.add(assetId)
    }
  } else {
    for (const assetId of assets) selected.add(assetId)
  }
  if (selected.size === 0) throw new Error('Select at least one --batch or --asset.')
  return [...selected].map((assetId) => {
    const asset = manifest.assets[assetId]
    if (!asset) throw new Error(`Unknown asset ${assetId}`)
    return { assetId, asset }
  })
}

export function ensureArtDirectories() {
  for (const dir of [
    'art/references/approved',
    'art/prompts/compiled',
    'art/generated',
    'art/review/contact_sheets',
    'art/approved/symbols',
    'art/approved/ui',
    'art/runtime/symbols',
    'art/runtime/ui',
    'art/prototype/symbols',
    'art/prototype/ui',
  ]) {
    fs.mkdirSync(fromRoot(dir), { recursive: true })
  }
}
