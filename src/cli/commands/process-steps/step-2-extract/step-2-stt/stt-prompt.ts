import { basename } from 'node:path'
import type { PreparedSttMedia, PromptSelectionCandidate, Step2Metadata, SttExtractionOptions, SttPromptRefreshController, SttProviderSuccess, TranscriptionResult } from '~/types'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { buildPrompt } from '../../step-3-write/write-utils/prompt-utils'
import { getSttTargetKey } from './stt-targets'

export const buildProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  const provider = metadata.transcriptionService === 'whisper' ? 'whisper.cpp' : metadata.transcriptionService
  const model = metadata.transcriptionService === 'whisper'
    ? basename(metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel)
      .replace(/^ggml-/, '')
      .replace(/\.bin$/, '')
    : metadata.transcriptionModel

  return `${provider}/${model}`
}

export const buildTimingProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return buildProviderModelLabel(metadata)
  }

  const whisperModelPath = metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel
  return `whisper/${basename(whisperModelPath)}`
}

export const buildPromptFile = async (
  outputDir: string,
  metadata: PreparedSttMedia['metadata'],
  transcription: TranscriptionResult,
  slug: string,
  options: Pick<SttExtractionOptions, 'prompts' | 'promptMd'> & {
    promptSourceProvider?: string | undefined
    requestedSpeakerCount?: number | undefined
    suppressDiarizationLog?: boolean | undefined
  }
): Promise<void> => {
  const instruction = await resolvePromptNames(options.prompts ?? [], {
    exampleFormat: 'json'
  })
  const promptContent = buildPrompt(metadata, transcription, instruction, slug, {
    promptSourceProvider: options.promptSourceProvider,
    requestedSpeakerCount: options.requestedSpeakerCount,
    suppressDiarizationLog: options.suppressDiarizationLog
  })
  await Bun.write(`${outputDir}/prompt.md`, promptContent)

  if (options.promptMd) {
    const mdInstruction = await resolvePromptNames(options.prompts ?? [], {
      exampleFormat: 'markdown'
    })
    const mdPromptContent = buildPrompt(metadata, transcription, mdInstruction, slug, {
      promptSourceProvider: options.promptSourceProvider,
      requestedSpeakerCount: options.requestedSpeakerCount,
      suppressDiarizationLog: true
    })
    await Bun.write(`${outputDir}/prompt-md.md`, mdPromptContent)
  }
}

const scorePromptSelectionCandidate = (
  candidate: PromptSelectionCandidate
): number => {
  const hasSpeakerLabels = candidate.result.segments.some((segment) =>
    typeof segment.speaker === 'string' && segment.speaker.length > 0
  )
  const hasRequestedDiarizationHint = candidate.target.diarizationOptions?.speakerCount !== undefined
  const hasDiarizationEnabled = candidate.target.diarizationOptions?.enabled === true
    || hasRequestedDiarizationHint

  return (hasSpeakerLabels ? 2 : 0) + (hasRequestedDiarizationHint ? 2 : 0) + (hasDiarizationEnabled ? 1 : 0)
}

export const selectPrimaryPromptProvider = (
  successes: Array<SttProviderSuccess | undefined>
): SttProviderSuccess | undefined => {
  const candidates = successes
    .map((entry, index) => ({ entry, index }))
    .filter((entry): entry is { entry: PromptSelectionCandidate, index: number } => entry.entry !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  return candidates
    .sort((left, right) => {
      const scoreDiff = scorePromptSelectionCandidate(right.entry) - scorePromptSelectionCandidate(left.entry)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      return left.index - right.index
    })[0]?.entry
}


/**
 * Serialises prompt-file regeneration across concurrent STT provider completions.
 * Each `queue()` chains a refresh that rebuilds `prompt.md` from the current best
 * transcription, skipping when the winning provider has not changed. `flush()` awaits
 * the outstanding chain and rethrows the first refresh error, if any.
 */
export const createPromptRefreshController = ({
  outputDir,
  preparedMedia,
  options,
  coordinatedAcrossBatch,
  successes
}: {
  outputDir: string
  preparedMedia: PreparedSttMedia
  options: Pick<SttExtractionOptions, 'prompts' | 'promptMd'>
  coordinatedAcrossBatch: boolean
  successes: Array<SttProviderSuccess | undefined>
}): SttPromptRefreshController => {
  let refreshChain = Promise.resolve()
  let refreshError: unknown
  let lastPromptSourceKey: string | undefined
  let lastPromptScore = -1

  const queue = (): void => {
    refreshChain = refreshChain
      .then(async () => {
        if (refreshError !== undefined) {
          return
        }

        const promptSource = selectPrimaryPromptProvider(successes)
        if (!promptSource) {
          return
        }

        const promptSourceKey = getSttTargetKey(promptSource.target)
        const promptScore = scorePromptSelectionCandidate(promptSource)
        if (promptSourceKey === lastPromptSourceKey || promptScore <= lastPromptScore) {
          return
        }

        await buildPromptFile(outputDir, preparedMedia.metadata, promptSource.result, preparedMedia.step1Metadata.slug, {
          prompts: options.prompts,
          promptMd: options.promptMd,
          promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
          requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount,
          suppressDiarizationLog: coordinatedAcrossBatch
        })
        lastPromptSourceKey = promptSourceKey
        lastPromptScore = promptScore
      })
      .catch((error) => {
        refreshError = error
      })
  }

  const flush = async (): Promise<void> => {
    await refreshChain
    if (refreshError !== undefined) {
      throw refreshError
    }
  }

  return { queue, flush }
}
