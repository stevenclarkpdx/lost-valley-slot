import fs from 'node:fs'
import path from 'node:path'
import { fromRoot } from './paths.js'

export function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

export function familySubjectPrefix(assetId, asset, variant = 'default') {
  return `${slug(asset.family)}_${slug(assetId)}_${slug(variant)}`
}

export function versionLabel(version) {
  return `v${String(version).padStart(3, '0')}`
}

export function candidateLabel(candidate) {
  return `c${String(candidate).padStart(2, '0')}`
}

export function candidateFilename(assetId, asset, version, candidate, variant = 'default') {
  return `${familySubjectPrefix(assetId, asset, variant)}_${versionLabel(version)}_${candidateLabel(candidate)}.png`
}

export function approvedFilename(assetId, asset, version, variant = 'default') {
  return `${familySubjectPrefix(assetId, asset, variant)}_${versionLabel(version)}.png`
}

export function candidateDirectory(batchId, assetId) {
  return fromRoot('art', 'generated', batchId, assetId, 'candidates')
}

export function rawDirectory(batchId, assetId) {
  return fromRoot('art', 'generated', batchId, assetId, 'raw')
}

export function nextVersion(batchId, assetId, asset, variant = 'default') {
  const dir = candidateDirectory(batchId, assetId)
  const prefix = familySubjectPrefix(assetId, asset, variant)
  if (!fs.existsSync(dir)) return 1
  const versions = fs
    .readdirSync(dir)
    .map((file) => file.match(new RegExp(`^${prefix}_v(\\d{3})_c\\d{2}\\.png$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
  return versions.length > 0 ? Math.max(...versions) + 1 : 1
}

export function parseCandidateFilename(filename) {
  const match = path.basename(filename).match(/^(.+)_v(\d{3})_c(\d{2})\.png$/)
  if (!match) return null
  return {
    prefix: match[1],
    version: Number(match[2]),
    candidate: Number(match[3]),
  }
}
