import type { CliFlagsDefinition, LinksParsedCommand, LinksSelection, ModelLinksData } from '~/types'
import { UsageError } from '~/utils/error-handler'
import modelLinks from './model-links'
import { isLinksInputFileArg, isRemoteUrlToken } from './links-input-parser'

export const data = modelLinks as ModelLinksData

export const serviceEntries = Object.entries(data)

export const serviceKeySet = new Set(serviceEntries.map(([serviceName]) => serviceName.toLowerCase()))

export const serviceSectionKeyMap = new Map(
  serviceEntries.map(([serviceName, sections]) => [
    serviceName.toLowerCase(),
    new Set(Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
  ])
)

export const globalSectionKeySet = new Set(
  serviceEntries.flatMap(([, sections]) => Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
)

export const knownProviders = [...serviceKeySet].sort()

export const knownSections = [...globalSectionKeySet].sort()

export const linksProviderFlags = Object.fromEntries(knownProviders.map((provider) => [provider, {
  description: `Scope following section selectors to ${provider}`,
  type: Boolean,
  negatable: false,
  help: { hidden: true }
}])) as CliFlagsDefinition

export const linksFlags = {
  refresh: {
    description: 'Write refresh metadata sidecar with per-link hashes and token counts',
    type: Boolean,
    default: false,
    negatable: false
  },
  'refresh-only': {
    description: 'Write refresh metadata sidecar without overwriting existing Markdown bundle',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...linksProviderFlags
} as const satisfies CliFlagsDefinition

export const parseLinksSelection = (parsed: LinksParsedCommand): LinksSelection => {
  const serviceSelections = new Map<string, string[]>()
  const globalSections: string[] = []
  let currentService: string | null = null
  let inputFilePath: string | undefined
  let directUrl: string | undefined

  const orderedTokens = [
    ...parsed.rawParsed.positionals.map((position) => ({
      kind: 'positional' as const,
      index: position.index,
      value: position.value
    })),
    ...parsed.rawParsed.flagOccurrences.map((occurrence, occurrenceIndex) => ({
      kind: 'flag' as const,
      index: parsed.rawParsed.flagOccurrenceIndices[occurrenceIndex] ?? -1,
      occurrence
    }))
  ].sort((left, right) => left.index - right.index)

  for (const token of orderedTokens) {
    if (token.kind === 'flag') {
      const { name, raw } = token.occurrence
      if (name === 'refresh' || name === 'refresh-only' || !serviceKeySet.has(name)) continue
      const equalsIndex = raw.indexOf('=')
      if (equalsIndex !== -1) {
        const flagValue = raw.slice(equalsIndex + 1)
        const sectionHint = flagValue.trim() ? `, e.g. "--${name} ${flagValue}"` : ''
        throw UsageError(`links provider selector "--${name}" does not accept inline values; pass sections as separate arguments after the provider selector${sectionHint}.`)
      }
      currentService = name
      if (!serviceSelections.has(currentService)) {
        serviceSelections.set(currentService, [])
      }
      continue
    }

    const arg = token.value
    if (isRemoteUrlToken(arg)) {
      if (directUrl) {
        throw UsageError('links direct URL mode cannot be combined with provider selectors, section selectors, input file mode, or another direct URL')
      }
      directUrl = arg
    } else if (isLinksInputFileArg(arg)) {
      if (inputFilePath) {
        throw UsageError('links accepts only one input file')
      }
      inputFilePath = arg
    } else if (currentService) {
      serviceSelections.get(currentService)!.push(arg.toLowerCase())
    } else {
      globalSections.push(arg.toLowerCase())
    }
  }

  if (parsed.rawParsed.doubleDash.length > 0) {
    throw UsageError(`Unknown links selector "--". Known providers: ${knownProviders.join(', ')}. Known sections: ${knownSections.join(', ')}.`)
  }

  if (directUrl && (inputFilePath || serviceSelections.size > 0 || globalSections.length > 0)) {
    throw UsageError('links direct URL mode cannot be combined with provider selectors, section selectors, input file mode, or another direct URL')
  }

  if (inputFilePath && (serviceSelections.size > 0 || globalSections.length > 0)) {
    throw UsageError('links input file mode cannot be combined with provider or section selectors')
  }

  const refreshOnly = parsed.flags['refresh-only'] === true
  const refresh = parsed.flags['refresh'] === true || refreshOnly

  return {
    serviceSelections,
    globalSections,
    refresh,
    ...(refreshOnly ? { refreshOnly: true } : {}),
    ...(inputFilePath ? { inputFilePath } : {}),
    ...(directUrl ? { directUrl } : {})
  }
}

export const assertKnownSections = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): void => {
  const unknownGlobalSections = globalSections.filter(sectionName => !globalSectionKeySet.has(sectionName))
  if (unknownGlobalSections.length > 0) {
    throw UsageError(`Unknown links section(s): ${unknownGlobalSections.join(', ')}. Known sections: ${knownSections.join(', ')}`)
  }

  for (const [serviceName, sections] of serviceSelections) {
    const serviceSections = serviceSectionKeyMap.get(serviceName)
    const unknownSections = sections.filter(sectionName => !serviceSections?.has(sectionName))
    if (unknownSections.length > 0) {
      throw UsageError(`Unknown links section(s) for --${serviceName}: ${unknownSections.join(', ')}`)
    }
  }
}

export const collectLinks = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string[] => {
  const links: string[] = []
  const hasServiceSelections = serviceSelections.size > 0
  const hasGlobalSections = globalSections.length > 0

  if (hasServiceSelections) {
    for (const [serviceName, sections] of Object.entries(data)) {
      const requested = serviceSelections.get(serviceName.toLowerCase())
      if (!requested) continue
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (requested.length === 0 || requested.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (globalSections.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (!hasServiceSelections && !hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const urls of Object.values(sections)) {
        links.push(...urls)
      }
    }
  }

  return [...new Set(links)]
}
