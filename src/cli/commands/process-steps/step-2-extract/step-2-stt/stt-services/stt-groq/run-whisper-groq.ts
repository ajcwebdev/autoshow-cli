import type { Step2Metadata, TranscriptionResult } from '~/types'
import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

export const runGroqTranscribe = async (
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
  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = resolveCredential('groq', 'require', { stage: 'stt:groq', description: 'Groq STT models' })

  const baseURL = GROQ_DEFAULT_BASE_URL
  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'groq',
    providerLabel: 'Groq',
    apiKey,
    baseURL,
    model: modelName,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
