import type { FishTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { concatAndConvertToWav } from '../../tts-utils/audio-utils'
import { finalizeTtsRun } from '../../tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '../../tts-utils/hosted-tts-retry'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import {
  FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
  FISH_S2_PRO_MODEL,
  isFishNativeDialogueModel,
  normalizeFishNativeDialogueTiming,
  planFishNativeDialogueBatches,
  type FishNativeDialogueTurn,
} from './fish-tts-request'

export const runFishNativeDialogue = async (
  turns: readonly FishNativeDialogueTurn[],
  outputDir: string,
  options: {
    model: FishTtsModel
    apiKey: string
    latency?: 'normal' | 'balanced' | 'low' | undefined
    abortSignal?: AbortSignal | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!isFishNativeDialogueModel(options.model)) throw CLIUsageError('Fish native dialogue requires model s2-pro.')
  if (turns.length === 0) throw CLIUsageError('Fish native dialogue requires at least one turn.')
  const batches = planFishNativeDialogueBatches(turns)
  const client = createFishClient({ apiKey: options.apiKey })
  const paths: string[] = []
  let completed = false
  const startedAt = Date.now()
  try {
    for (const [batchIndex, batch] of batches.entries()) {
      options.abortSignal?.throwIfAborted()
      const chunkIndex = batchIndex + 1
      const requestBody = {
        text: batch.providerText,
        reference_id: batch.referenceIds,
        format: 'wav' as const,
        ...(options.latency ? { latency: options.latency } : {}),
      }
      const result = await withHostedTtsRetry({ operationName: `fish-dialogue-${chunkIndex}`, abortSignal: options.abortSignal }, async (signal, attempt) => await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'text-to-speech-stream-with-timestamps',
        serializerVersion: FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION,
        serializedRequest: { path: '/v1/tts/stream/with-timestamp', body: requestBody },
        providerText: batch.providerText,
        voiceField: 'reference_id[]',
        voices: batch.turns.map(turn => ({ kind: 'provider-id', value: turn.voiceId, speaker: turn.speaker })),
        requestControls: { format: 'wav', model: FISH_S2_PRO_MODEL, ...(options.latency ? { latency: options.latency } : {}) },
        continuation: { kind: 'none' },
      }, attempt, async ({ accepted }) => {
        return await client.synthesizeTtsWithTimestamps({
          ...requestBody,
          model: FISH_S2_PRO_MODEL,
        }, {
          signal,
          onAccepted: async (response) => {
            await accepted({
              providerRequestId: response.headers.get('x-request-id') ?? undefined,
              fields: { httpStatus: response.status },
            })
          },
        })
      }))
      const bytes = new Uint8Array(result.audioBuffer)
      const path = `${outputDir}/speech-fish-dialogue-${String(chunkIndex).padStart(3, '0')}.wav`
      await Bun.write(path, bytes)
      const timing = normalizeFishNativeDialogueTiming({ timeline: result.timeline, turns: batch.turns })
      await options.requestEvidence?.recordOutput({ chunkIndex, path, timing })
      await options.requestEvidence?.complete({ chunkIndex })
      paths.push(path)
    }
    const audioPath = await concatAndConvertToWav(paths, outputDir, 'Fish-dialogue', options.abortSignal)
    const finalized = finalizeTtsRun({ service: 'fish', model: options.model, speaker: [...new Set(turns.map(turn => turn.voiceId))].join(','), audioPath, chunkCount: batches.length, startTime: startedAt })
    completed = true
    return finalized
  } finally {
    if (completed) for (const path of paths) await Bun.$`rm -f ${path}`.quiet().nothrow()
  }
}
