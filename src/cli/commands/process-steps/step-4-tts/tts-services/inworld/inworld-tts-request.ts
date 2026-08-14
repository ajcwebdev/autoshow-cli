import type { InworldTtsModel } from '~/types'

export const INWORLD_TTS_SERIALIZER_VERSION = 'inworld.tts.phase-3-v2'

export const resolveInworldTtsApiModelId = (model: InworldTtsModel): string => {
  switch (model) {
    case 'realtime-tts-2': return 'inworld-tts-2'
    case 'realtime-tts-2-flash': return 'inworld-tts-2-flash'
  }
}

export const buildInworldTtsRequestBody = (input: Readonly<{
  model: InworldTtsModel
  text: string
  voiceId: string
  steeringPrompt?: string | undefined
  markups: readonly string[]
}>): Readonly<Record<string, unknown>> => ({
  text: input.text,
  voiceId: input.voiceId,
  modelId: resolveInworldTtsApiModelId(input.model),
  ...(input.steeringPrompt ? { steering_prompt: input.steeringPrompt } : {}),
  ...(input.markups.length > 0 ? { markups: input.markups } : {})
})
