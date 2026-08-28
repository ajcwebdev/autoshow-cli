import { isRecord } from '~/utils/rest-client'
import { extname } from 'node:path'
import { concatAndConvertToWav, convertAudioToWav, requireHostedTtsChunkScheduler, runTtsChunks, splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import type { HostedTtsChunkScheduler, MistralReferenceAudio, MistralTtsModel, MistralVoiceSource, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { resolveCredential } from '~/utils/validate/env-utils'
import { UsageError, InfraError, InternalError, ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { sha256Bytes } from '../../script-to-audio/contract-identity'

const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const MISTRAL_REF_AUDIO_DIRECT_EXTENSIONS = new Set(['.mp3', '.mpeg', '.mpga', '.wav', '.wave'])


const readStringField = (payload: unknown, field: string, label: string): string => {
  if (isRecord(payload) && typeof payload[field] === 'string') {
    return payload[field]
  }
  throw ValidationError(`${label} returned an invalid response: missing ${field}`, { stage: 'tts:mistral' })
}

const decodeMistralAudioData = (audioData: string): Uint8Array => {
  const cleaned = audioData.includes(',')
    ? audioData.slice(audioData.indexOf(',') + 1)
    : audioData
  return new Uint8Array(Buffer.from(cleaned, 'base64'))
}

const resolveVoiceSource = (
  options: {
    voiceId?: string | undefined
    refAudioPath?: string | undefined
    protectedReference?: { assetId: string, sourceExtension: string } | undefined
  }
): MistralVoiceSource => {
  const optionVoice = options.voiceId?.trim()
  const optionRefAudio = options.refAudioPath?.trim()
  if (optionVoice && optionRefAudio) {
    throw UsageError('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
  }
  if (optionVoice) {
    return { kind: 'voice', value: optionVoice, speaker: optionVoice }
  }
  if (optionRefAudio) {
    if (!options.protectedReference) {
      throw UsageError(
        'Mistral reference audio must resolve from an opaque protected asset immediately before synthesis.',
        'Use the standalone `tts` request-reference edge, or create/import a voice with the shared `voice` command or `comic reference-voice`.'
      )
    }
    return {
      kind: 'refAudio',
      path: optionRefAudio,
      speaker: `ref_audio:${options.protectedReference.assetId}`
    }
  }

  throw UsageError('Mistral TTS requires a saved voice ID or reference audio. Use --mistral-tts-voice or --mistral-tts-ref-audio.')
}

const readAudioBase64 = async (
  path: string,
  displayLabel = path
): Promise<string> => {
  const file = Bun.file(path)
  if (!await file.exists()) {
    throw InfraError(`Mistral TTS reference audio not found: ${displayLabel}`, { stage: 'tts:mistral' })
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw InfraError(`Mistral TTS reference audio is empty: ${displayLabel}`, { stage: 'tts:mistral' })
  }

  return Buffer.from(bytes).toString('base64')
}

const prepareReferenceAudio = async (
  path: string,
  outputDir: string,
  protectedReference?: { assetId: string, sourceExtension: string } | undefined,
  abortSignal?: AbortSignal | undefined
): Promise<MistralReferenceAudio> => {
  abortSignal?.throwIfAborted()
  const ext = protectedReference?.sourceExtension || extname(path).toLowerCase()
  const displayLabel = protectedReference
    ? `protected reference asset ${protectedReference.assetId}`
    : path
  if (MISTRAL_REF_AUDIO_DIRECT_EXTENSIONS.has(ext)) {
    return {
      base64: await readAudioBase64(path, displayLabel),
      uploadPath: path
    }
  }

  const convertedPath = `${outputDir}/mistral-reference-audio.wav`
  await readAudioBase64(path, displayLabel)
  try {
    await convertAudioToWav(path, convertedPath, 'Mistral', 'reference audio', abortSignal)
  } catch (error) {
    if (!protectedReference) throw error
    throw InfraError('Failed to convert protected Mistral reference audio to WAV.', {
      stage: 'tts:mistral',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }

  return {
    base64: await readAudioBase64(convertedPath),
    uploadPath: convertedPath,
    convertedPath
  }
}

export const runMistralTts = async (
  text: string,
  outputDir: string,
  options: {
    model: MistralTtsModel
    voiceId?: string | undefined
    refAudioPath?: string | undefined
    responseFormat?: 'wav' | 'mp3' | 'flac' | 'opus' | undefined
    protectedReference?: { assetId: string, sourceExtension: string } | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    baseUrl?: string | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voiceSource = resolveVoiceSource(options)
  const apiKey = resolveCredential('mistral', 'require', { stage: 'tts:mistral', description: 'Mistral TTS' })

  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.mistral)
  if (chunks.length === 0) {
    throw ValidationError('Mistral TTS input text is empty', { stage: 'tts:mistral' })
  }
  const responseFormat = options.responseFormat ?? 'wav'

  options.abortSignal?.throwIfAborted()
  const referenceAudio = voiceSource.kind === 'refAudio'
    ? await prepareReferenceAudio(
        voiceSource.path,
        outputDir,
        options.protectedReference,
        options.abortSignal
      )
    : undefined
    const baseURL = options.baseUrl ?? MISTRAL_DEFAULT_BASE_URL
    let speechVoiceInput: { voice_id: string } | { ref_audio: string }
    if (voiceSource.kind === 'voice') {
      speechVoiceInput = { voice_id: voiceSource.value }
    } else {
      if (!referenceAudio) {
        throw InternalError('Mistral TTS reference audio preparation failed', { stage: 'tts:mistral' })
      }
      speechVoiceInput = { ref_audio: referenceAudio.base64 }
    }

    logTtsConfig('Mistral', [
      { label: 'model', value: options.model },
      {
        label: voiceSource.kind === 'voice' ? 'voice' : 'reference audio',
        value: voiceSource.kind === 'voice'
          ? voiceSource.value
          : options.protectedReference
            ? `protected reference asset ${options.protectedReference.assetId}`
            : voiceSource.path
      },
      {
        label: 'reference conversion',
        value: referenceAudio?.convertedPath && options.protectedReference
          ? `protected reference asset ${options.protectedReference.assetId}`
          : undefined
      },
      { label: 'response format', value: responseFormat },
      { label: 'chunk count', value: chunks.length }
    ])

    const startTime = Date.now()
    const chunkPaths: string[] = []
    let completed = false

    try {
      const orderedChunkPaths = await runTtsChunks(chunks, async (chunk, index, admission) => {
        const chunkIndex = index + 1
        const chunkPath = `${outputDir}/speech-mistral-chunk-${String(chunkIndex).padStart(3, '0')}.${responseFormat}`
        const response = await withHostedTtsRetry(
          {
            operationName: `mistral-tts-chunk-${chunkIndex}`,
            abortSignal: options.abortSignal,
            admission,
            chunkScheduler: options.chunkScheduler
          },
          async (signal, requestAttempt) => {
            const observedVoiceId = voiceSource.kind === 'voice' ? voiceSource.value : undefined
            const requestBody = {
              model: options.model,
              input: chunk,
              stream: false,
              response_format: responseFormat,
              ...speechVoiceInput
            }
            return await dispatchTtsProviderRequest(options.requestEvidence, {
              chunkIndex,
              endpointKind: 'speech-synthesis',
              serializerVersion: 'mistral.tts.phase-0-v1',
              serializedRequest: { path: '/audio/speech', body: requestBody },
              providerText: chunk,
              voiceField: voiceSource.kind === 'voice' ? 'voice_id' : 'ref_audio',
              voices: observedVoiceId
                ? [{ kind: 'provider-id', value: observedVoiceId }]
                : [{ kind: 'reference-asset', valueHash: sha256Bytes(Buffer.from(referenceAudio?.base64 ?? '', 'base64')) }],
              requestControls: { stream: false, responseFormat },
              continuation: { kind: 'none' }
            }, requestAttempt, async () => await mistralJsonRequest({
              apiKey,
              baseURL,
              path: '/audio/speech',
              signal,
              timeoutMs: REQUEST_TIMEOUT_MS,
              errorMessagePrefix: 'Mistral TTS failed',
              body: requestBody
            }))
          }
        )
        const audioData = readStringField(response, 'audio_data', 'Mistral TTS')

        const audioBytes = decodeMistralAudioData(audioData)
        if (audioBytes.byteLength === 0) {
          throw InfraError(`Mistral TTS returned empty audio for chunk ${chunkIndex}`, { stage: 'tts:mistral' })
        }
        await Bun.write(chunkPath, audioBytes)
        await options.requestEvidence?.recordOutput({ chunkIndex, path: chunkPath })
        await options.requestEvidence?.complete({ chunkIndex })
        chunkPaths.push(chunkPath)
        return chunkPath
      }, { provider: 'mistral', scheduler: requireHostedTtsChunkScheduler(options.chunkScheduler), abortSignal: options.abortSignal })

      const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'Mistral', options.abortSignal)
      const result = finalizeTtsRun({
        service: 'mistral',
        model: options.model,
        speaker: voiceSource.speaker,
        audioPath,
        chunkCount: chunks.length,
        startTime
      })
      completed = true
      return result
    } finally {
      if (completed) {
        for (const chunkPath of chunkPaths) {
          await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
        }
        if (referenceAudio?.convertedPath) {
          await Bun.$`rm -f ${referenceAudio.convertedPath}`.quiet().nothrow()
        }
      }
    }
}
