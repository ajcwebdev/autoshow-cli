import type { HtmlArticleBackend, ProviderSpec, Step2Command, Step2ProviderOptionSurface, Step2ProviderSelectionFilter, Step2ProviderSelectionOrigin, Step2ResolvedProviderSelection, Step2ShortcutFlag, UrlArticleTarget } from '~/types'
import { getStep2ProviderEntries, getStep2ProviderEntry } from './entries'
import { URL_ARTICLE_BACKENDS } from './url-providers'

const appendProviderSpec = (
  specs: ProviderSpec[],
  spec: ProviderSpec
): void => {
  const key = `${spec.provider}:${spec.model ?? ''}`
  if (specs.some((entry) => `${entry.provider}:${entry.model ?? ''}` === key)) {
    return
  }
  specs.push(spec)
}

const appendProviderSelection = (
  selections: Step2ResolvedProviderSelection[],
  selection: Step2ResolvedProviderSelection
): void => {
  const key = `${selection.providerSpecProvider}:${selection.model}`
  if (selections.some((entry) => `${entry.providerSpecProvider}:${entry.model}` === key)) {
    return
  }
  selections.push(selection)
}

const readRuntimeValue = (
  options: object,
  key: keyof Step2ProviderOptionSurface
): unknown => (options as Partial<Record<keyof Step2ProviderOptionSurface, unknown>>)[key]

const readSelectionOrigins = (
  options: object
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const value = (options as { step2SelectionOrigins?: unknown }).step2SelectionOrigins
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}
  for (const [key, origin] of Object.entries(value)) {
    if (origin === 'default' || origin === 'explicit' || origin === 'all-shortcut') {
      origins[key] = origin
    }
  }
  return origins
}

const isUrlBackend = (value: unknown): value is HtmlArticleBackend =>
  typeof value === 'string' && (URL_ARTICLE_BACKENDS as readonly string[]).includes(value)

const readUrlBackendSelection = (
  options: object,
  backend: string,
  selectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>,
  flagName: string
): Step2ProviderSelectionOrigin | undefined => {
  const urlBackends = (options as { urlBackends?: unknown }).urlBackends
  if (Array.isArray(urlBackends) && urlBackends.length > 0) {
    return urlBackends.includes(backend)
      ? selectionOrigins[flagName] ?? 'all-shortcut'
      : undefined
  }

  const urlBackend = (options as { urlBackend?: unknown }).urlBackend
  if (urlBackend === backend || (urlBackend === undefined && backend === 'defuddle')) {
    return selectionOrigins[flagName] ?? ((options as { urlBackendExplicit?: unknown }).urlBackendExplicit === true ? 'explicit' : 'default')
  }

  return undefined
}

const includeOrigin = (
  origin: Step2ProviderSelectionOrigin,
  filter?: Step2ProviderSelectionFilter
): boolean => {
  const allowedOrigins = filter?.includeOrigins
  return !allowedOrigins || allowedOrigins.includes(origin)
}

export const isStep2BooleanProviderSelected = (
  flagName: string,
  flags: Record<string, unknown>,
  allShortcutFlags: Partial<Record<Step2ShortcutFlag, boolean>>
): boolean => {
  const entry = getStep2ProviderEntry(flagName)
  if (!entry || entry.selection.type !== 'boolean') {
    return false
  }

  if (flags[entry.flagName] === true) {
    return true
  }

  return entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut] === true
}

export const collectStep2ProviderSpecs = (
  step: Step2Command,
  options: object,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []
  for (const selection of collectStep2ProviderSelections(step, options, filter)) {
    appendProviderSpec(specs, {
      provider: selection.providerSpecProvider,
      model: selection.model
    })
  }
  return specs
}

export const collectStep2ProviderSelections = (
  step: Step2Command,
  options: object,
  filter?: Step2ProviderSelectionFilter
): Step2ResolvedProviderSelection[] => {
  const selections: Step2ResolvedProviderSelection[] = []
  const selectionOrigins = readSelectionOrigins(options)
  const hasSelectionOrigins = 'step2SelectionOrigins' in options

  for (const entry of getStep2ProviderEntries(step)) {
    if (entry.selection.type === 'fixed') {
      const origin = step === 'url'
        ? readUrlBackendSelection(options, entry.targetService, selectionOrigins, entry.flagName)
        : undefined
      if (!origin || !includeOrigin(origin, filter)) {
        continue
      }

      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model: entry.selection.model,
        selectionKind: entry.selection.type,
        origin
      })
      continue
    }

    if (entry.selection.type === 'boolean') {
      if (readRuntimeValue(options, entry.selection.runtimeKey) !== true) {
        continue
      }

      const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)
      if (!origin || !includeOrigin(origin, filter)) {
        continue
      }

      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model: entry.selection.model,
        selectionKind: entry.selection.type,
        origin
      })
      continue
    }

    const models = readRuntimeValue(options, entry.selection.runtimeModelsKey)
    const orderedModels = Array.isArray(models)
      ? models.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : []
    const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)

    if (!origin || !includeOrigin(origin, filter)) {
      continue
    }

    for (const model of orderedModels) {
      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model,
        selectionKind: entry.selection.type,
        origin
      })
    }
  }

  return selections
}

export const collectUrlArticleTargets = (
  options: object,
  filter?: Step2ProviderSelectionFilter
): UrlArticleTarget[] =>
  collectStep2ProviderSelections('url', options, filter)
    .filter((selection): selection is Step2ResolvedProviderSelection & { targetService: HtmlArticleBackend, model: HtmlArticleBackend } =>
      isUrlBackend(selection.targetService) && selection.targetService === selection.model
    )
    .map((selection) => ({
      service: selection.targetService,
      model: selection.model
    }))
