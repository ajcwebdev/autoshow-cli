import { describe, expect, test } from 'bun:test'
import {
  describeModelSelector,
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
  validateKimiOcrModel,
  validateMinimaxModel,
  validateWhisperModel,
  validateWhisperfileModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

// Importing setup-model-options above registers every createModelValidator key, so
// getModelValidatorFlags() below sees all seven model modules.

const WRITE_STT_EXTRACT_EXCLUSIONS = new Set<string>([])

describe('model validation selector contracts', () => {
  // Model validators are keyed by internal target flag names (`kimi-ocr`, `groq-tts`,
  // `cerebras`) that the selector normalizers generate. Interpolating those keys into
  // `--<flag>` named flags no user can type; a key with no derivable public spelling
  // silently reintroduces that, so fail here instead.
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

  test('messages name the selector a user can type, not the internal flag', () => {
    // Retired IDs are assembled at runtime so they stay ungreppable in the registries.
    const retiredKimiOcrModel = ['kimi-k2', '7-code'].join('.')
    const retiredMinimaxModel = ['MiniMax-M2', '5'].join('.')

    expect(() => validateKimiOcrModel(retiredKimiOcrModel)).toThrow(
      `Invalid model "${retiredKimiOcrModel}" for --provider/--ocr kimi[=model]. Allowed values: kimi-k2.6, kimi-k3`
    )
    expect(() => validateMinimaxModel(retiredMinimaxModel)).toThrow(
      `Invalid model "${retiredMinimaxModel}" for --llm minimax[=model]. Allowed values: MiniMax-M3`
    )
  })

  // The two keys that predate the `<provider>-<category>` convention.
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
