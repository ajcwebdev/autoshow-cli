import type { TtsOptions, TtsTargetSelection } from '~/types'
import { validateMultiSpeakerTtsSelection } from './tts-multi-speaker-target-validation'
import { validateTtsProviderOptions } from './tts-provider-option-validation'

export const validateTtsTargetSelection = (
  options: TtsOptions,
  selection: TtsTargetSelection
): void => {
  validateMultiSpeakerTtsSelection(options, selection)
  validateTtsProviderOptions(selection)
}
