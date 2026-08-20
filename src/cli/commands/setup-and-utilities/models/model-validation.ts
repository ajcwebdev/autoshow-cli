import type { ModelCategory } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'

export const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

// Validator keys are internal target flag names (`mistral-ocr`, `groq-tts`, `openai`) that the
// selector normalizers generate; none of them is a flag a user can type. Each category maps its
// internal names back to the public spellings that produce them, using the dual-naming form
// `target-validation.ts` already uses: `--provider` on extract and the standalone
// tts/image/video/music commands, and the step selector in the write pipeline.
const SELECTOR_CATEGORIES = [
  { stepFlag: 'stt', targets: WRITE_STT_PROVIDER_TARGETS },
  { stepFlag: 'ocr', targets: WRITE_OCR_PROVIDER_TARGETS },
  { stepFlag: 'tts', targets: STANDALONE_TTS_PROVIDER_TARGETS },
  { stepFlag: 'image', targets: STANDALONE_IMAGE_PROVIDER_TARGETS },
  { stepFlag: 'video', targets: STANDALONE_VIDEO_PROVIDER_TARGETS },
  { stepFlag: 'music', targets: STANDALONE_MUSIC_PROVIDER_TARGETS }
] as const satisfies readonly { stepFlag: string, targets: Record<string, string> }[]

// Two local STT keys predate the `<provider>-<category>` convention and cannot be split by
// suffix, so they would otherwise read as bare LLM providers.
const IRREGULAR_SELECTORS: Record<string, string> = {
  whisper: '--provider/--stt whisper[=model]',
  whisperfile: '--provider/--stt whisperfile[=model]'
}

const modelValidatorFlags = new Set<string>()

// Every flag key handed to createModelValidator, for the drift guard in
// model-selector-messages.test.ts. Populated as the model modules are imported.
export const getModelValidatorFlags = (): readonly string[] => [...modelValidatorFlags]

// Returns undefined when a key resolves to no public spelling, which the guard treats as drift.
export const describeModelSelector = (flag: string): string | undefined => {
  const irregular = IRREGULAR_SELECTORS[flag]
  if (irregular !== undefined) {
    return irregular
  }

  for (const { stepFlag, targets } of SELECTOR_CATEGORIES) {
    const suffix = `-${stepFlag}`
    if (!flag.endsWith(suffix)) {
      continue
    }
    const provider = flag.slice(0, -suffix.length)
    if ((targets as Record<string, string>)[provider] === flag) {
      return `--provider/--${stepFlag} ${provider}[=model]`
    }
  }

  // Bare keys are write-pipeline LLM providers, whose only public spelling is --llm.
  if ((WRITE_LLM_PROVIDER_TARGETS as Record<string, string>)[flag] === flag) {
    return `--llm ${flag}[=model]`
  }

  return undefined
}

export const formatModelSelector = (flag: string): string => describeModelSelector(flag) ?? `--${flag}`

export const createModelValidator = <T extends string>(
  supported: readonly T[],
  flag: string,
  extraMessage?: string
) => {
  modelValidatorFlags.add(flag)
  return (model: string): T => {
    if (!supported.includes(model as T)) {
      const suffix = extraMessage ? ` ${extraMessage}` : ''
      throw CLIUsageError(
        `Invalid model "${model}" for ${formatModelSelector(flag)}.${suffix} Allowed values: ${formatAllowedValues(supported)}`
      )
    }
    return model as T
  }
}

export const throwRetiredModelSelection = (
  model: string,
  flag: string,
  replacement: string
): never => {
  throw CLIUsageError(
    `Model "${model}" is retired for ${formatModelSelector(flag)}. Use "${replacement}" instead. AutoShow will not silently substitute a different model identity.`
  )
}

/**
 * A model validator that redirects retired identities before validating against the active
 * list. Twelve validators across the model modules had hand-copied this wrapper, and
 * `image-models.ts` had instead hardcoded its own literal comparisons; routing every one
 * through the retirement registry means adding a retired model to
 * `RETIRED_MODEL_REPLACEMENTS` is all a provider refresh has to do.
 */
export const createRetiringModelValidator = <T extends string>(
  category: ModelCategory,
  service: string,
  supported: readonly T[],
  flag: string,
  extraMessage?: string
) => {
  const validateActive = createModelValidator<T>(supported, flag, extraMessage)
  return (model: string): T => {
    const replacement = getRetiredModelReplacement(category, service, model)
    if (replacement !== undefined) {
      return throwRetiredModelSelection(model, flag, replacement)
    }
    return validateActive(model)
  }
}

export const buildModelDescription = (label: string, models: readonly string[]): string =>
  `${label} (omit value for cheapest supported model): ${models.join('|')}`
