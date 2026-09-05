import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export function fromRoot(...parts) {
  return path.join(PROJECT_ROOT, ...parts)
}

export const ART_ROOT = fromRoot('art')
export const MANIFEST_CANDIDATES = [fromRoot('art', 'ASSET_MANIFEST.json'), fromRoot('ASSET_MANIFEST.json')]
export const ART_BIBLE_CANDIDATES = [
  fromRoot('art', 'ART_BIBLE.md'),
  fromRoot('ART_BIBLE.md'),
  fromRoot('art', 'LOST_VALLEY_ART_BIBLE.md'),
  fromRoot('LOST_VALLEY_ART_BIBLE.md'),
]

export function toPosixPath(value) {
  return value.split(path.sep).join('/')
}
