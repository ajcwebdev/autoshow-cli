import { readInjectedConfigFlags } from '~/cli/options/option-resolution/build-options-config-flags'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './provider-targets'
import type { CliFlagOccurrence, ExtractPublicSelectorTarget, ExtractSelectorInputRoutes, SelectorNormalizationResult } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { parseProviderSelectorValue } from './flag-helpers'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'

const buildExtractPublicSelectorFlags = (): Record<string, ExtractPublicSelectorTarget> => {
  const targets: Record<string, ExtractPublicSelectorTarget> = {}
  for (const [provider, flag] of Object.entries(WRITE_STT_PROVIDER_TARGETS)) {
    targets[provider] = { ...targets[provider], stt: flag }
  }
  for (const [provider, flag] of Object.entries(WRITE_OCR_PROVIDER_TARGETS)) {
    targets[provider] = { ...targets[provider], ocr: flag }
  }
  return targets
}

export const EXTRACT_PUBLIC_SELECTOR_FLAGS = buildExtractPublicSelectorFlags()

const extractBooleanSelectorTargetFlags = new Set(['reverb-stt', 'tesseract-ocr'])

const extractUrlProviderNames = new Set<string>(URL_ARTICLE_BACKENDS)

const selectExtractGenericTargets = (
  providerName: string,
  value: string | boolean,
  routes: ExtractSelectorInputRoutes
): Array<{ target: string, value: string | boolean }> => {
  const targets: Array<{ target: string, value: string | boolean }> = []
  const target = EXTRACT_PUBLIC_SELECTOR_FLAGS[providerName as keyof typeof EXTRACT_PUBLIC_SELECTOR_FLAGS]

  if (routes.media && target?.stt) {
    targets.push({ target: target.stt, value })
  }
  if (routes.document && target?.ocr) {
    targets.push({ target: target.ocr, value })
  }

  if (routes.article && extractUrlProviderNames.has(providerName)) {
    if (value !== true) {
      throw CLIUsageError(`--provider ${providerName} does not accept a model for article extract inputs.`)
    }
    targets.push({ target: 'url-provider', value: providerName })
  }

  if (targets.length === 0) {
    throw CLIUsageError(`--provider ${providerName} does not apply to ${describeRoutes(routes)} extract inputs.`)
  }

  const selectedModelTargets = targets.filter((entry) =>
    entry.target !== 'url-provider' && !extractBooleanSelectorTargetFlags.has(entry.target)
  )
  if (typeof value === 'string' && selectedModelTargets.length > 1) {
    throw CLIUsageError(
      `--provider ${providerName}=<model> is ambiguous for ${describeRoutes(routes)} extract inputs. Split the batch by input type or omit the model to use route-specific defaults.`
    )
  }

  for (const entry of targets) {
    if (typeof value === 'string' && extractBooleanSelectorTargetFlags.has(entry.target)) {
      throw CLIUsageError(`--provider ${providerName} does not accept a model for ${describeRoutes(routes)} extract inputs.`)
    }
  }

  return targets
}

const selectExtractAllProviderTargets = (
  routes: ExtractSelectorInputRoutes
): string[] => {
  const targets: string[] = []
  if (routes.media) targets.push('all-stt')
  if (routes.document) targets.push('all-ocr')
  if (routes.article) targets.push('all-url')
  if (targets.length === 0) {
    throw CLIUsageError(`--all-providers does not apply to ${describeRoutes(routes)} extract inputs.`)
  }
  return targets
}

const selectExtractAllLocalTargets = (
  routes: ExtractSelectorInputRoutes
): string[] => {
  const targets: string[] = []
  if (routes.media) targets.push('all-local-stt')
  if (routes.document) targets.push('all-local-ocr')
  if (routes.article) targets.push('all-local-url')
  return targets
}

export const hasExtractGenericSelectorOccurrences = (
  flagOccurrences: readonly CliFlagOccurrence[]
): boolean =>
  flagOccurrences.some((occurrence) => extractGenericSelectorNames.has(occurrence.name))

export const stripExtractGenericSelectorFlags = (
  flags: Record<string, unknown>
): Record<string, unknown> => {
  const stripped = { ...flags }
  delete stripped['provider']
  delete stripped['all-providers']
  delete stripped['all-local']
  return stripped
}

const extractGenericSelectorNames = new Set(['provider', 'all-providers', 'all-local'])

export const stripExtractGenericSelectorOccurrences = (
  flagOccurrences: readonly CliFlagOccurrence[]
): CliFlagOccurrence[] =>
  flagOccurrences.filter((occurrence) => !extractGenericSelectorNames.has(occurrence.name))

export const normalizeExtractGenericSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  routes: ExtractSelectorInputRoutes
): SelectorNormalizationResult => {
  const normalizedInputFlags: Record<string, unknown> = { ...flags }
  const configuredFlags = readInjectedConfigFlags(normalizedInputFlags)

  if (
    normalizedInputFlags['url-provider'] === 'defuddle'
    && !explicitFlags.has('url-provider')
    && !configuredFlags.has('url-provider')
  ) {
    delete normalizedInputFlags['url-provider']
  }

  let selectedUrlBackend = typeof normalizedInputFlags['url-provider'] === 'string'
    ? normalizedInputFlags['url-provider']
    : undefined

  return applyFlagOccurrenceNormalization(normalizedInputFlags, explicitFlags, flagOccurrences, (occurrence) => {
    if (occurrence.name === 'provider') {
      if (occurrence.value === false) {
        return []
      }
      const provider = parseProviderSelectorValue(occurrence.value, 'provider')
      return selectExtractGenericTargets(provider.provider, provider.model, routes).map((target) => {
        if (target.target === 'url-provider') {
          if (selectedUrlBackend !== undefined && selectedUrlBackend !== target.value) {
            throw CLIUsageError('Article extract supports one --provider URL backend at a time. Use --all-providers, --all-local, or both for URL backend groups.')
          }
          selectedUrlBackend = String(target.value)
        }
        return replaceFlagOccurrence(
          occurrence,
          target.target,
          target.value,
          target.target === 'url-provider' || extractBooleanSelectorTargetFlags.has(target.target) ? 'set' : 'append'
        )
      })
    }

    if (occurrence.name === 'all-providers') {
      return occurrence.value === true
        ? selectExtractAllProviderTargets(routes).map((target) => replaceFlagOccurrence(occurrence, target, true))
        : []
    }
    if (occurrence.name === 'all-local') {
      return occurrence.value === true
        ? selectExtractAllLocalTargets(routes).map((target) => replaceFlagOccurrence(occurrence, target, true))
        : []
    }
    return undefined
  })
}

export const describeRoutes = (routes: ExtractSelectorInputRoutes): string => {
  if (routes.media && routes.document) return 'mixed media and document/image'
  if (routes.media) return 'media'
  if (routes.document) return 'document/image'
  return 'article, X Space, or unsupported'
}
