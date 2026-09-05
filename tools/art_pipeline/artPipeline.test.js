import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { approveCandidate, rejectCandidate } from './lib/approval.js'
import { createContactSheet } from './lib/contactSheet.js'
import { exportRuntime } from './lib/exportRuntime.js'
import { dimensionsForAsset, loadManifest } from './lib/manifest.js'
import { candidateDirectory, candidateFilename, nextVersion } from './lib/naming.js'
import { compilePrompt } from './lib/prompts.js'
import { providerRequestSizeForAsset, resizePlan } from './lib/providerSizing.js'
import { assertReferenceIsApproved, selectReferences } from './lib/references.js'
import { validateCandidate } from './lib/validation.js'
import { generate, planGeneration } from './lib/orchestrator.js'
import {
  auditGameAssetReferences,
  exportPrototypeCandidate,
  generatePrototype,
  hasValidPrototype,
  planPrototype,
  prototypeGameDirectory,
} from './lib/prototype.js'
import { fromRoot } from './lib/paths.js'

const scratch = []
const projectArtifactsToClean = []
const projectArtifactsToRestore = []

function tinyPng(width, height) {
  const buffer = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  buffer.writeUInt8(8, 24)
  buffer.writeUInt8(2, 25)
  return buffer
}

function tempPng(name, width = 512, height = 512) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lost-valley-art-test-'))
  scratch.push(dir)
  const file = path.join(dir, name)
  fs.writeFileSync(file, tinyPng(width, height))
  return file
}

afterEach(() => {
  for (const dir of scratch.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  for (const file of projectArtifactsToClean.splice(0)) {
    fs.rmSync(file, { recursive: true, force: true })
  }
  for (const artifact of projectArtifactsToRestore.splice(0)) {
    fs.mkdirSync(path.dirname(artifact.path), { recursive: true })
    if (artifact.exists) fs.writeFileSync(artifact.path, artifact.contents)
    else fs.rmSync(artifact.path, { recursive: true, force: true })
  }
})

function preserveProjectArtifact(filePath) {
  projectArtifactsToRestore.push({
    path: filePath,
    exists: fs.existsSync(filePath),
    contents: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
  })
}

describe('art pipeline', () => {
  it('loads and validates the manifest with the available art bible fallback', () => {
    const context = loadManifest()
    expect(context.manifest.project).toBe('lost_valley')
    expect(context.artBible.text).toContain('LOST VALLEY')
    expect(context.artBible.path).toContain('ART_BIBLE.md')
  })

  it('compiles layered prompts from style, class, asset, and references', () => {
    const { manifest, artBible } = loadManifest()
    const asset = manifest.assets.compass
    const compiled = compilePrompt({
      manifest,
      artBibleText: artBible.text,
      assetId: 'compass',
      asset,
      references: ['art/references/approved/style_anchor_01.png'],
    })
    expect(compiled.dimensions).toEqual([512, 512])
    expect(compiled.prompt).toContain('1990s American animated action-cartoon')
    expect(compiled.prompt).toContain('animation cel in a serious 1990s dinosaur adventure cartoon')
    expect(compiled.prompt).toContain('hard-edged graphic cel-shadow shapes')
    expect(compiled.prompt).toContain('no realistic material rendering')
    expect(compiled.prompt).toContain('reel_symbol production rules')
    expect(compiled.prompt).toContain('Asset id: compass')
    expect(compiled.prompt).toContain('style_anchor_01.png')
  })

  it('resolves dimensions from asset-specific overrides or symbol defaults', () => {
    const { manifest } = loadManifest()
    expect(dimensionsForAsset(manifest, manifest.assets.compass)).toEqual([512, 512])
    expect(dimensionsForAsset(manifest, manifest.assets.feature_trigger_panel)).toEqual([512, 1024])
  })

  it('maps square 512x512 manifest symbols to OpenAI 1024x1024 and canonical 512x512', () => {
    const { manifest } = loadManifest()
    const plan = planGeneration({
      batch: 'base_utility',
      assets: ['compass'],
      candidates: 1,
      providerName: 'openai',
      dryRun: true,
    })
    expect(plan.items[0].providerRequestSize).toEqual([1024, 1024])
    expect(plan.items[0].canonicalOutputSize).toEqual([512, 512])
    expect(providerRequestSizeForAsset({
      providerName: 'openai',
      canonicalSize: dimensionsForAsset(manifest, manifest.assets.compass),
    })).toEqual([1024, 1024])
  })

  it('maps portrait UI art to the closest OpenAI portrait size', () => {
    const { manifest } = loadManifest()
    expect(providerRequestSizeForAsset({
      providerName: 'openai',
      canonicalSize: dimensionsForAsset(manifest, manifest.assets.feature_trigger_panel),
    })).toEqual([1024, 1536])
  })

  it('maps landscape UI art to the closest OpenAI landscape size', () => {
    expect(providerRequestSizeForAsset({
      providerName: 'openai',
      canonicalSize: [1536, 768],
    })).toEqual([1536, 1024])
  })

  it('plans crop/resize without distortion when provider and canonical ratios differ', () => {
    const plan = resizePlan({
      providerSize: [1024, 1536],
      canonicalSize: [512, 1024],
    })
    expect(plan.preservesAspectRatio).toBe(true)
    expect(plan.fit).toBe('cover')
    expect(plan.cropIfNeeded).toBe(true)
  })

  it('creates candidate filenames and increments versions without overwriting', () => {
    const { manifest } = loadManifest()
    const asset = manifest.assets.compass
    expect(candidateFilename('compass', asset, 1, 3)).toBe('utility_compass_default_v001_c03.png')
    const dir = candidateDirectory('base_utility', 'compass')
    fs.mkdirSync(dir, { recursive: true })
    const marker = path.join(dir, candidateFilename('compass', asset, 1, 1))
    const createdMarker = !fs.existsSync(marker)
    if (createdMarker) fs.writeFileSync(marker, tinyPng(512, 512))
    if (createdMarker) projectArtifactsToClean.push(marker)
    expect(nextVersion('base_utility', 'compass', asset)).toBeGreaterThanOrEqual(2)
  })

  it('validates candidate dimensions, naming, and directory placement', () => {
    const file = tempPng('utility_compass_default_v001_c01.png')
    const result = validateCandidate({
      filePath: file,
      expectedDimensions: [512, 512],
      expectedDirectory: path.dirname(file),
      expectedAssetId: 'compass',
      expectedCandidateCount: 4,
    })
    expect(result.ok).toBe(true)
    expect(result.png.width).toBe(512)
  })

  it('approval refuses to overwrite an existing master', () => {
    const { manifest } = loadManifest()
    const candidate = tempPng('utility_compass_default_v999_c01.png')
    const first = approveCandidate({ manifest, assetId: 'compass', candidatePath: candidate })
    expect(first.status).toBe('approved')
    expect(() => approveCandidate({ manifest, assetId: 'compass', candidatePath: candidate })).toThrow(
      /will not be overwritten/,
    )
    fs.rmSync(first.masterPath, { force: true })
    fs.rmSync(`${first.masterPath}.json`, { force: true })
  })

  it('records rejections and excludes rejected candidates from export', async () => {
    const { manifest } = loadManifest()
    const candidate = tempPng('utility_canteen_default_v998_c01.png', 256, 256)
    const rejection = rejectCandidate({ candidatePath: candidate, reason: 'test rejection' })
    expect(rejection.status).toBe('rejected')
    const exported = await exportRuntime({ manifest, batchId: 'base_utility' })
    expect(exported.some((item) => item.assetId === 'canteen' && item.outputPath.includes('v998'))).toBe(false)
  })

  it('allows only approved masters or pinned style anchors as references', () => {
    const arbitrary = tempPng('unapproved.png')
    expect(() => assertReferenceIsApproved(arbitrary)).toThrow(/not approved/)
    const { manifest } = loadManifest()
    expect(selectReferences(manifest, 'compass', manifest.assets.compass)).toBeInstanceOf(Array)
  })

  it('dry-run performs zero provider calls while saving compiled prompts', async () => {
    const plan = await generate({
      batch: 'base_utility',
      assets: ['mining_pick'],
      candidates: 2,
      dryRun: true,
    })
    expect(plan.requestCount).toBe(2)
    expect(plan.items[0].candidates).toHaveLength(2)
    expect(plan.items[0].providerRequestSize).toEqual([1024, 1024])
    expect(plan.items[0].canonicalOutputSize).toEqual([512, 512])
  })

  it('plans the requested first production batch without generating images', () => {
    const plan = planGeneration({
      batch: 'base_utility',
      assets: ['mining_pick', 'canteen', 'compass', 'excavation_brush'],
      dryRun: true,
    })
    expect(plan.requestCount).toBe(16)
    expect(plan.items.map((item) => item.assetId).sort()).toEqual([
      'canteen',
      'compass',
      'excavation_brush',
      'mining_pick',
    ])
  })

  it('creates SVG contact sheets from candidates', () => {
    const { manifest } = loadManifest()
    const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lost-valley-sheet-test-')), 'sheet.svg')
    scratch.push(path.dirname(outputPath))
    const result = createContactSheet({ manifest, batchId: 'base_utility', outputPath })
    expect(result.outputPath).toBe(outputPath)
    expect(fs.existsSync(result.outputPath)).toBe(true)
  })

  it('embeds candidate image pixels into contact sheets', async () => {
    const { manifest } = loadManifest()
    const testManifest = {
      ...manifest,
      batches: [{ id: 'test_contact_sheet', label: 'Test Contact Sheet', assets: ['contact_test'] }],
    }
    const dir = candidateDirectory('test_contact_sheet', 'contact_test')
    fs.mkdirSync(dir, { recursive: true })
    projectArtifactsToClean.push(path.join('art', 'generated', 'test_contact_sheet'))
    for (let index = 1; index <= 4; index += 1) {
      const redCandidate = path.join(
        dir,
        `utility_contact_test_default_v001_c0${index}.png`,
      )
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 3,
          background: { r: 240, g: 12, b: 24 },
        },
      })
        .png()
        .toFile(redCandidate)
    }

    const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lost-valley-sheet-test-')), 'sheet.svg')
    scratch.push(path.dirname(outputPath))
    const result = createContactSheet({
      manifest: testManifest,
      batchId: 'test_contact_sheet',
      outputPath,
    })
    const { data, info } = await sharp(result.outputPath).raw().toBuffer({ resolveWithObject: true })
    let redPixels = 0
    for (let offset = 0; offset < data.length; offset += info.channels) {
      if (data[offset] > 220 && data[offset + 1] < 40 && data[offset + 2] < 50) redPixels += 1
    }

    expect(result.cols).toBe(2)
    expect(redPixels).toBeGreaterThan(1000)
  })

  it('prototype generation defaults to one candidate per asset', () => {
    const plan = planPrototype({
      batch: 'base_utility',
      assets: ['compass'],
      dryRun: true,
      force: true,
    })
    expect(plan.mode).toBe('prototype')
    expect(plan.requestCount).toBe(1)
    expect(plan.items[0].candidates).toHaveLength(1)
  })

  it('prototype dry-run performs zero provider calls', async () => {
    const plan = await generatePrototype({
      batch: 'base_utility',
      assets: ['compass'],
      providerName: 'dry-run',
      dryRun: true,
      force: true,
    })
    expect(plan.dryRun).toBe(true)
    expect(plan.requestCount).toBe(1)
  })

  it('requires force to overwrite an existing valid prototype asset', async () => {
    const { manifest } = loadManifest()
    const dir = fromRoot('art', 'prototype', 'symbols')
    fs.mkdirSync(dir, { recursive: true })
    const prototypeFile = path.join(dir, 'compass.png')
    preserveProjectArtifact(prototypeFile)
    preserveProjectArtifact(`${prototypeFile}.json`)
    await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .png()
      .toFile(prototypeFile)

    expect(hasValidPrototype({ manifest, assetId: 'compass', asset: manifest.assets.compass })).toBe(true)
    expect(planPrototype({ batch: 'base_utility', assets: ['compass'], dryRun: true }).items[0].skipped).toBe(true)
    expect(planPrototype({ batch: 'base_utility', assets: ['compass'], dryRun: true, force: true }).items[0].skipped).toBe(false)
  })

  it('prototype export creates stable runtime files without approving the asset', async () => {
    const { manifest } = loadManifest()
    const candidate = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lost-valley-prototype-test-')), 'utility_compass_default_v991_c01.png')
    scratch.push(path.dirname(candidate))
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 240, g: 80, b: 20 },
      },
    })
      .png()
      .toFile(candidate)

    const outFile = fromRoot('art', 'prototype', 'symbols', 'compass.png')
    const gameFile = path.join(prototypeGameDirectory(), 'prototype-test-runtime.png')
    preserveProjectArtifact(outFile)
    preserveProjectArtifact(`${outFile}.json`)
    preserveProjectArtifact(gameFile)
    preserveProjectArtifact(`${gameFile}.json`)
    await exportPrototypeCandidate({
      manifest,
      candidatePath: candidate,
      integrateGame: true,
      item: {
        assetId: 'compass',
        prototypePaths: [outFile],
        runtimeNames: ['prototype-test-runtime.png'],
      },
    })
    expect(fs.existsSync(outFile)).toBe(true)
    expect(fs.existsSync(gameFile)).toBe(true)
    const metadata = JSON.parse(fs.readFileSync(`${outFile}.json`, 'utf8'))
    expect(metadata.status).toBe('prototype')
    expect(metadata.approved).toBe(false)
    expect(metadata.production_reference_eligible).toBe(false)
  })

  it('prototype assets cannot be selected as production references', async () => {
    const file = fromRoot('art', 'prototype', 'symbols', 'not_a_reference.png')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    projectArtifactsToClean.push(file)
    await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: { r: 12, g: 180, b: 80 },
      },
    })
      .png()
      .toFile(file)
    expect(() => assertReferenceIsApproved(file)).toThrow(/not approved/)
  })

  it('prototype export does not overwrite existing approved masters', async () => {
    const { manifest } = loadManifest()
    const candidate = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lost-valley-approved-test-')), 'utility_compass_default_v992_c01.png')
    scratch.push(path.dirname(candidate))
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 90, g: 70, b: 40 },
      },
    })
      .png()
      .toFile(candidate)
    const approved = approveCandidate({ manifest, assetId: 'compass', candidatePath: candidate })
    const before = fs.readFileSync(approved.masterPath)
    await exportPrototypeCandidate({
      manifest,
      candidatePath: candidate,
      integrateGame: false,
      item: {
        assetId: 'compass',
        prototypePaths: [fromRoot('art', 'prototype', 'symbols', 'compass-test-does-not-overwrite.png')],
        runtimeNames: ['compass-test-does-not-overwrite.png'],
      },
    })
    projectArtifactsToClean.push(
      fromRoot('art', 'prototype', 'symbols', 'compass-test-does-not-overwrite.png'),
      `${fromRoot('art', 'prototype', 'symbols', 'compass-test-does-not-overwrite.png')}.json`,
    )
    expect(fs.readFileSync(approved.masterPath)).toEqual(before)
    fs.rmSync(approved.masterPath, { force: true })
    fs.rmSync(`${approved.masterPath}.json`, { force: true })
  })

  it('audits game asset references against manifest runtime names', () => {
    const { manifest } = loadManifest()
    const audit = auditGameAssetReferences({ manifest })
    expect(audit.referencedFiles.length).toBeGreaterThan(0)
    expect(audit.placeholdersToReplace.some((file) => file.includes('src/assets/concept'))).toBe(true)
    expect(audit.gameReferencedAssetsMissingFromManifest).toBeInstanceOf(Array)
  })
})
