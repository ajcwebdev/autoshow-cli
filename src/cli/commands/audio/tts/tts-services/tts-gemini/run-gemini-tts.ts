import type { TtsOptions, TtsRequestEvidenceScope, TtsTargetInvocation } from '~/types'
import { geminiJsonRequest } from '~/utils/gemini/gemini-rest'
import { requireTtsCredential } from '../../tts-utils/tts-credentials'
import { splitGeminiTtsText } from './gemini-tts-chunks'
import { runHostedTtsChunkPipeline } from '../../tts-utils/hosted-tts-chunk-pipeline'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { geminiSpeechMime, serializeGeminiInteraction, type GeminiSpeechTurn } from './gemini-tts-request'
import { decodeGeminiInteraction, geminiObject } from './gemini-tts-audio'
import { fetchGeminiSpeechStream } from './gemini-tts-stream'
import { reconcileGeminiTtsUsage } from './gemini-tts-pricing'
import { geminiRequestControls, groupGeminiTurns } from './gemini-dialogue-plan'
import { inspectGeminiSynthesisVoices } from './gemini-voice-availability'
import { UsageError } from '~/utils/error-handler'

export const runGeminiTts = async (text: string, outputDir: string, options: TtsOptions & { model: string, voice: string, instructions?: string | undefined, responseFormat?: string | undefined, invocation?: TtsTargetInvocation | undefined, requestEvidence?: TtsRequestEvidenceScope | undefined, turns?: readonly GeminiSpeechTurn[] | undefined }) => {
  if (options.geminiTtsMode === 'batch') throw UsageError('Gemini remote batches require the durable provider-job workflow.')
  const stream = options.geminiTtsMode === 'stream'
  const mime = geminiSpeechMime(options.responseFormat, stream)
  const groups = options.turns ? groupGeminiTurns(options.model, options.turns) : undefined
  const chunks = groups ? groups.map(g => g.map(t => t.speaker + ': ' + t.text).join('\n')) : splitGeminiTtsText(options.model, { text, speaker: options.invocation?.speaker ?? 'NARRATOR', voice: options.voice, style: options.instructions }, options.ttsChunking)
  if (!chunks.length) throw UsageError('Gemini TTS input is empty.')
  const requests = chunks.map((chunk, index) => serializeGeminiInteraction(options.model, groups?.[index] ?? [{ text: chunk, speaker: options.invocation?.speaker ?? 'NARRATOR', voice: options.voice, style: options.instructions }], options.responseFormat, stream))
  const apiKey = requireTtsCredential('gemini')
  await inspectGeminiSynthesisVoices(apiKey, options.model, options.turns?.map(turn => turn.voice) ?? [options.voice])
  const start = new Date()
  const observed: NonNullable<ReturnType<typeof reconcileGeminiTtsUsage>>[] = []
  const result = await runHostedTtsChunkPipeline({
    provider: 'gemini', providerLabel: 'Gemini', model: options.model, speaker: options.voice,
    chunks, outputDir, chunkExtension: 'wav', startTime: start.getTime(),
    abortSignal: options.invocation?.signal, chunkScheduler: options.hostedTtsChunkScheduler,
    chunkConcurrency: options.ttsChunkConcurrency, requestEvidence: options.requestEvidence,
    // Ambiguous synthesis is never automatically purchased again.
    retryPolicy: { maxAttempts: 1 },
    ...(!stream ? { inlineAudioResponse: { audioBytesPerSecond: 48000, encoding: 'base64' as const } } : {}),
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt }) => {
      const body = requests[chunkIndex - 1]!
      return dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex, endpointKind: 'interactions', serializerVersion: 'gemini.tts.v1',
        serializedRequest: { path: '/v1beta/interactions', body }, providerText: chunk,
        voiceField: 'generation_config.speech_config', voices: (groups?.[chunkIndex - 1] ?? [{ voice: options.voice, speaker: options.invocation?.speaker ?? 'NARRATOR' }]).map(t => ({ kind: 'provider-id', value: t.voice, speaker: t.speaker })),
        requestControls: geminiRequestControls(groups ? groups[chunkIndex - 1]?.[0]?.style : options.instructions, options.responseFormat, stream ? 'stream' : 'unary'),
      }, { attempt: requestAttempt }, async lifecycle => {
        const result = stream
          ? await fetchGeminiSpeechStream(apiKey, body, mime, signal)
          : await geminiJsonRequest(apiKey, 'interactions', { method: 'POST', body, abortSignal: signal }).then(({ json }) => ({ audio: decodeGeminiInteraction(json, mime), usage: geminiObject(json)['usage'] }))
        const usage = reconcileGeminiTtsUsage(options.model, stream ? 'stream' : 'unary', result.usage, start)
        if (usage) observed.push(usage)
        await lifecycle.accepted({ ...(usage ? { fields: usage } : {}) })
        return result.audio
      })
    },
  })
  return { ...result, metadata: { ...result.metadata, geminiTtsUsage: observed, geminiTtsUsageComplete: observed.length === chunks.length, transport: stream ? 'gemini-stream' : 'gemini-unary' } }
}
