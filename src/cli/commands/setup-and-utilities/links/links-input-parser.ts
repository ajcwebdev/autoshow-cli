import { UsageError } from '~/utils/error-handler'
import { formatErrorMessage } from '~/utils/value-helpers'

export const isRemoteUrlToken = (arg: string): boolean => /^(?:blob:)?https?:\/\//i.test(arg)

export const isLinksInputFileArg = (arg: string): boolean =>
  !isRemoteUrlToken(arg) && /\.(?:md|txt)$/i.test(arg)

export const stripLinksInputComments = (content: string): string =>
  content
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('//')
    })
    .join('\n')

export const normalizeExtractedUrl = (url: string): string =>
  url
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/[)\],.;!?]+$/g, '')

export const extractLinksInputUrls = (content: string): string[] => {
  const searchableContent = stripLinksInputComments(content)
  const urls: string[] = []
  const seen = new Set<string>()
  const addUrl = (rawUrl: string): void => {
    const url = normalizeExtractedUrl(rawUrl)
    if (!/^(?:blob:)?https?:\/\/\S+$/i.test(url)) return
    if (seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }

  for (const match of searchableContent.matchAll(/(?:blob:)?https?:\/\/[^\s<>"'`]+/gi)) {
    addUrl(match[0])
  }

  return urls
}

export const readLinksInputFile = async (inputFilePath: string): Promise<string[]> => {
  const inputFile = Bun.file(inputFilePath)
  const exists = await inputFile.exists()
  if (!exists) {
    throw UsageError(`Links input file not found: ${inputFilePath}`)
  }

  let content: string
  try {
    content = await inputFile.text()
  } catch (error) {
    throw UsageError(
      `Failed to read links input file ${inputFilePath}: ${formatErrorMessage(error)}`,
      { cause: error }
    )
  }

  if (content.trim().length === 0) {
    throw UsageError(`Links input file is empty: ${inputFilePath}`)
  }

  const urls = extractLinksInputUrls(content)
  if (urls.length === 0) {
    throw UsageError(`No valid remote URLs found in links input file: ${inputFilePath}`)
  }

  return urls
}
