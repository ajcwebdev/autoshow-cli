import { readInjectedConfigFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-config-flags'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { ExtractPublicSelectorTarget, ExtractSelectorInputRoutes, SelectorNormalizationResult } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { appendFlagValue, normalizeProviderAliases, occurrenceValues, parseLongFlagArg, parseProviderSelectorValue, setBooleanFlag } from './flag-helpers'

export const EXTRACT_PUBLIC_SELECTOR_FLAGS: Record<string, ExtractPublicSelectorTarget> = {
  reverb: { stt: 'reverb-stt' },
  deepinfra: { stt: 'deepinfra-stt', ocr: 'deepinfra-ocr' },
  deepgram: { stt: 'deepgram-stt' },
  soniox: { stt: 'soniox-stt' },
  speechmatics: { stt: 'speechmatics-stt' },
  rev: { stt: 'rev-stt' },
  groq: { stt: 'groq-stt' },
  grok: { stt: 'grok-stt', ocr: 'grok-ocr' },
  mistral: { stt: 'mistral-stt', ocr: 'mistral-ocr' },
  assemblyai: { stt: 'assemblyai-stt' },
  gladia: { stt: 'gladia-stt' },
  happyscribe: { stt: 'happyscribe-stt' },
  supadata: { stt: 'supadata-stt' },
  scrapecreators: { stt: 'scrapecreators-stt' },
  openai: { ocr: 'openai-ocr' },
  gemini: { stt: 'gemini-stt', ocr: 'gemini-ocr' },
  glm: { ocr: 'glm-ocr' },
  together: { stt: 'together-stt' },
  whisper: { stt: 'whisper-stt' },
  whisperfile: { stt: 'whisperfile-stt' },
  tesseract: { ocr: 'tesseract-ocr' },
  kimi: { ocr: 'kimi-ocr' },
  anthropic: { ocr: 'anthropic-ocr' }
} as const

const extractBooleanSelectorTargetFlags = new Set(['reverb-stt', 'tesseract-ocr'])

const extractUrlProviderNames = new Set<string>(URL_ARTICLE_BACKENDS)

const selectExtractGenericTargets = (
  rawProviderName: string,
  value: string | boolean,
  routes: ExtractSelectorInputRoutes
): Array<{ target: string, value: string | boolean }> => {
  const providerName = normalizeProviderAliases(rawProviderName)
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
      throw CLIUsageError(`--provider ${rawProviderName} does not accept a model for article extract inputs.`)
    }
    targets.push({ target: 'url-provider', value: providerName })
  }

  if (targets.length === 0) {
    throw CLIUsageError(`--provider ${rawProviderName} does not apply to ${describeRoutes(routes)} extract inputs.`)
  }

  const selectedModelTargets = targets.filter((entry) =>
    entry.target !== 'url-provider' && !extractBooleanSelectorTargetFlags.has(entry.target)
  )
  if (typeof value === 'string' && selectedModelTargets.length > 1) {
    throw CLIUsageError(
      `--provider ${rawProviderName}=<model> is ambiguous for ${describeRoutes(routes)} extract inputs. Split the batch by input type or omit the model to use route-specific defaults.`
    )
  }

  for (const entry of targets) {
    if (typeof value === 'string' && extractBooleanSelectorTargetFlags.has(entry.target)) {
      throw CLIUsageError(`--provider ${rawProviderName} does not accept a model for ${describeRoutes(routes)} extract inputs.`)
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

const appendExtractGenericTarget = (
  flags: Record<string, unknown>,
  target: string,
  value: string | boolean
): void => {
  if (target === 'url-provider') {
    const current = flags[target]
    if (typeof current === 'string' && current !== value) {
      throw CLIUsageError('Article extract supports one --provider URL backend at a time. Use --all-providers, --all-local, or both for URL backend groups.')
    }
    flags[target] = value
    return
  }
  appendFlagValue(flags, target, value)
}

export const hasExtractGenericSelectorFlags = (
  flags: Record<string, unknown>
): boolean =>
  occurrenceValues(flags['provider']).length > 0 || flags['all-providers'] === true || flags['all-local'] === true

export const stripExtractGenericSelectorFlags = (
  flags: Record<string, unknown>
): Record<string, unknown> => {
  const stripped = { ...flags }
  delete stripped['provider']
  delete stripped['all-providers']
  delete stripped['all-local']
  return stripped
}

export const stripExtractGenericSelectorArgs = (argv: string[]): string[] => {
  const stripped: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      stripped.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || (parsed.name !== 'provider' && parsed.name !== 'all-providers' && parsed.name !== 'all-local')) {
      stripped.push(arg)
      continue
    }

    if (
      parsed.name === 'provider'
      && parsed.inlineValue === undefined
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    ) {
      i++
    }
  }

  return stripped
}

export const normalizeExtractGenericSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  routes: ExtractSelectorInputRoutes
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)
  const configuredFlags = readInjectedConfigFlags(normalizedFlags)

  if (
    normalizedFlags['url-provider'] === 'defuddle'
    && !explicitFlags.has('url-provider')
    && !configuredFlags.has('url-provider')
  ) {
    delete normalizedFlags['url-provider']
  }

  for (const value of occurrenceValues(normalizedFlags['provider'])) {
    const parsed = parseProviderSelectorValue(value, 'provider')
    for (const target of selectExtractGenericTargets(parsed.provider, parsed.model, routes)) {
      appendExtractGenericTarget(normalizedFlags, target.target, target.value)
      normalizedExplicitFlags.add(target.target)
    }
  }
  delete normalizedFlags['provider']
  normalizedExplicitFlags.delete('provider')

  if (normalizedFlags['all-providers'] === true) {
    for (const target of selectExtractAllProviderTargets(routes)) {
      setBooleanFlag(normalizedFlags, target)
      normalizedExplicitFlags.add(target)
    }
    delete normalizedFlags['all-providers']
    normalizedExplicitFlags.delete('all-providers')
  }

  if (normalizedFlags['all-local'] === true) {
    for (const target of selectExtractAllLocalTargets(routes)) {
      setBooleanFlag(normalizedFlags, target)
      normalizedExplicitFlags.add(target)
    }
    delete normalizedFlags['all-local']
    normalizedExplicitFlags.delete('all-local')
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}

export const normalizeExtractGenericSelectorArgs = (
  argv: string[],
  routes: ExtractSelectorInputRoutes
): string[] => {
  const normalized: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      normalized.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || (parsed.name !== 'provider' && parsed.name !== 'all-providers' && parsed.name !== 'all-local')) {
      normalized.push(arg)
      continue
    }

    if (parsed.name === 'all-providers') {
      if (parsed.inlineValue === undefined || !['false', '0', 'no'].includes(parsed.inlineValue.trim().toLowerCase())) {
        normalized.push(...selectExtractAllProviderTargets(routes).map((target) => `--${target}`))
      }
      continue
    }

    if (parsed.name === 'all-local') {
      if (parsed.inlineValue === undefined || !['false', '0', 'no'].includes(parsed.inlineValue.trim().toLowerCase())) {
        normalized.push(...selectExtractAllLocalTargets(routes).map((target) => `--${target}`))
      }
      continue
    }

    const hasSeparateValue = parsed.inlineValue === undefined
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    const rawValue: string | true = parsed.inlineValue !== undefined
      ? parsed.inlineValue
      : hasSeparateValue
        ? argv[i + 1] as string
        : true
    if (hasSeparateValue) {
      i++
    }

    const provider = parseProviderSelectorValue(rawValue, 'provider')
    for (const target of selectExtractGenericTargets(provider.provider, provider.model, routes)) {
      if (target.target === 'url-provider') {
        normalized.push('--url-provider', String(target.value))
      } else if (typeof target.value === 'string' && !extractBooleanSelectorTargetFlags.has(target.target)) {
        normalized.push(`--${target.target}`, target.value)
      } else {
        normalized.push(`--${target.target}`)
      }
    }
  }

  return normalized
}

export const describeRoutes = (routes: ExtractSelectorInputRoutes): string => {
  if (routes.media && routes.document) return 'mixed media and document/image'
  if (routes.media) return 'media'
  if (routes.document) return 'document/image'
  return 'article, X Space, or unsupported'
}
