import {
  HOSTED_URL_ARTICLE_BACKENDS,
  LOCAL_URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  DEFAULT_URL_REQUEST_ATTEMPTS,
  DEFAULT_URL_REQUEST_TIMEOUT_MS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, RuntimeOptions } from '~/types'
import {
  parseUrlBackend,
  readOptionalStringFlag
} from '../options/flag-readers'

export const HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET = Math.min(4, HOSTED_URL_ARTICLE_BACKENDS.length)

const parsePositiveIntegerFlag = (
  value: string | undefined,
  label: string
): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid ${label} value "${value}". Expected a positive integer.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw CLIUsageError(`Invalid ${label} value "${value}". Expected a positive integer.`)
  }

  return parsed
}

const readPositiveIntegerOption = (
  flags: Record<string, unknown>,
  flagName: string,
  fallback: number
): number => {
  const flagValue = readOptionalStringFlag(flags, flagName)
  return parsePositiveIntegerFlag(flagValue, `--${flagName}`)
    ?? fallback
}

export const resolveUrlOptions = (
  flags: Record<string, unknown>,
  allUrlSelected: boolean,
  allLocalUrlSelected: boolean,
  options: {
    explicitFlags?: Set<string> | undefined
    configuredFlags?: Set<string> | undefined
    flagOccurrences?: readonly CliFlagOccurrence[] | undefined
  } = {}
): Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends' | 'urlRequestTimeoutMs' | 'urlRequestAttempts'> => {
  const publicUrlBackendFlag = readOptionalStringFlag(flags, 'url-provider')
  const hasFlagOccurrences = (options.flagOccurrences?.length ?? 0) > 0
  const hasSelectedFlag = (flagName: string, value: string | undefined): boolean =>
    value !== undefined
    && (
      options.explicitFlags?.has(flagName) === true
      || options.configuredFlags?.has(flagName) === true
      || !hasFlagOccurrences
    )
  const publicSelected = hasSelectedFlag('url-provider', publicUrlBackendFlag)
  const urlBackendFlag = publicSelected ? publicUrlBackendFlag : undefined
  if ((allUrlSelected || allLocalUrlSelected) && urlBackendFlag !== undefined) {
    throw CLIUsageError('Cannot use --all-providers or --all-local url with --url-provider')
  }

  const selectedUrlBackends = allUrlSelected || allLocalUrlSelected
    ? [
        ...(allLocalUrlSelected ? LOCAL_URL_ARTICLE_BACKENDS : []),
        ...(allUrlSelected ? HOSTED_URL_ARTICLE_BACKENDS : [])
      ] satisfies RuntimeOptions['urlBackends']
    : undefined

  return {
    urlBackend: parseUrlBackend(urlBackendFlag),
    urlBackendExplicit: urlBackendFlag !== undefined,
    urlBackends: selectedUrlBackends,
    urlRequestTimeoutMs: readPositiveIntegerOption(
      flags,
      'url-request-timeout-ms',
      DEFAULT_URL_REQUEST_TIMEOUT_MS
    ),
    urlRequestAttempts: readPositiveIntegerOption(
      flags,
      'url-request-attempts',
      DEFAULT_URL_REQUEST_ATTEMPTS
    ),
  }
}
