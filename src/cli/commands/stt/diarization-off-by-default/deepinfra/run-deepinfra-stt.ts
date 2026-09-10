import { parseCaptionCues } from '~/cli/commands/audio/music/lyrics-video/captions'
import { buildTranscriptionOutputBase, toTimestamp } from '../../stt-utils/stt-utils'
import { finalizeHostedSttResult } from '../../stt-shared/finalize-hosted-stt'
import { ProviderError } from '~/utils/error-handler'
import type { Step2Metadata, TranscriptionResult } from '~/types'
import { DEEPINFRA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../../stt-shared/openai-compatible-single-speaker'

const normalizeDeepinfraBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '').replace(/\/openai$/, '')

export const runDeepinfraTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    nativeResponseFormat?: 'srt' | 'vtt' | undefined
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = resolveCredential('deepinfra', 'require', { stage: 'stt:deepinfra', description: 'DeepInfra transcription' })

  const baseURL = normalizeDeepinfraBaseURL(DEEPINFRA_DEFAULT_BASE_URL)
  if (options.nativeResponseFormat) {
    const format = options.nativeResponseFormat
    const startTime = Date.now()
    const form = new FormData()
    form.append('model', model)
    form.append('response_format', format)
    form.append('file', Bun.file(audioPath))
    const response = await fetch(baseURL + '/audio/transcriptions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form,
      signal: AbortSignal.timeout(20 * 60 * 1000)
    })
    if (!response.ok) throw ProviderError('DeepInfra subtitle transcription failed: HTTP ' + response.status, { stage: 'stt:deepinfra', retryable: false })
    const raw = await response.text()
    await Bun.write(buildTranscriptionOutputBase(outputDir, segmentNumber) + '.native.' + format, raw)
    const cues = parseCaptionCues(raw, format)
    const offset = segmentOffsetMinutes * 60
    return await finalizeHostedSttResult({
      provider: 'deepinfra', model, outputDir, segmentNumber, totalSegments, offsetSeconds: offset,
      startTime, transcribeMs: Date.now() - startTime, requestCount: 1, retryCount: 0, rateLimitCount: 0,
      text: cues.map(cue => cue.text).join(' '),
      segments: cues.map(cue => ({ start: toTimestamp(cue.start + offset), end: toTimestamp(cue.end + offset), text: cue.text })),
      evidenceWords: [], rawResponse: { format, subtitles: raw }
    })
  }
  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'deepinfra',
    providerLabel: 'DeepInfra',
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
