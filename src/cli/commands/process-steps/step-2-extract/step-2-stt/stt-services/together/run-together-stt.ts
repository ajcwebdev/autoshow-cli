import type { Step2Metadata, TranscriptionResult } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

export const buildTogetherSttFormFields = (
  model: string,
  prompt?: string | undefined
): Record<string, string> => {
  const fields: Record<string, string> = {
    response_format: 'verbose_json',
    'timestamp_granularities[]': 'segment'
  }
  const normalizedPrompt = prompt?.trim()
  if (model === 'openai/whisper-large-v3' && normalizedPrompt) {
    fields['prompt'] = normalizedPrompt
  }
  return fields
}

export const runTogetherStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw InternalError('TOGETHER_API_KEY environment variable is required for Together transcription', { stage: 'stt:together', hints: hintsForMissingEnv('TOGETHER_API_KEY') })
  }

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'together',
    providerLabel: 'Together',
    apiKey,
    baseURL: TOGETHER_DEFAULT_BASE_URL,
    model,
    formFields: buildTogetherSttFormFields(model),
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
