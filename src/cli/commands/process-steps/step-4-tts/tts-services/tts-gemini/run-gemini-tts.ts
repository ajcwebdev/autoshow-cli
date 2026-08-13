import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/write-gemini/gemini-utils'
import { concatAndConvertToWav, runTtsChunks, splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { classifyHostedTtsRetry, withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { GEMINI_DEFAULT_TTS_VOICE, validateGeminiTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { GeminiInlineAudioInfo, GeminiTtsModel, HostedTtsChunkScheduler, SpeakerVoiceRegistry, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import {
buildGeminiSpeakerVoiceConfigs,
formatSpeakerRegistrySummary,
splitGeminiNativeDialogueText,
validateGeminiMultiSpeakerTranscriptFromRegistry
} from './gemini-tts-config'

const classifyGeminiTtsRetry = (error: unknown) => {
  if (error instanceof Error && (error as Error & { ttsAdmissionAmbiguous?: boolean }).ttsAdmissionAmbiguous === true) {
    return { shouldRetry: false, delayMs: 0, reason: 'provider admission outcome is ambiguous' }
  }
  const hostedDecision = classifyHostedTtsRetry(error)
  return hostedDecision.shouldRetry ? hostedDecision : classifyGeminiRetry(error)
}

const parseGeminiInlineAudioInfo = (mimeType: string | undefined): GeminiInlineAudioInfo => {
  const raw = mimeType ?? ''
  const normalized = raw.toLowerCase()
  const rateMatch = /rate=(\d+)/i.exec(raw)
  const parsedRate = rateMatch ? Number.parseInt(rateMatch[1] as string, 10) : NaN
  const sampleRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 24000

  if (normalized.includes('audio/l16') || normalized.includes('codec=pcm') || normalized.includes('audio/pcm')) {
    return {
      ext: 'pcm',
      isRawPcm: true,
      sampleRate
    }
  }
  if (normalized.includes('wav')) return { ext: 'wav', isRawPcm: false, sampleRate }
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return { ext: 'mp3', isRawPcm: false, sampleRate }
  if (normalized.includes('ogg')) return { ext: 'ogg', isRawPcm: false, sampleRate }
  if (normalized.includes('aac')) return { ext: 'aac', isRawPcm: false, sampleRate }
  if (normalized.includes('flac')) return { ext: 'flac', isRawPcm: false, sampleRate }
  return { ext: 'wav', isRawPcm: false, sampleRate }
}

export const runGeminiTts = async (
  text: string,
  outputDir: string,
  options: {
    model: GeminiTtsModel
    voiceId?: string | undefined
    speakerVoiceRegistry?: SpeakerVoiceRegistry | undefined
    languageCode?: string | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const registry = options.speakerVoiceRegistry
  const isMultiSpeaker = Boolean(registry)
  const voiceId = isMultiSpeaker
    ? undefined
    : validateGeminiTtsVoice(options.voiceId?.trim() || GEMINI_DEFAULT_TTS_VOICE)
  const chunks = registry
    ? splitGeminiNativeDialogueText(text, registry, TTS_CHUNK_CHARACTER_LIMITS.gemini)
    : splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.gemini)
  if (chunks.length === 0) {
    throw ValidationError('Gemini TTS input text is empty', { stage: 'tts:gemini' })
  }

  if (registry) {
    validateGeminiMultiSpeakerTranscriptFromRegistry(text, registry)
  }

  const apiKey = requireApiKey('GEMINI_API_KEY', 'tts:gemini', 'Gemini TTS')

  const speakerSummary = registry
    ? formatSpeakerRegistrySummary(registry)
    : voiceId

  logTtsConfig('Gemini', isMultiSpeaker
    ? [
        { label: 'model', value: options.model },
        { label: 'mode', value: 'multispeaker' },
        { label: 'speakers', value: speakerSummary },
        { label: 'chunk count', value: chunks.length }
      ]
    : [
        { label: 'model', value: options.model },
        { label: 'voice', value: voiceId },
        { label: 'chunk count', value: chunks.length }
      ])

  const startTime = Date.now()
  const chunkPaths: string[] = []
  const rawPaths: string[] = []

  try {
    const chunkPathGroups = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index, admission) => {
      const chunkIndex = index + 1
      const speakerVoiceConfigs = registry ? buildGeminiSpeakerVoiceConfigs(registry) : undefined
      const generationConfig = {
        responseModalities: ['AUDIO'],
        speechConfig: {
          ...(options.languageCode ? { languageCode: options.languageCode } : {}),
          ...(speakerVoiceConfigs
            ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs } }
            : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId as string } } })
        }
      }
      const response = await withHostedTtsRetry(
        {
          operationName: `gemini-tts-chunk-${chunkIndex}`,
          abortSignal: options.abortSignal,
          classifier: classifyGeminiTtsRetry,
          admission,
          chunkScheduler: options.chunkScheduler
        },
        async (signal, requestAttempt) => await dispatchTtsProviderRequest(options.requestEvidence, {
          chunkIndex,
          endpointKind: 'generate-content-audio',
          serializerVersion: 'gemini.tts.phase-0-v1',
          serializedRequest: { model: options.model, contents: chunk, generationConfig },
          providerText: chunk,
          voiceField: registry ? 'speechConfig.multiSpeakerVoiceConfig' : 'speechConfig.voiceConfig',
          voices: speakerVoiceConfigs
            ? speakerVoiceConfigs.map((entry) => ({ kind: 'provider-id' as const, value: entry.voiceConfig.prebuiltVoiceConfig.voiceName, speaker: entry.speaker }))
            : [{ kind: 'provider-id' as const, value: voiceId as string }],
          requestControls: {
            responseModalities: generationConfig.responseModalities,
            ...(options.languageCode ? { languageCode: options.languageCode } : {})
          },
          continuation: { kind: 'none' }
        }, requestAttempt, async () => await geminiGenerateContent(apiKey, {
            model: options.model,
            contents: chunk,
            generationConfig,
            abortSignal: signal
          }))
      )

      const pathsForChunk: string[] = []
      const parts = response.candidates?.[0]?.content?.parts ?? []
      let audioPartIndex = 0
      for (const part of parts) {
        const inlineData = part.inlineData
        if (!inlineData || part.thought === true) {
          continue
        }

        const data = inlineData.data
        if (!data) {
          continue
        }

        audioPartIndex += 1
        const info = parseGeminiInlineAudioInfo(inlineData.mimeType)
        const fileIndex = `${String(chunkIndex).padStart(3, '0')}-${String(audioPartIndex).padStart(3, '0')}`
        const rawPath = `${outputDir}/speech-gemini-raw-${fileIndex}.${info.ext}`
        const wavChunkPath = `${outputDir}/speech-gemini-chunk-${fileIndex}.wav`
        const rawBytes = Buffer.from(data, 'base64')
        if (rawBytes.byteLength === 0) {
          continue
        }
        await Bun.write(rawPath, rawBytes)
        rawPaths.push(rawPath)

        const ffmpegArgs = info.isRawPcm
          ? [
              '-f', 's16le',
              '-ar', String(info.sampleRate),
              '-ac', '1',
              '-i', rawPath,
              '-ar', '16000',
              '-ac', '1',
              '-c:a', 'pcm_s16le',
              '-y',
              wavChunkPath
            ]
          : [
              '-i', rawPath,
              '-ar', '16000',
              '-ac', '1',
              '-c:a', 'pcm_s16le',
              '-y',
              wavChunkPath
            ]

        const ffmpeg = await exec(getFfmpegBinary(), ffmpegArgs, { signal: options.abortSignal })
        if (ffmpeg.exitCode !== 0) {
          throw InfraError(`Failed to convert Gemini audio chunk to WAV: ${ffmpeg.stderr.trim()}`, { stage: 'tts:gemini' })
        }

        await Bun.$`rm -f ${rawPath}`.quiet().nothrow()
        pathsForChunk.push(wavChunkPath)
        chunkPaths.push(wavChunkPath)
        await options.requestEvidence?.recordOutput({ chunkIndex, outputIndex: audioPartIndex, path: wavChunkPath })
      }
      if (pathsForChunk.length > 0) await options.requestEvidence?.complete({ chunkIndex })
      return pathsForChunk
    }, { provider: 'gemini', scheduler: options.chunkScheduler, abortSignal: options.abortSignal })
    const orderedChunkPaths = chunkPathGroups.flat()

    if (orderedChunkPaths.length === 0) {
      throw InfraError('Gemini TTS returned no audio data', { stage: 'tts:gemini' })
    }

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'Gemini', options.abortSignal)
    return finalizeTtsRun({
      service: 'gemini',
      model: options.model,
      speaker: speakerSummary,
      audioPath,
      chunkCount: orderedChunkPaths.length,
      startTime
    })
  } finally {
    for (const rawPath of rawPaths) {
      await Bun.$`rm -f ${rawPath}`.quiet().nothrow()
    }
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
