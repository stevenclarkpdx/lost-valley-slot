import fs from 'node:fs'
import path from 'node:path'
import { approvedFilename, parseCandidateFilename } from './naming.js'
import { fromRoot } from './paths.js'
import { readPngInfo } from './validation.js'

export function approvalDirectory(assetClass) {
  return assetClass === 'ui_panel_background' || assetClass === 'ui_art'
    ? fromRoot('art', 'approved', 'ui')
    : fromRoot('art', 'approved', 'symbols')
}

export function approveCandidate({ manifest, assetId, candidatePath, notes = '' }) {
  const parsed = parseCandidateFilename(candidatePath)
  if (!parsed) throw new Error('Candidate filename does not match pipeline naming.')
  if (!path.basename(candidatePath).includes(`_${assetId}_`)) {
    throw new Error(`Candidate filename does not include expected asset id ${assetId}.`)
  }
  const asset = manifest.assets[assetId]
  if (!asset) throw new Error(`Unknown asset ${assetId}`)
  const assetClass = asset.asset_class ?? manifest.families[asset.family].asset_class
  const outDir = approvalDirectory(assetClass)
  fs.mkdirSync(outDir, { recursive: true })
  const masterName = approvedFilename(assetId, asset, parsed.version, 'default')
  const masterPath = path.join(outDir, masterName)
  if (fs.existsSync(masterPath)) {
    throw new Error(`Approved master already exists and will not be overwritten: ${masterPath}`)
  }
  fs.copyFileSync(candidatePath, masterPath)
  const png = readPngInfo(masterPath)
  const metadata = {
    status: 'approved',
    assetId,
    family: asset.family,
    assetClass,
    version: parsed.version,
    candidate: parsed.candidate,
    sourceCandidate: path.resolve(candidatePath),
    masterPath,
    approvedAt: new Date().toISOString(),
    notes,
    png,
  }
  fs.writeFileSync(`${masterPath}.json`, JSON.stringify(metadata, null, 2))
  return metadata
}

export function rejectCandidate({ candidatePath, reason = '' }) {
  const metadataPath = `${candidatePath}.rejected.json`
  const metadata = {
    status: 'rejected',
    candidatePath: path.resolve(candidatePath),
    rejectedAt: new Date().toISOString(),
    reason,
  }
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  return metadata
}
