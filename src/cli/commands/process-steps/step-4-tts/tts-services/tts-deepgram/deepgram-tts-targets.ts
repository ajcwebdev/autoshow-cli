import type { DeepgramTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureDeepgramTtsSetup } from './deepgram-tts'
import { runDeepgramTts } from './run-deepgram-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { createMediaTargetCollector } from '~/cli/commands/process-steps/media-target-collector'

export const collectDeepgramTtsTargets: (selection: TtsTargetSelection) => TtsTarget[] = createMediaTargetCollector<
  TtsTargetSelection,
  string,
  DeepgramTtsModel,
  'deepgram',
  Parameters<TtsTarget['run']>,
  Awaited<ReturnType<TtsTarget['run']>>,
  { voice?: string }
>({
  service: 'deepgram',
  readModels: (selection: TtsTargetSelection) => selection.deepgramModels,
  validateModel: (rawModel): DeepgramTtsModel => validateDeepgramTtsModel(rawModel),
  targetFields: selection => {
    const voiceId = selection.deepgramVoiceId ? validateDeepgramTtsVoice(selection.deepgramVoiceId) : undefined
    return voiceId ? { voice: voiceId } : {}
  },
  ensureSetup: ensureDeepgramTtsSetup,
  run: async (selection, model, fields, ...[text, outputDir, opts, invocation, requestEvidence]: Parameters<TtsTarget['run']>) => {
    const invocationVoiceId = resolveTtsTargetInvocationVoiceId('deepgram', invocation)
    const controls = resolveTtsTargetInvocationControls('deepgram', invocation, { speed: selection.deepgramSpeed })
    return await runDeepgramTts(text, outputDir, {
      model,
      voiceId: invocationVoiceId ?? fields.voice,
      speed: controls.speed,
      chunkConcurrency: opts.ttsChunkConcurrency,
      chunkScheduler: opts.hostedTtsChunkScheduler,
      abortSignal: invocation?.signal,
      requestEvidence
    })
  }
})
