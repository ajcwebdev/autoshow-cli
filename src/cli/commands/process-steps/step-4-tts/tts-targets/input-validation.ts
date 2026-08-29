import type { TtsOptions } from '~/types'
import { isMultiSpeakerRequested, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../dialogue-normalizer'

export const validateTtsInput = (text: string, options: TtsOptions): void => {
  if (!isMultiSpeakerRequested(options)) {
    return
  }

  const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
  normalizeDialogueText(text, resolveDialogueFormat(options), registry)
}
