import type { ModelCategory } from '~/types'
import { UsageError } from '~/utils/error-handler'
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

const SELECTOR_CATEGORIES = [
  { stepFlag: 'stt', targets: WRITE_STT_PROVIDER_TARGETS },
  { stepFlag: 'ocr', targets: WRITE_OCR_PROVIDER_TARGETS },
  { stepFlag: 'tts', targets: STANDALONE_TTS_PROVIDER_TARGETS },
  { stepFlag: 'image', targets: STANDALONE_IMAGE_PROVIDER_TARGETS },
  { stepFlag: 'video', targets: STANDALONE_VIDEO_PROVIDER_TARGETS },
  { stepFlag: 'music', targets: STANDALONE_MUSIC_PROVIDER_TARGETS }
] as const satisfies readonly { stepFlag: string, targets: Record<string, string> }[]

const IRREGULAR_SELECTORS: Record<string, string> = {
  whisper: '--provider/--stt whisper[=model]',
  whisperfile: '--provider/--stt whisperfile[=model]'
}

const modelValidatorFlags = new Set<string>()

export const getModelValidatorFlags = (): readonly string[] => [...modelValidatorFlags]

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
      throw UsageError(
        `Invalid model "${model}" for ${formatModelSelector(flag)}.${suffix} Allowed values: ${formatAllowedValues(supported)}`
      )
    }
    return model as T
  }
}

const throwRetiredModelSelection = (
  model: string,
  flag: string,
  replacement: string
): never => {
  throw UsageError(
    `Model "${model}" is retired for ${formatModelSelector(flag)}. Use "${replacement}" instead. AutoShow will not silently substitute a different model identity.`
  )
}

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
