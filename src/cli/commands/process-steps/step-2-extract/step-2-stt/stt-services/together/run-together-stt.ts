import type { DiarizationOptions, Step2Metadata, TranscriptionResult } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

export const buildTogetherSttFormFields = (
  model: string,
  prompt?: string | undefined,
  diarizationOptions?: DiarizationOptions
): Record<string, string | string[]> => {
  const fields: Record<string, string | string[]> = {
    response_format: 'verbose_json',
    'timestamp_granularities[0]': 'word',
    'timestamp_granularities[1]': 'segment',
    diarize: String(diarizationOptions?.enabled ?? false),
    ...(diarizationOptions?.enabled && diarizationOptions.speakerCount ? { min_speakers: String(diarizationOptions.speakerCount), max_speakers: String(diarizationOptions.speakerCount) } : {})
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
    diarizationOptions?: DiarizationOptions | undefined
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = resolveCredential('together', 'require', { stage: 'stt:together', description: 'Together transcription' })

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'together',
    providerLabel: 'Together',
    apiKey,
    baseURL: TOGETHER_DEFAULT_BASE_URL,
    model,
    formFields: buildTogetherSttFormFields(model, undefined, options.diarizationOptions),
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
