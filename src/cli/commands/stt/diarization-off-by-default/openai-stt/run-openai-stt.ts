import type { Step2Metadata, TranscriptionResult } from '~/types'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../../stt-shared/openai-compatible-single-speaker'

// 2026-09-16: gpt-transcribe rejects response_format verbose_json ("Use 'json' or
// 'text' instead") and returns no words or segments, so the request stays on json
// and the shared parser records a single whole-request segment.
export const OPENAI_STT_RESPONSE_FORMAT = 'json'

export const buildOpenAISttFormFields = (): Record<string, string | string[]> => ({
  response_format: OPENAI_STT_RESPONSE_FORMAT
})

export const runOpenAIStt = async (
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
  const apiKey = resolveCredential('openai', 'require', { stage: 'stt:openai', description: 'OpenAI transcription' })

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'openai-stt',
    providerLabel: 'OpenAI',
    apiKey,
    baseURL: OPENAI_DEFAULT_BASE_URL,
    model,
    formFields: buildOpenAISttFormFields(),
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
