import { readElevenLabsError } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-utils'
import { concatAndConvertToWav, runTtsChunks, splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { ELEVENLABS_DEFAULT_VOICE_ID } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { ElevenLabsTtsIvcOptions, ElevenlabsTtsModel, ElevenLabsTtsRequestControls, ElevenLabsTtsVoiceSettings, HostedTtsChunkScheduler, Step4Metadata } from '~/types'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'
import { ensureElevenLabsTtsIvcVoice } from './elevenlabs-ivc'

const parsePronunciationDictionaryLocator = (
  value: string
): { pronunciation_dictionary_id: string, version_id?: string | undefined } => {
  const [rawId, rawVersion] = value.split(':', 2)
  const id = rawId?.trim()
  const version = rawVersion?.trim()
  if (!id) {
    throw ValidationError('Invalid --elevenlabs-tts-pronunciation-dictionary-locator value. Expected dictionary_id or dictionary_id:version_id.', { stage: 'tts:elevenlabs' })
  }
  return {
    pronunciation_dictionary_id: id,
    ...(version ? { version_id: version } : {})
  }
}

const hasVoiceSettings = (settings: ElevenLabsTtsVoiceSettings | undefined): settings is ElevenLabsTtsVoiceSettings =>
  Boolean(settings && Object.values(settings).some((value) => value !== undefined))

export const runElevenLabsTts = async (
  text: string,
  outputDir: string,
  options: {
    model: ElevenlabsTtsModel
    voiceId?: string | undefined
    clone?: ElevenLabsTtsIvcOptions | undefined
    controls?: ElevenLabsTtsRequestControls | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw InternalError('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS', { stage: 'tts:elevenlabs', hints: hintsForMissingEnv('ELEVENLABS_API_KEY') })
  }

  const baseURL = ELEVENLABS_DEFAULT_BASE_URL
  const chunks = splitTextIntoChunks(text, resolveTtsChunkCharacterLimit('elevenlabs', options.model) ?? 2000)
  if (chunks.length === 0) {
    throw ValidationError('ElevenLabs TTS input text is empty', { stage: 'tts:elevenlabs' })
  }

  const startTime = Date.now()
  const cloneResult = options.clone
    ? await ensureElevenLabsTtsIvcVoice(baseURL, apiKey, options.clone)
    : undefined
  const voiceId = cloneResult?.voiceId ?? options.voiceId?.trim() ?? ELEVENLABS_DEFAULT_VOICE_ID
  const outputFormat = options.controls?.outputFormat?.trim() || 'mp3_44100_128'
  const languageCode = options.controls?.languageCode?.trim() || undefined
  const pronunciationDictionaryLocators = options.controls?.pronunciationDictionaryLocators
    ?.map((item) => item.trim())
    .filter(Boolean)
    .map(parsePronunciationDictionaryLocator)
  const speaker = cloneResult
    ? `ref_audio:${cloneResult.sourceAudio.basename}`
    : voiceId

  logTtsConfig('ElevenLabs', [
    { label: 'model', value: options.model },
    {
      label: cloneResult ? 'reference audio' : 'voice',
      value: cloneResult ? cloneResult.sourceAudio.basename : voiceId
    },
    { label: 'output format', value: outputFormat },
    { label: 'language', value: languageCode },
    ...(cloneResult ? [{ label: 'cloned voice_id', value: cloneResult.voiceId }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-elevenlabs-chunk-${String(chunkIndex).padStart(3, '0')}.mp3`
      const audioBytes = await withHostedTtsRetry(
        {
          operationName: `elevenlabs-tts-chunk-${chunkIndex}`,
          ttsProvider: 'elevenlabs',
          chunkScheduler: options.chunkScheduler
        },
        async (signal) => {
          const params = new URLSearchParams({ output_format: outputFormat })
          if (typeof options.controls?.optimizeStreamingLatency === 'number') {
            params.set('optimize_streaming_latency', String(options.controls.optimizeStreamingLatency))
          }
          const voiceSettings = options.controls?.voiceSettings
          const requestBody = {
            text: chunk,
            model_id: options.model,
            ...(languageCode ? { language_code: languageCode } : {}),
            ...(hasVoiceSettings(voiceSettings) ? { voice_settings: voiceSettings } : {}),
            ...(typeof options.controls?.seed === 'number' ? { seed: options.controls.seed } : {}),
            ...(options.controls?.textNormalization ? { apply_text_normalization: options.controls.textNormalization } : {}),
            ...(pronunciationDictionaryLocators && pronunciationDictionaryLocators.length > 0
              ? { pronunciation_dictionary_locators: pronunciationDictionaryLocators }
              : {}),
          }
          const response = await fetch(`${baseURL}/text-to-speech/${encodeURIComponent(voiceId)}?${params.toString()}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg'
            },
            body: JSON.stringify(requestBody),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readElevenLabsError(response)
            const err = new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          return new Uint8Array(await response.arrayBuffer())
        }
      )
      if (audioBytes.byteLength === 0) {
        throw InfraError('ElevenLabs TTS returned empty audio', { stage: 'tts:elevenlabs' })
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    }, { provider: 'elevenlabs', scheduler: options.chunkScheduler })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'ElevenLabs')
    const result = finalizeTtsRun({
      service: 'elevenlabs',
      model: options.model,
      speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...(cloneResult ? { clonedVoiceId: cloneResult.voiceId, cloneCostCents: 0 } : {})
      }
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
