import fs from 'node:fs'
import path from 'node:path'
import { candidateDirectory } from './naming.js'
import { fromRoot } from './paths.js'

export function createContactSheet({ manifest, batchId, outputPath: requestedOutputPath = null }) {
  const batch = manifest.batches.find((candidate) => candidate.id === batchId)
  if (!batch) throw new Error(`Unknown batch ${batchId}`)
  const cells = []
  for (const assetId of batch.assets) {
    const dir = candidateDirectory(batchId, assetId)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter((candidate) => candidate.endsWith('.png')).sort()) {
      cells.push({ assetId, file, fullPath: path.join(dir, file) })
    }
  }
  const layout = layoutForCells(cells)
  const { cellWidth, cellHeight, imageSize, cols } = layout
  const rows = Math.max(1, Math.ceil(cells.length / cols))
  const width = Math.max(cellWidth, cols * cellWidth)
  const height = Math.max(cellHeight, rows * cellHeight)
  const out = requestedOutputPath ?? outputPath(batchId)
  const body = cells
    .map((item, index) => {
      const x = (index % cols) * cellWidth
      const y = Math.floor(index / cols) * cellHeight
      const imageX = Math.round((cellWidth - imageSize) / 2)
      const imageY = 24
      const href = pngDataUri(item.fullPath)
      const parsed = item.file.match(/_v(\d{3})_c(\d{2})\.png$/)
      const versionCandidate = parsed ? `v${parsed[1]} · c${parsed[2]}` : item.file
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="8" y="8" width="${cellWidth - 16}" height="${cellHeight - 16}" rx="6" fill="#11150f" stroke="#3a3120" />
          <rect x="${imageX - 4}" y="${imageY - 4}" width="${imageSize + 8}" height="${imageSize + 8}" rx="5" fill="#151811" />
          <image href="${href}" x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet" />
          <rect x="${imageX - 4}" y="${imageY - 4}" width="${imageSize + 8}" height="${imageSize + 8}" rx="5" fill="none" stroke="#b89042" stroke-width="2" />
          <text x="${cellWidth / 2}" y="${imageY + imageSize + 20}" fill="#f0d38a" text-anchor="middle" font-size="12" font-family="monospace" font-weight="700">${escapeXml(item.assetId)}</text>
          <text x="${cellWidth / 2}" y="${imageY + imageSize + 35}" fill="#c3aa70" text-anchor="middle" font-size="10" font-family="monospace">${escapeXml(versionCandidate)}</text>
          <text x="${cellWidth / 2}" y="${imageY + imageSize + 49}" fill="#807354" text-anchor="middle" font-size="8" font-family="monospace">${escapeXml(item.file)}</text>
        </g>`
    })
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#080b08" />
    ${body}
  </svg>`
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, svg)
  return { outputPath: out, count: cells.length, ...layout, rows, width, height }
}

function outputPath(batchId) {
  return fromRoot('art', 'review', 'contact_sheets', `${batchId}_contact_sheet.svg`)
}

function layoutForCells(cells) {
  const uniqueAssets = new Set(cells.map((cell) => cell.assetId))
  const count = Math.max(1, cells.length)
  let cols
  if (count === 1) cols = 1
  else if (uniqueAssets.size === 1 && count <= 4) cols = 2
  else cols = Math.min(4, Math.ceil(Math.sqrt(count)))
  return {
    cols,
    cellWidth: 190,
    cellHeight: 230,
    imageSize: 148,
  }
}

function pngDataUri(filePath) {
  const bytes = fs.readFileSync(filePath)
  return `data:image/png;base64,${bytes.toString('base64')}`
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char])
}
