import fs from 'node:fs'
import path from 'node:path'
import { getAssetClass } from './manifest.js'
import { fromRoot } from './paths.js'

function approvedMetadataFiles() {
  const roots = [fromRoot('art', 'approved', 'symbols'), fromRoot('art', 'approved', 'ui')]
  return roots.flatMap((root) => {
    if (!fs.existsSync(root)) return []
    return fs
      .readdirSync(root)
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.join(root, file))
  })
}

export function approvedAssets() {
  return approvedMetadataFiles()
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
    .filter((meta) => meta.status === 'approved' && meta.masterPath && fs.existsSync(meta.masterPath))
}

export function styleAnchors() {
  const dir = fromRoot('art', 'references', 'approved')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .sort()
    .map((file) => path.join(dir, file))
}

export function selectReferences(manifest, assetId, asset, limit = 3) {
  const assetClass = getAssetClass(manifest, asset)
  const approved = approvedAssets()
  const sameFamily = approved.filter((item) => item.family === asset.family)
  const sameClass = approved.filter((item) => item.assetClass === assetClass && item.family !== asset.family)
  const selected = [...sameFamily, ...sameClass].map((item) => item.masterPath)
  return [...selected, ...styleAnchors()].slice(0, limit)
}

export function assertReferenceIsApproved(referencePath) {
  const normalized = path.resolve(referencePath)
  if (styleAnchors().map(path.resolve).includes(normalized)) return true
  if (approvedAssets().some((asset) => path.resolve(asset.masterPath) === normalized)) return true
  throw new Error(`Reference is not approved and cannot be used: ${referencePath}`)
}

