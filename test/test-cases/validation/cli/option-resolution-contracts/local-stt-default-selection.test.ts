import { expect, test } from 'bun:test'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'

test('bare local provider selectors keep the requested engine and use its default model', () => {
  for (const provider of ['whisper', 'whisperfile'] as const) {
    const flags = { provider: [provider] }
    const explicit = new Set(['provider'])
    const normalized = normalizeExtractGenericSelectorFlags(flags, explicit, flagOccurrencesFromValues(flags, explicit), { media: true, document: false, article: false })
    const options = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags)
    expect(options.step2SelectionOrigins?.[`${provider}-stt`]).toBe('explicit')
    expect(collectSttTargets(options).map(target => ({ service: target.service, model: target.model }))).toEqual([{ service: provider, model: 'tiny' }])
  }
})
