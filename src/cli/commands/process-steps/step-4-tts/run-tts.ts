import { rename } from 'node:fs/promises'
import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import {
  collectTtsTargets,
  getTtsArtifactFileName,
  validateTtsInput,
} from './tts-targets'
import { isMultiSpeakerRequested } from './dialogue-normalizer'
import { runMultiSpeakerTts } from './run-multi-speaker-tts'
import { InternalError } from '~/utils/error-handler'
import { createHostedTtsChunkScheduler } from './tts-utils/hosted-tts-chunk-scheduler'

const getMetadataAudioPath = (outputDir: string, metadata: Step4Metadata): string =>
  `${outputDir}/${metadata.audioFileName}`

const withRunScopedHostedTtsChunkScheduler = (options: TtsOptions): TtsOptions => {
  if (!options.hostedTtsChunkScheduler) {
    options.hostedTtsChunkScheduler = createHostedTtsChunkScheduler(options.ttsChunkConcurrency)
  }
  return options
}

export const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  _options: TtsOptions
): Promise<Step4Metadata[]> => {
  const options = withRunScopedHostedTtsChunkScheduler(_options)
  return await runTargets<TtsTarget, Step4Metadata>({
    targets,
    outputDir,
    stepLabel: 'TTS',
    noProviderMessage: 'No provider produced audio',
    concurrency: {
      provider: options.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      local: options.ttsLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY
    },
    getTargetPool: (target) => target.service === 'kitten' ? 'local' : 'hosted',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.tts-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    resourceGate: options.generationResourceGate,
    runTarget: async (target, workspaceDir) => {
      const { audioPath, metadata } = await target.run(text, workspaceDir, options)
      return { ...metadata, _audioPath: audioPath }
    },
    finalizeTarget: async (target, result, singleTarget) => {
      const { _audioPath, ...metadata } = result as Step4Metadata & { _audioPath: string }
      if (singleTarget) return metadata

      const fileName = getTtsArtifactFileName(target, false)
      const finalPath = `${outputDir}/${fileName}`
      await rename(_audioPath, finalPath)

      return {
        ...metadata,
        audioFileName: fileName,
        audioFileSize: Bun.file(finalPath).size
      }
    }
  })
}

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  validateTtsInput(text, options)
  const targets = collectTtsTargets(options)

  if (targets.length === 0) {
    throw InternalError('No TTS provider configured', { stage: 'tts:run' })
  }

  return await runTtsForTargets(text, outputDir, options, targets)
}

export const runTtsForTargets = async (
  text: string,
  outputDir: string,
  options: TtsOptions,
  targets: TtsTarget[]
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  if (targets.length === 0) {
    return { audioPaths: [], metadata: [] }
  }

  if (isMultiSpeakerRequested(options)) {
    const wrappedTargets: TtsTarget[] = targets.map((target) => ({
      ...target,
      run: async (t: string, dir: string, _opts: TtsOptions) =>
        runMultiSpeakerTts(t, dir, target, _opts)
    }))
    const metadata = await runTtsTargets(wrappedTargets, text, outputDir, options)
    return {
      audioPaths: metadata.map((entry) => getMetadataAudioPath(outputDir, entry)),
      metadata
    }
  }

  const metadata = await runTtsTargets(targets, text, outputDir, options)
  return {
    audioPaths: metadata.map((entry) => getMetadataAudioPath(outputDir, entry)),
    metadata
  }
}
