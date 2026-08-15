import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from './provider-targets'
import { STEP2_OCR_PROVIDER_REGISTRY } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/ocr-providers'
import { STEP2_STT_PROVIDER_REGISTRY } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/stt-providers'

type ModelFlag<Registry extends readonly { flagName: string, selection: { type: string } }[]> =
  Extract<Registry[number], { selection: { type: 'models' } }>['flagName']

const projectModelFlags = <
  const Registry extends readonly { flagName: string, selection: { type: string } }[]
>(
  registry: Registry,
  orderedFlags: readonly string[]
): Array<ModelFlag<Registry>> => {
  const registryModelFlags = new Set(
    registry
      .filter((entry) => entry.selection.type === 'models')
      .map((entry) => entry.flagName)
  )
  return orderedFlags.filter((flag) => registryModelFlags.has(flag)) as Array<ModelFlag<Registry>>
}

const targetValues = <const Targets extends Readonly<Record<string, string>>>(
  targets: Targets
): Array<Targets[keyof Targets]> => Object.values(targets) as Array<Targets[keyof Targets]>

const STT_MODEL_FLAG_ORDER = [
  WRITE_STT_PROVIDER_TARGETS.whisper,
  WRITE_STT_PROVIDER_TARGETS.whisperfile,
  WRITE_STT_PROVIDER_TARGETS.deepinfra,
  WRITE_STT_PROVIDER_TARGETS.groq,
  WRITE_STT_PROVIDER_TARGETS.grok,
  WRITE_STT_PROVIDER_TARGETS.deepgram,
  WRITE_STT_PROVIDER_TARGETS.soniox,
  WRITE_STT_PROVIDER_TARGETS.speechmatics,
  WRITE_STT_PROVIDER_TARGETS.rev,
  WRITE_STT_PROVIDER_TARGETS.mistral,
  WRITE_STT_PROVIDER_TARGETS.assemblyai,
  WRITE_STT_PROVIDER_TARGETS.gladia,
  WRITE_STT_PROVIDER_TARGETS.happyscribe,
  WRITE_STT_PROVIDER_TARGETS.supadata,
  WRITE_STT_PROVIDER_TARGETS.scrapecreators,
  WRITE_STT_PROVIDER_TARGETS.gemini,
  WRITE_STT_PROVIDER_TARGETS.together
] as const

const TTS_MODEL_FLAG_ORDER = [
  STANDALONE_TTS_PROVIDER_TARGETS.kitten,
  STANDALONE_TTS_PROVIDER_TARGETS.elevenlabs,
  STANDALONE_TTS_PROVIDER_TARGETS.minimax,
  STANDALONE_TTS_PROVIDER_TARGETS.groq,
  STANDALONE_TTS_PROVIDER_TARGETS.grok,
  STANDALONE_TTS_PROVIDER_TARGETS.mistral,
  STANDALONE_TTS_PROVIDER_TARGETS.openai,
  STANDALONE_TTS_PROVIDER_TARGETS.gemini,
  STANDALONE_TTS_PROVIDER_TARGETS.speechify,
  STANDALONE_TTS_PROVIDER_TARGETS.hume,
  STANDALONE_TTS_PROVIDER_TARGETS.cartesia,
  STANDALONE_TTS_PROVIDER_TARGETS.fish,
  STANDALONE_TTS_PROVIDER_TARGETS.inworld,
  STANDALONE_TTS_PROVIDER_TARGETS.deepinfra,
  STANDALONE_TTS_PROVIDER_TARGETS.replicate,
  STANDALONE_TTS_PROVIDER_TARGETS.fal,
  STANDALONE_TTS_PROVIDER_TARGETS.deepgram
] as const

export const REPEATABLE_MODEL_FLAGS = [
  ...projectModelFlags(STEP2_STT_PROVIDER_REGISTRY, STT_MODEL_FLAG_ORDER),
  ...projectModelFlags(STEP2_OCR_PROVIDER_REGISTRY, targetValues(WRITE_OCR_PROVIDER_TARGETS)),
  ...targetValues(WRITE_LLM_PROVIDER_TARGETS),
  ...TTS_MODEL_FLAG_ORDER,
  ...targetValues(STANDALONE_IMAGE_PROVIDER_TARGETS),
  ...targetValues(STANDALONE_MUSIC_PROVIDER_TARGETS),
  ...targetValues(STANDALONE_VIDEO_PROVIDER_TARGETS)
] as const

export type RepeatableModelFlag = typeof REPEATABLE_MODEL_FLAGS[number]
