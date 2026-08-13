import type { KittenTtsModel, TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateKittenTtsModel,
  validateKittenTtsSpeaker
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runKittenTts } from './run-kitten-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { TTS_CHUNK_CHARACTER_LIMITS } from '../../tts-utils/tts-chunking'
import { hasCachedKittenTtsModel } from './kitten-tts-model-cache'
import { InfraError } from '~/utils/error-handler'
import { isKittenTtsEnvironmentReady, type KittenTtsEnvironmentReadinessProbes } from './kitten-tts'

const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

export const isKittenTtsSetupReady = async (
  probes?: KittenTtsEnvironmentReadinessProbes | undefined
): Promise<boolean> => await isKittenTtsEnvironmentReady(probes)

export const assertKittenTtsExecutionReady = async (model: KittenTtsModel): Promise<void> => {
  if (!await isKittenTtsSetupReady()) {
    throw InfraError('Kitten TTS is not set up. Run `bun autoshow setup --step tts` before synthesis.', {
      stage: 'tts:kitten',
      hints: ['Run `bun autoshow setup --step tts` to install the local Kitten TTS runtime.']
    })
  }
  if (!await hasCachedKittenTtsModel(model)) {
    throw InfraError(`Kitten TTS model ${model} is not cached. Run \`bun autoshow setup --step tts\` before synthesis.`, {
      stage: 'tts:kitten',
      hints: [`Run \`bun autoshow setup --step tts\` to cache ${model} before the admitted render.`]
    })
  }
}

export const collectKittenTtsTargets = (
  options: TtsOptions,
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.kittenModels) {
    const model: KittenTtsModel = validateKittenTtsModel(rawModel)
    const rawSpeaker = options.ttsSpeaker ?? DEFAULT_KITTEN_TTS_SPEAKER
    const speaker = validateKittenTtsSpeaker(rawSpeaker)

    targets.push({
      service: 'kitten',
      model,
      voice: speaker,
      run: async (text, outputDir, _opts, invocation, requestEvidence) => {
        invocation?.signal?.throwIfAborted()
        const invocationSpeaker = resolveTtsTargetInvocationVoiceId('kitten', invocation)
        const controls = resolveTtsTargetInvocationControls('kitten', invocation, {
          maxChunkChars: TTS_CHUNK_CHARACTER_LIMITS.kitten,
        })
        const runtimeSpeaker = invocationSpeaker
          ? validateKittenTtsSpeaker(invocationSpeaker)
          : speaker
        await assertKittenTtsExecutionReady(model)
        invocation?.signal?.throwIfAborted()
        return await runKittenTts(text, outputDir, {
          model,
          speaker: runtimeSpeaker,
          maxChunkChars: controls.maxChunkChars,
          abortSignal: invocation?.signal,
          requestEvidence
        })
      }
    })
  }
  return targets
}
