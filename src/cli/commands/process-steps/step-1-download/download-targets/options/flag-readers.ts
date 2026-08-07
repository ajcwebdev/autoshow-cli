import { CLIUsageError } from '~/utils/error-handler'
import type { BatchOrder, HtmlArticleBackend } from '~/types'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

export const parseIntWithDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

export const parseFloatWithDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

export const parseOptionalPositiveIntFlag = (
  value: string | undefined,
  flagName: string
): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a positive integer.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a positive integer.`)
  }

  return parsed
}

export const parseOptionalIntFlag = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const parseOptionalNumberFlag = (
  value: string | undefined,
  flagName: string,
  options: {
    min: number
    max: number
    exclusiveMin?: boolean
    integer?: boolean
  }
): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)
  const tooSmall = options.exclusiveMin === true ? parsed <= options.min : parsed < options.min
  const invalid = !Number.isFinite(parsed)
    || (options.integer === true && !Number.isInteger(parsed))
    || tooSmall
    || parsed > options.max

  if (invalid) {
    const minLabel = options.exclusiveMin === true ? `>${options.min}` : `${options.min}`
    throw CLIUsageError(
      `Invalid --${flagName} value "${value}". Expected ${options.integer === true ? 'an integer' : 'a number'} from ${minLabel} to ${options.max}.`
    )
  }

  return parsed
}

const readFlagValue = (flags: Record<string, unknown>, key: string): unknown => {
  return flags[key]
}

export const readStringFlag = (flags: Record<string, unknown>, key: string, fallback: string): string => {
  const value = readFlagValue(flags, key)
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return fallback
}

export const readOptionalStringFlag = (flags: Record<string, unknown>, key: string): string | undefined => {
  const value = readFlagValue(flags, key)
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return undefined
}

export const readOptionalStringListFlag = (flags: Record<string, unknown>, key: string): string[] | undefined => {
  const value = readFlagValue(flags, key)
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    return items.length > 0 ? items : undefined
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value]
  }
  return undefined
}

export const readBooleanFlag = (flags: Record<string, unknown>, key: string): boolean => {
  return readFlagValue(flags, key) === true
}

export const readOptionalBooleanFlag = (flags: Record<string, unknown>, key: string): boolean | undefined => {
  const value = readFlagValue(flags, key)
  return typeof value === 'boolean' ? value : undefined
}

export const readBatchOrder = (flags: Record<string, unknown>): BatchOrder => {
  const v = readFlagValue(flags, 'batch-order')
  return v === 'oldest' ? 'oldest' : 'newest'
}

const formatQuotedChoiceList = (choices: readonly string[]): string => {
  const quotedChoices = choices.map((choice) => `"${choice}"`)
  if (quotedChoices.length <= 2) {
    return quotedChoices.join(' or ')
  }
  return `${quotedChoices.slice(0, -1).join(', ')}, or ${quotedChoices[quotedChoices.length - 1]}`
}

export const parseUrlBackend = (value: string | undefined): HtmlArticleBackend => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return 'defuddle'
  }
  if ((URL_ARTICLE_BACKENDS as readonly string[]).includes(normalized)) {
    return normalized as HtmlArticleBackend
  }
  throw CLIUsageError(`Invalid --url-provider value "${value}". Expected ${formatQuotedChoiceList(URL_ARTICLE_BACKENDS)}.`)
}

export const PDF_CHAPTER_MODES = ['local', 'auto', 'llm'] as const

export const parsePdfChapterMode = (value: string | undefined): 'local' | 'auto' | 'llm' => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized === 'local') {
    return 'local'
  }
  if (normalized === 'auto') {
    return 'auto'
  }
  if (normalized === 'llm') {
    return 'llm'
  }
  throw CLIUsageError(`Invalid --pdf-chapter-mode value "${value}". Expected ${formatQuotedChoiceList(PDF_CHAPTER_MODES)}.`)
}

export const TTS_DIALOGUE_FORMATS = ['screenplay', 'labeled'] as const

export const parseTtsDialogueFormat = (value: string | undefined): 'screenplay' | 'labeled' | undefined => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (normalized === 'screenplay' || normalized === 'labeled') {
    return normalized
  }
  throw CLIUsageError(`Invalid --tts-dialogue-format value "${value}". Expected "screenplay" or "labeled".`)
}

export const readOptionalRawStringFlag = (args: string[], flagName: string): string | undefined => {
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i] as string
    if (arg === `--${flagName}`) {
      const next = args[i + 1]
      if (typeof next === 'string' && !next.startsWith('--') && next.length > 0) {
        return next
      }
      continue
    }

    if (arg.startsWith(`--${flagName}=`)) {
      const value = arg.slice(flagName.length + 3)
      if (value.length > 0) {
        return value
      }
    }
  }

  return undefined
}
