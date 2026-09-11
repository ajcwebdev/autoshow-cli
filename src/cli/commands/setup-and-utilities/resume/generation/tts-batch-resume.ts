import { createGenerationOutputDir } from '~/cli/commands/command-shared/generation-command-utils'
import { getPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureModelCostFilter } from '~/cli/commands/pricing-orchestration/model-cost-filter'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { enforceTtsBatchBudget } from '~/cli/commands/audio/tts/tts-batch-estimates'
import { getInputStem } from '~/cli/commands/audio/tts/tts-batch-plan'
import * as l from '~/utils/app-logger/app-logger'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { readManifest, PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { ttsResumeConfig } from './tts-resume'
import type { AggregatedPriceEstimate, PipelineManifest, ResumeResult, ResumeTarget, StandaloneTtsCommandOptions, TtsOptions, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { resolveUserPath } from '~/utils/runtime-paths'

const createTtsBatchResumeTarget = (batchDir: string): ResumeTarget => ({
  kind: 'tts',
  scope: 'batch',
  dir: batchDir,
  manifestPath: join(batchDir, PIPELINE_MANIFEST_FILE)
})

const canonicalExistingPath = async (value: string): Promise<string> =>
  await realpath(resolveUserPath(value))

export const assertCompatibleTtsDirectoryBatch = async (
  batchDir: string,
  manifest: PipelineManifest,
  inputFiles: readonly string[],
  targets: readonly TtsTarget[]
): Promise<void> => {
  if (manifest.command !== 'tts' || manifest.scope !== 'batch') {
    throw UsageError(`Existing output at ${batchDir} is not a TTS batch. Use a new --output-dir to start a different run.`)
  }
  if (manifest.items.length !== inputFiles.length) {
    throw UsageError(
      `Existing TTS batch at ${batchDir} has ${manifest.items.length} items, but ${inputFiles.length} input files were found. Use a new --output-dir to start a different batch.`
    )
  }
  for (const [index, inputFile] of inputFiles.entries()) {
    const item = manifest.items[index]
    if (!item || typeof item.input !== 'string') {
      throw UsageError(`Existing TTS batch item ${index + 1} is missing its canonical source path.`)
    }
    let storedPath: string
    let currentPath: string
    try {
      storedPath = await canonicalExistingPath(item.input)
      currentPath = await canonicalExistingPath(inputFile)
    } catch {
      throw UsageError(
        `Existing TTS batch item ${index + 1} source ${item.input} does not match ${inputFile}. Restore the exact source or use a new --output-dir.`
      )
    }
    if (storedPath !== currentPath) {
      throw UsageError(
        `Existing TTS batch item ${index + 1} source ${item.input} does not match ${inputFile}. Restore the exact source or use a new --output-dir.`
      )
    }
  }
  for (const target of targets) {
    if (!target.targetKey) {
      throw UsageError(`TTS target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
    }
    const found = manifest.items.some((item) =>
      item.providers.some((provider) => provider.targetKey === target.targetKey)
    )
    if (!found) {
      throw UsageError(
        `Existing TTS batch at ${batchDir} has no stored ${target.service}/${target.model} target. Use a new --output-dir to start a different render.`
      )
    }
  }
}

export const priceExistingTtsDirectoryBatch = async (
  batchDir: string,
  opts: TtsOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(createTtsBatchResumeTarget(batchDir), ttsResumeConfig, opts, explicitFlags)

export const resumeExistingTtsDirectoryBatch = async (
  batchDir: string,
  opts: TtsOptions,
  explicitFlags: Set<string> = new Set()
): Promise<ResumeResult> =>
  await resumeGenerationTarget(createTtsBatchResumeTarget(batchDir), ttsResumeConfig, opts, explicitFlags)

export const attachExistingTtsDirectoryBatch = async (
  inputPath: string,
  inputFiles: string[],
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<boolean> => {
  const pinnedDir = getPinnedRunDir()
  if (pinnedDir) {
    const existing = await readManifest(pinnedDir)
    if (existing?.command === 'tts' && existing.scope === 'batch') {
      let estimate = await priceExistingTtsDirectoryBatch(pinnedDir, ttsOptions)
      if (ttsOptions.maxModelCents !== undefined) {
        const excludedTargets = configureModelCostFilter(ttsOptions, [estimate])
        targets = collectTtsTargets(ttsOptions)
        if (excludedTargets.length > 0) {
          estimate = await priceExistingTtsDirectoryBatch(pinnedDir, ttsOptions)
        }
      }
      await assertCompatibleTtsDirectoryBatch(pinnedDir, existing, inputFiles, targets)
      if (ttsOptions.price) {
        l.report.price(estimate)
        return true
      }
      enforceTtsBatchBudget(estimate.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)
      await createGenerationOutputDir(getInputStem(inputPath))
      await resumeExistingTtsDirectoryBatch(pinnedDir, ttsOptions)
      return true
    }
  }

  return false
}
