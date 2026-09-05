import fs from 'node:fs'
import path from 'node:path'

export async function createCanonicalCandidate({ rawPath, outputPath, canonicalSize, providerSize }) {
  const [canonicalWidth, canonicalHeight] = canonicalSize
  const [providerWidth, providerHeight] = providerSize
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  if (canonicalWidth === providerWidth && canonicalHeight === providerHeight) {
    fs.copyFileSync(rawPath, outputPath)
    return { action: 'copied', resampler: 'none' }
  }

  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    throw new Error(
      `Creating canonical art candidates requires high-quality resizing from ${providerWidth}x${providerHeight} to ${canonicalWidth}x${canonicalHeight}, but project-local dependency sharp is not installed. Run npm install --save-dev sharp, then retry generation.`,
    )
  }

  const sameAspect = providerWidth / providerHeight === canonicalWidth / canonicalHeight
  await sharp(rawPath)
    .resize(canonicalWidth, canonicalHeight, {
      fit: sameAspect ? 'contain' : 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .png()
    .toFile(outputPath)

  return {
    action: sameAspect ? 'downsampled' : 'resized-and-cropped',
    resampler: 'sharp',
    preservesAspectRatio: true,
    distorted: false,
  }
}

