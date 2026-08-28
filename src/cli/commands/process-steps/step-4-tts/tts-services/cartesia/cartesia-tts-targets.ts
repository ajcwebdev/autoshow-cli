import type { CartesiaTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateCartesiaTtsModel,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureCartesiaTtsSetup } from './cartesia-tts'
import { runCartesiaTts } from './run-cartesia-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { createMediaTargetCollector } from '~/cli/commands/process-steps/media-target-collector'

export const collectCartesiaTtsTargets: (selection: TtsTargetSelection) => TtsTarget[] = createMediaTargetCollector<
  TtsTargetSelection,
  string,
  CartesiaTtsModel,
  'cartesia',
  Parameters<TtsTarget['run']>,
  Awaited<ReturnType<TtsTarget['run']>>,
  { voice?: string }
>({
  service: 'cartesia',
  readModels: (selection: TtsTargetSelection) => selection.cartesiaModels,
  validateModel: (rawModel): CartesiaTtsModel => validateCartesiaTtsModel(rawModel),
  targetFields: selection => {
    const voiceId = selection.cartesiaVoiceId ? validateCartesiaTtsVoice(selection.cartesiaVoiceId) : undefined
    return voiceId ? { voice: voiceId } : {}
  },
  ensureSetup: ensureCartesiaTtsSetup,
  run: async (selection, model, fields, ...[text, outputDir, opts, invocation, requestEvidence]: Parameters<TtsTarget['run']>) => {
    const invocationVoiceId = resolveTtsTargetInvocationVoiceId('cartesia', invocation)
    const controls = resolveTtsTargetInvocationControls('cartesia', invocation, { language: selection.cartesiaLanguage })
    return await runCartesiaTts(text, outputDir, {
      model,
      voiceId: invocationVoiceId ?? fields.voice,
      language: controls.language,
      chunkConcurrency: opts.ttsChunkConcurrency,
      chunkScheduler: opts.hostedTtsChunkScheduler,
      abortSignal: invocation?.signal,
      requestEvidence
    })
  }
})
