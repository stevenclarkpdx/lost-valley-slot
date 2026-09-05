#!/usr/bin/env node
import { approve, exportApproved, generate, planGeneration, reject, review } from './lib/orchestrator.js'
import { generatePrototype, planPrototype } from './lib/prototype.js'

function parseArgs(argv) {
  const [command, ...rest] = argv
  const args = { command, assets: [] }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (token === '--batch') args.batch = rest[++index]
    else if (token === '--asset') args.assets.push(rest[++index])
    else if (token === '--candidate') args.candidatePath = rest[++index]
    else if (token === '--candidates') args.candidates = Number(rest[++index])
    else if (token === '--provider') args.providerName = rest[++index]
    else if (token === '--notes') args.notes = rest[++index]
    else if (token === '--reason') args.reason = rest[++index]
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--generate') args.dryRun = false
    else if (token === '--all') args.all = true
    else if (token === '--force') args.force = true
    else if (token === '--integrate-game') args.integrateGame = true
    else if (!args.assetId && ['approve', 'regenerate'].includes(command)) args.assetId = token
    else throw new Error(`Unknown argument: ${token}`)
  }
  return args
}

function printPlan(plan) {
  for (const warning of plan.warnings) console.warn(`Warning: ${warning}`)
  console.log(JSON.stringify({
    dryRun: plan.dryRun,
    manifestVersion: plan.manifestVersion,
    requestCount: plan.requestCount,
    items: plan.items.map((item) => ({
      assetId: item.assetId,
      family: item.family,
      assetClass: item.assetClass,
      dimensions: item.dimensions,
      providerRequestSize: item.providerRequestSize,
      canonicalOutputSize: item.canonicalOutputSize,
      resizePlan: item.resizePlan,
      version: `v${String(item.version).padStart(3, '0')}`,
      filenames: item.candidates,
      compiledPromptPaths: item.compiledPromptPaths ?? [],
      candidateDir: item.candidateDir,
      rawDir: item.rawDir,
      references: item.references,
      promptPreview: item.prompt.slice(0, 700),
      prototypePaths: item.prototypePaths,
      runtimeNames: item.runtimeNames,
      skipped: item.skipped,
      skipReason: item.skipReason,
    })),
    missingAssetAudit: plan.missingAssetAudit,
  }, null, 2))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  switch (args.command) {
    case 'plan':
      printPlan(planGeneration({ ...args, dryRun: true }))
      break
    case 'generate':
      printPlan(await generate({ ...args, dryRun: args.dryRun !== false }))
      break
    case 'review':
      console.log(JSON.stringify(review(args), null, 2))
      break
    case 'approve':
      console.log(JSON.stringify(approve(args), null, 2))
      break
    case 'reject':
      console.log(JSON.stringify(reject(args), null, 2))
      break
    case 'regenerate':
      printPlan(await generate({ batch: args.batch, assets: [args.assetId], candidates: args.candidates, dryRun: args.dryRun !== false, providerName: args.providerName }))
      break
    case 'prototype':
      if (args.dryRun === false) {
        const preflight = planPrototype({
          batch: args.batch,
          assets: args.assets,
          all: args.all,
          force: args.force,
          dryRun: true,
          providerName: args.providerName,
        })
        console.error(`Prototype generation preflight: ${preflight.requestCount} provider request(s), ${preflight.skippedCount} skipped.`)
      }
      printPlan(await generatePrototype({
        batch: args.batch,
        assets: args.assets,
        all: args.all,
        force: args.force,
        integrateGame: args.integrateGame,
        dryRun: args.dryRun !== false,
        providerName: args.providerName,
      }))
      break
    case 'export':
      console.log(JSON.stringify(await exportApproved(args), null, 2))
      break
    default:
      console.log(`Lost Valley art pipeline

Commands:
  node tools/art_pipeline/art.js plan --batch base_utility
  node tools/art_pipeline/art.js generate --batch base_utility --dry-run
  node tools/art_pipeline/art.js generate --batch base_utility --generate
  node tools/art_pipeline/art.js review --batch base_utility
  node tools/art_pipeline/art.js approve compass --candidate <path>
  node tools/art_pipeline/art.js reject --candidate <path> --reason "why"
  node tools/art_pipeline/art.js regenerate compass --batch base_utility --dry-run
  node tools/art_pipeline/art.js prototype --all --dry-run
  node tools/art_pipeline/art.js prototype --batch base_utility --generate
  node tools/art_pipeline/art.js export --batch base_utility`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
