import { describe, expect, test } from 'bun:test'
import {
  describeModelSelector,
  formatModelSelector,
  getModelValidatorFlags
} from '~/cli/commands/setup-and-utilities/models/model-validation'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from '~/cli/flags/service-selector-normalization/extract-selectors'
import {
  validateWhisperModel,
  validateWhisperfileModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

const WRITE_STT_EXTRACT_EXCLUSIONS = new Set<string>([])

describe('model validation selector contracts', () => {
  test('every model validator key derives a public selector', () => {
    const underivable = getModelValidatorFlags()
      .filter((flag) => describeModelSelector(flag) === undefined)

    expect(underivable).toEqual([])
  })

  test('every public provider target derives its own selector', () => {
    const categories = [
      ['stt', WRITE_STT_PROVIDER_TARGETS],
      ['ocr', WRITE_OCR_PROVIDER_TARGETS],
      ['tts', STANDALONE_TTS_PROVIDER_TARGETS],
      ['image', STANDALONE_IMAGE_PROVIDER_TARGETS],
      ['video', STANDALONE_VIDEO_PROVIDER_TARGETS],
      ['music', STANDALONE_MUSIC_PROVIDER_TARGETS]
    ] as const

    const mismatched: string[] = []
    for (const [stepFlag, targets] of categories) {
      for (const [provider, target] of Object.entries(targets)) {
        const expected = `--provider/--${stepFlag} ${provider}[=model]`
        if (describeModelSelector(target) !== expected) {
          mismatched.push(`${target} -> ${String(describeModelSelector(target))} (expected ${expected})`)
        }
      }
    }
    for (const [provider, target] of Object.entries(WRITE_LLM_PROVIDER_TARGETS)) {
      const expected = `--llm ${provider}[=model]`
      if (describeModelSelector(target) !== expected) {
        mismatched.push(`${target} -> ${String(describeModelSelector(target))} (expected ${expected})`)
      }
    }

    expect(mismatched).toEqual([])
  })

  test('write STT targets equal the extract STT projection minus named exclusions', () => {
    const writeTargets: Record<string, string> = WRITE_STT_PROVIDER_TARGETS
    const missingFromWrite = Object.entries(EXTRACT_PUBLIC_SELECTOR_FLAGS)
      .filter(([provider, targets]) =>
        targets.stt !== undefined
        && !WRITE_STT_EXTRACT_EXCLUSIONS.has(provider)
        && writeTargets[provider] !== targets.stt
      )
      .map(([provider]) => provider)
    const unexpectedInWrite = Object.entries(writeTargets)
      .filter(([provider, target]) =>
        EXTRACT_PUBLIC_SELECTOR_FLAGS[provider]?.stt !== target
        || WRITE_STT_EXTRACT_EXCLUSIONS.has(provider)
      )
      .map(([provider]) => provider)

    expect(missingFromWrite).toEqual([])
    expect(unexpectedInWrite).toEqual([])
  })

  test('every registered model validator rejects an invalid model in-process', () => {
    const failures: string[] = []
    for (const flag of getModelValidatorFlags()) {
      if (flag === 'whisper' || flag === 'whisperfile') {
        continue
      }
      try {
        expect(() => buildOptsFromFlags({ [flag]: 'invalid-model' })).toThrow(
          `Invalid model "invalid-model" for ${formatModelSelector(flag)}`
        )
      } catch (error) {
        failures.push(`${flag}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    expect(failures).toEqual([])
  })

  test('irregular local STT keys name their real spellings', () => {
    expect(() => validateWhisperModel('bogus')).toThrow(
      'Invalid model "bogus" for --provider/--stt whisper[=model]. This selector uses local whisper.cpp models.'
    )
    expect(() => validateWhisperfileModel('bogus')).toThrow(
      'Invalid model "bogus" for --provider/--stt whisperfile[=model]. This selector uses local whisperfile models.'
    )
    expect(describeModelSelector('whisperfile')).toContain('--stt')
  })
})
