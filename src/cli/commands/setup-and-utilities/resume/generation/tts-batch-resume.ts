import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { ttsResumeConfig } from './tts-resume'
import type { AggregatedPriceEstimate, PipelineManifest, ResumeResult, ResumeTarget, TtsOptions, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { resolveUserPath } from '~/utils/runtime-paths'

export const createTtsBatchResumeTarget = (batchDir: string): ResumeTarget => ({
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
    throw CLIUsageError(`Existing output at ${batchDir} is not a TTS batch. Use a new --output-dir to start a different run.`)
  }
  if (manifest.items.length !== inputFiles.length) {
    throw CLIUsageError(
      `Existing TTS batch at ${batchDir} has ${manifest.items.length} items, but ${inputFiles.length} input files were found. Use a new --output-dir to start a different batch.`
    )
  }
  for (const [index, inputFile] of inputFiles.entries()) {
    const item = manifest.items[index]
    if (!item || typeof item.input !== 'string') {
      throw CLIUsageError(`Existing TTS batch item ${index + 1} is missing its canonical source path.`)
    }
    let storedPath: string
    let currentPath: string
    try {
      storedPath = await canonicalExistingPath(item.input)
      currentPath = await canonicalExistingPath(inputFile)
    } catch {
      throw CLIUsageError(
        `Existing TTS batch item ${index + 1} source ${item.input} does not match ${inputFile}. Restore the exact source or use a new --output-dir.`
      )
    }
    if (storedPath !== currentPath) {
      throw CLIUsageError(
        `Existing TTS batch item ${index + 1} source ${item.input} does not match ${inputFile}. Restore the exact source or use a new --output-dir.`
      )
    }
  }
  for (const target of targets) {
    if (!target.targetKey) {
      throw CLIUsageError(`TTS target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
    }
    const found = manifest.items.some((item) =>
      item.providers.some((provider) => provider.targetKey === target.targetKey)
    )
    if (!found) {
      throw CLIUsageError(
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
