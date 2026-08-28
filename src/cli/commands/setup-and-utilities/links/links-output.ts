import { basename, extname, join } from 'node:path'
import type { LinksSelection } from '~/types'
import { createGenerationOutputDir } from '~/cli/commands/process-steps/generation-command-utils'
import { getFetchableDocumentationUrl } from './links-fetcher'

export const normalizeTokens = (tokens: string[]): string[] => [...new Set(tokens.map(token => token.toLowerCase()))].sort()

export const sanitizeLinksOutputStem = (rawStem: string, fallback: string, maxLength: number): string => {
  const sanitized = rawStem
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)

  return sanitized.length > 0 ? sanitized : fallback
}

export const getDefaultLinksOutputFileName = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string => {
  const groups = [
    ...(globalSections.length > 0 || serviceSelections.size === 0
      ? [['all', normalizeTokens(globalSections.length > 0 ? globalSections : ['all'])] as const]
      : []),
    ...[...serviceSelections.entries()].map(([serviceName, sections]) => [
      serviceName.toLowerCase(),
      normalizeTokens(sections.length > 0 ? sections : ['all'])
    ] as const)
  ]

  const stem = groups
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([serviceName, sections]) => [serviceName, ...sections].join('-'))
    .join('--')

  return `${stem}-links.md`
}

export const sanitizeInputFileStem = (inputFilePath: string): string => {
  const extension = extname(inputFilePath)
  const rawStem = basename(inputFilePath, extension)
  return sanitizeLinksOutputStem(rawStem, 'urls', 80)
}

export const getDefaultLinksInputOutputFileName = (inputFilePath: string): string =>
  `${sanitizeInputFileStem(inputFilePath)}-links.md`

export const getDirectUrlOutputStem = (directUrl: string): string => {
  try {
    const parsedUrl = new URL(getFetchableDocumentationUrl(directUrl))
    return `${parsedUrl.hostname}${parsedUrl.pathname}`
  } catch {
    return getFetchableDocumentationUrl(directUrl)
  }
}

export const getDefaultLinksDirectUrlOutputFileName = (directUrl: string): string =>
  `${sanitizeLinksOutputStem(getDirectUrlOutputStem(directUrl), 'url', 120)}-links.md`

export const getDefaultLinksFileName = (selection: LinksSelection): string => {
  if (selection.directUrl) return getDefaultLinksDirectUrlOutputFileName(selection.directUrl)
  if (selection.inputFilePath) return getDefaultLinksInputOutputFileName(selection.inputFilePath)
  return getDefaultLinksOutputFileName(selection.serviceSelections, selection.globalSections)
}

export const resolveDefaultLinksOutputPath = async (selection: LinksSelection): Promise<string> => {
  const fileName = getDefaultLinksFileName(selection)
  const stem = fileName.replace(/\.md$/i, '')
  const outputDir = await createGenerationOutputDir(stem)
  return join(outputDir, fileName)
}

export const getLinksRefreshMetadataPath = (outputPath: string | URL): string => {
  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)

  const cleanPath = resolvedOutputPath.split('?')[0]?.split('#')[0] ?? resolvedOutputPath
  const ext = extname(cleanPath)
  if (/\.(?:md|markdown|txt)$/i.test(ext)) {
    return `${cleanPath.slice(0, -ext.length)}.refresh.json`
  }
  return `${cleanPath}.refresh.json`
}
