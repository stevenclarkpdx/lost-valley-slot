import fs from 'node:fs'
import path from 'node:path'
import { parseCandidateFilename } from './naming.js'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function readPngInfo(filePath) {
  const buffer = fs.readFileSync(filePath)
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a valid PNG file.`)
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
    hasAlpha: [4, 6].includes(buffer.readUInt8(25)),
    bytes: buffer.length,
  }
}

export function validateCandidate({ filePath, expectedDimensions, expectedDirectory, expectedAssetId, expectedCandidateCount }) {
  const errors = []
  const warnings = []
  if (!fs.existsSync(filePath)) errors.push('file does not exist')
  if (expectedDirectory && path.resolve(path.dirname(filePath)) !== path.resolve(expectedDirectory)) {
    errors.push('candidate is in the wrong output directory')
  }
  const parsed = parseCandidateFilename(filePath)
  if (!parsed) errors.push('filename does not match candidate naming convention')
  if (parsed && expectedAssetId && !path.basename(filePath).includes(`_${expectedAssetId}_`)) {
    errors.push(`filename does not include expected asset id ${expectedAssetId}`)
  }

  let png = null
  if (errors.length === 0) {
    try {
      png = readPngInfo(filePath)
      const [width, height] = expectedDimensions
      if (png.width !== width) errors.push(`width ${png.width} does not match expected ${width}`)
      if (png.height !== height) errors.push(`height ${png.height} does not match expected ${height}`)
      if (width === height && png.width !== png.height) errors.push('symbol asset is not square')
      if (png.bytes < 1024) warnings.push('image file is very small; verify it is not empty or placeholder-only')
      if (png.hasAlpha) warnings.push('image has alpha; verify this is intentional for a filled-background asset')
    } catch (error) {
      errors.push(error.message)
    }
  }

  if (expectedCandidateCount !== undefined && parsed?.candidate > expectedCandidateCount) {
    warnings.push('candidate number is higher than the requested count for this run')
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    png,
  }
}
