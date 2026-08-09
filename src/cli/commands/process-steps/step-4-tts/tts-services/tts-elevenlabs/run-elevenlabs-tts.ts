import { readElevenLabsError } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-utils'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { ELEVENLABS_DEFAULT_VOICE_ID } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { ElevenLabsTtsIvcOptions, ElevenlabsTtsModel, ElevenLabsTtsRequestControls, ElevenLabsTtsVoiceSettings, HostedTtsChunkScheduler, Step4Metadata } from '~/types'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'
import { ValidationError } from '~/utils/error-handler'
import { ensureElevenLabsTtsIvcVoice } from './elevenlabs-ivc'
import { httpResponseError } from '~/utils/rest-client'

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
  const apiKey = requireApiKey('ELEVENLABS_API_KEY', 'tts:elevenlabs', 'ElevenLabs TTS')

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

  return await runHostedTtsChunkPipeline({
    provider: 'elevenlabs',
    providerLabel: 'ElevenLabs',
    model: options.model,
    speaker,
    chunks,
    outputDir,
    chunkExtension: 'mp3',
    startTime,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    ...(cloneResult ? { extraMetadata: { clonedVoiceId: cloneResult.voiceId, cloneCostCents: 0 } } : {}),
    fetchChunkAudio: async ({ chunk, signal }) => {
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
        throw httpResponseError(`ElevenLabs TTS failed (${response.status}): ${errText}`, response)
      }

      return new Uint8Array(await response.arrayBuffer())
    }
  })
}
