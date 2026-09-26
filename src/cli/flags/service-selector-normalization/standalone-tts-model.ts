import type { SelectorNormalizationResult } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { readSelectedTtsProviders } from './generic-tts-option-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './provider-targets'

export const normalizeStandaloneTtsModel = (selection: SelectorNormalizationResult): SelectorNormalizationResult => {
  const rawModel = selection.flags['model']
  if (rawModel === undefined) return selection
  if (typeof rawModel !== 'string' || !rawModel.trim()) throw UsageError('--model requires a non-empty TTS model selector.')
  const providers = readSelectedTtsProviders(selection.flags)
  if (providers.length !== 1 || selection.flags['all-tts'] === true) throw UsageError('TTS --model requires exactly one selected --provider. Use --provider provider=model for multiple providers.')
  const target = STANDALONE_TTS_PROVIDER_TARGETS[providers[0] as keyof typeof STANDALONE_TTS_PROVIDER_TARGETS]
  const model = rawModel.trim()
  const conflicting = selection.flagOccurrences.some(occurrence => occurrence.name === target && typeof occurrence.value === 'string' && occurrence.value !== model)
  if (conflicting) throw UsageError('TTS --model conflicts with the model in --provider. Specify the model once or use matching selectors.')
  const flags = { ...selection.flags, [target]: model }
  delete flags['model']
  const explicitFlags = new Set(selection.explicitFlags)
  explicitFlags.delete('model'); explicitFlags.add(target)
  return {
    flags, explicitFlags,
    flagOccurrences: [
      ...selection.flagOccurrences.filter(occurrence => occurrence.name !== 'model' && occurrence.name !== target),
      { name: target, raw: '--model', value: model, known: true },
    ],
  }
}
