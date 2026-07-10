import { DEFAULT_CONFIG } from '../src/engine/config'
import { runSimulation } from '../src/engine/simulation'

const spins = Number(process.argv[2] ?? 100000)
const seed = Number(process.argv[3] ?? 424242)
const result = runSimulation(DEFAULT_CONFIG, spins, seed)

console.log(
  JSON.stringify(
    {
      spins: result.spins,
      seed: result.seed,
      baseRtp: result.baseRtp,
      evidenceRtp: result.evidenceRtp,
      evidenceRtpByMilestone: result.evidenceRtpByMilestone,
      featureRtp: result.featureRtp,
      totalRtp: result.totalRtp,
      triggerFrequency: result.triggerFrequency,
      evidenceBonusFrequency: result.evidenceBonusFrequency,
      evidenceMilestoneFrequency: result.evidenceMilestoneFrequency,
      evidenceUniqueDistribution: result.evidenceUniqueDistribution,
      wildAppearanceRate: result.wildAppearanceRate,
      wildAssistedClusterFrequency: result.wildAssistedClusterFrequency,
      goldenAmberHitFrequency: result.goldenAmberHitFrequency,
      twoFootprintFrequency: result.twoFootprintFrequency,
      baseWinsOver10Frequency: result.baseWinsOver10Frequency,
      largestBaseGameHit: result.largestBaseGameHit,
      baseWinP95: result.baseWinPercentiles.p95,
      baseWinP99: result.baseWinPercentiles.p99,
      averageFeatureWin: result.averageFeatureWin,
      featureP50: result.percentiles.p50,
      featureP90: result.percentiles.p90,
      featureP99: result.percentiles.p99,
    },
    null,
    2,
  ),
)
