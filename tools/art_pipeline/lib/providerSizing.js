export const OPENAI_IMAGE_SIZES = {
  square: [1024, 1024],
  portrait: [1024, 1536],
  landscape: [1536, 1024],
}

export function aspectOrientation([width, height]) {
  if (width === height) return 'square'
  return height > width ? 'portrait' : 'landscape'
}

export function providerRequestSizeForAsset({ providerName = 'openai', canonicalSize }) {
  if (providerName !== 'openai') return canonicalSize
  return OPENAI_IMAGE_SIZES[aspectOrientation(canonicalSize)]
}

export function resizePlan({ providerSize, canonicalSize }) {
  const [providerWidth, providerHeight] = providerSize
  const [canonicalWidth, canonicalHeight] = canonicalSize
  return {
    providerSize,
    canonicalSize,
    requiresResize: providerWidth !== canonicalWidth || providerHeight !== canonicalHeight,
    preservesAspectRatio: true,
    fit: providerWidth / providerHeight === canonicalWidth / canonicalHeight ? 'contain' : 'cover',
    cropIfNeeded: providerWidth / providerHeight !== canonicalWidth / canonicalHeight,
  }
}

