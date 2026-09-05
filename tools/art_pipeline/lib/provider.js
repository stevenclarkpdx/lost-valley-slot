import fs from 'node:fs'

export class ImageProvider {
  async generateImage() {
    throw new Error('ImageProvider.generateImage must be implemented by a provider.')
  }
}

export class DryRunProvider extends ImageProvider {
  async generateImage() {
    throw new Error('Dry run does not call the image provider.')
  }
}

export class OpenAIImageProvider extends ImageProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.LOST_VALLEY_IMAGE_MODEL ?? 'gpt-image-1' } = {}) {
    super()
    this.apiKey = apiKey
    this.model = model
  }

  async generateImage({ prompt, width, height, outputPath }) {
    if (!this.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Add it to your environment, then rerun generation. Dry-run does not require credentials.',
      )
    }
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        size: `${width}x${height}`,
        n: 1,
      }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Image provider failed (${response.status}): ${body}`)
    }
    const payload = await response.json()
    const base64 = payload.data?.[0]?.b64_json
    if (!base64) throw new Error('Image provider response did not include b64_json image data.')
    fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'))
    return {
      provider: 'openai',
      model: this.model,
      outputPath,
    }
  }
}

export function createProvider(name = process.env.LOST_VALLEY_IMAGE_PROVIDER ?? 'openai') {
  if (name === 'openai') return new OpenAIImageProvider()
  if (name === 'dry-run') return new DryRunProvider()
  throw new Error(`Unknown image provider ${name}`)
}

