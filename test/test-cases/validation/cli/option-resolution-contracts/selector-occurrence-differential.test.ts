import { describe, expect, test } from 'bun:test'
import { parseCommandArgv } from '~/cli/native/native-parser'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { BOOLEAN_PROVIDER_TARGETS, STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { normalizeWriteStepSelectorFlags, writeSelectorTargetsByFlag } from '~/cli/flags/service-selector-normalization/write-step-selectors'
import type { CliCommandDefinition } from '~/types'

type SelectorCase = {
  args: string[]
  selectorFlag: string
  target: string
  expectedValue: string | true
  normalize: 'generic' | 'write'
  targets: Record<string, string>
}

const selectorCommand = (selectorFlag: string): CliCommandDefinition => ({
  name: 'probe',
  description: 'selector occurrence differential probe',
  flags: {
    [selectorFlag]: {
      description: 'provider selector',
      type: [String]
    }
  },
  handler: () => {}
})

const selectorCases = (): SelectorCase[] => {
  const cases: SelectorCase[] = []
  const addCases = (
    normalize: SelectorCase['normalize'],
    selectorFlag: string,
    targets: Record<string, string>
  ): void => {
    for (const [provider, target] of Object.entries(targets)) {
      const values: Array<{ args: string[], expectedValue: string | true }> = [
        { args: [`--${selectorFlag}`, provider], expectedValue: true },
        { args: [`--${selectorFlag}=${provider}`], expectedValue: true }
      ]
      if (!BOOLEAN_PROVIDER_TARGETS.has(target)) {
        values.push(
          { args: [`--${selectorFlag}`, `${provider}=model-for-${provider}`], expectedValue: `model-for-${provider}` },
          { args: [`--${selectorFlag}=${provider}=model-for-${provider}`], expectedValue: `model-for-${provider}` }
        )
      }
      for (const value of values) {
        cases.push({ ...value, normalize, selectorFlag, target, targets })
      }
    }
  }

  addCases('generic', 'provider', STANDALONE_TTS_PROVIDER_TARGETS)
  addCases('generic', 'provider', STANDALONE_IMAGE_PROVIDER_TARGETS)
  addCases('generic', 'provider', STANDALONE_VIDEO_PROVIDER_TARGETS)
  addCases('generic', 'provider', STANDALONE_MUSIC_PROVIDER_TARGETS)
  addCases('write', 'stt', WRITE_STT_PROVIDER_TARGETS)
  addCases('write', 'ocr', WRITE_OCR_PROVIDER_TARGETS)
  addCases('write', 'llm', WRITE_LLM_PROVIDER_TARGETS)
  addCases('write', 'tts', writeSelectorTargetsByFlag.tts)
  addCases('write', 'image', writeSelectorTargetsByFlag.image)
  addCases('write', 'video', writeSelectorTargetsByFlag.video)
  addCases('write', 'music', writeSelectorTargetsByFlag.music)
  return cases
}

describe('selector occurrence differential', () => {
  test('preserves the flag-map and ordered-argv projections for 400+ selector spellings', () => {
    const cases = selectorCases()
    expect(cases.length).toBeGreaterThanOrEqual(400)

    for (const entry of cases) {
      const argv = ['probe', ...entry.args]
      const parsed = parseCommandArgv(argv, selectorCommand(entry.selectorFlag), {})
      const normalized = entry.normalize === 'generic'
        ? normalizeGenericProviderSelectorFlags(
            parsed.flags,
            parsed.rawParsed.explicitFlags,
            parsed.rawParsed.flagOccurrences,
            entry.selectorFlag,
            entry.targets
          )
        : normalizeWriteStepSelectorFlags(parsed.flags, parsed.rawParsed.explicitFlags, parsed.rawParsed.flagOccurrences)

      expect(normalized.flags[entry.target], argv.join(' ')).toEqual(entry.expectedValue)
      expect(normalized.explicitFlags.has(entry.selectorFlag), argv.join(' ')).toBe(false)
      expect(normalized.explicitFlags.has(entry.target), argv.join(' ')).toBe(true)
      expect(normalized.flagOccurrences, argv.join(' ')).toEqual([{
        name: entry.target,
        raw: entry.args[0] as string,
        value: entry.expectedValue,
        known: true
      }])
    }
  })
})
