import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExtractHtmlToMarkdownInput, ExtractHtmlToMarkdownResult, UrlArticleProviderAdapter, UrlArticleRunResult, UrlRequestOptions, WebArticleMetadata } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { cleanString, countWords, ensureMeaningfulMarkdown, fallbackTitleFromSource, fetchRemoteHtml, getUrlRequestTimeoutMs, isRecord, isRemoteSource, normalizeMarkdown, readLocalHtml } from '../../url-utils'
import {
ensureDefuddleCliSetup,
formatDefuddleCliOutput,
runDefuddleCliCapture
} from './defuddle-cli'

const NON_HIDING_VARIANTS = 'before|after|placeholder|marker|selection|backdrop|file|first-letter|first-line|dark'
const NON_HIDING_HIDDEN_CLASS = new RegExp(
  `^(?:[\\w-]+:)*(?:${NON_HIDING_VARIANTS}):(?:[\\w-]+:)*(?:hidden|invisible)$`
)
const OPEN_STATE_REVEAL_CLASS = /\[state=open\][^\s:]*:(?:block|flex|grid|contents|visible|inline(?:-block|-flex|-grid)?)$/

// Defuddle drops any element whose class list has a token ending in `:hidden` or `:invisible`. Two Tailwind
// variant families leave the element visible in the default rendering, so their tokens are removed first:
// pseudo-element variants such as `before:hidden` hide only the pseudo-element, and `dark:hidden` marks the
// light-theme copy of a themed pair (its `hidden dark:block` twin is still dropped, so nothing is duplicated).
// Mistral's docs style every inline <code> and every code block this way.
//
// A bare `hidden` or `invisible` is also removed when the same class list reveals the element on `[state=open]`,
// as in `group-data-[state=open]/collapsible:block hidden`. That is a collapsed accordion body: documentation the
// reader expands, not chrome. Mistral's API reference keeps every request parameter list in one. Other states
// (`on`, `active`) are left alone because toggles and inactive tab panels would duplicate visible content.
export const stripNonHidingHiddenClasses = (html: string): string =>
  html.replace(/(\sclass\s*=\s*)(["'])([^"']*)\2/gi, (match, prefix: string, quote: string, value: string) => {
    const revealedWhenOpen = value.includes('[state=open]')
    if (!revealedWhenOpen && !value.includes(':hidden') && !value.includes(':invisible')) return match
    const tokens = value.split(/\s+/)
    const expands = revealedWhenOpen && tokens.some((token) => OPEN_STATE_REVEAL_CLASS.test(token))
    const kept = tokens.filter((token) =>
      !NON_HIDING_HIDDEN_CLASS.test(token) && !(expands && (token === 'hidden' || token === 'invisible'))
    )
    if (kept.length === tokens.length) return match
    return `${prefix}${quote}${kept.join(' ')}${quote}`
  })

export const extractHtmlToMarkdown = async (
  input: ExtractHtmlToMarkdownInput
): Promise<ExtractHtmlToMarkdownResult> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-defuddle-'))
  const tempHtmlPath = join(tempRoot, 'article.html')

  try {
    await Bun.write(tempHtmlPath, stripNonHidingHiddenClasses(input.html))

    const defuddleBin = await ensureDefuddleCliSetup()
    const result = await runDefuddleCliCapture(
      defuddleBin,
      ['parse', tempHtmlPath, '--markdown', '--json'],
      { allowFailure: true }
    )

    if (result.exitCode !== 0) {
      throw InfraError(`Defuddle CLI failed: ${formatDefuddleCliOutput(result)}`, { stage: 'extract:defuddle' })
    }

    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(result.stdout)
    } catch {
      throw ValidationError(`Defuddle CLI returned invalid JSON: ${formatDefuddleCliOutput(result)}`, { stage: 'extract:defuddle' })
    }

    if (!isRecord(parsedValue)) {
      throw ValidationError(`Defuddle CLI returned non-object JSON: ${formatDefuddleCliOutput(result)}`, { stage: 'extract:defuddle' })
    }

    const parsed = parsedValue
    const markdown = ensureMeaningfulMarkdown(
      normalizeMarkdown(parsed['contentMarkdown'] ?? parsed['content']),
      'defuddle'
    )
    const title = cleanString(parsed['title'])
    const author = cleanString(parsed['author'])

    return {
      markdown,
      web: buildDefuddleWebMetadata(input.sourceUrl, input.finalUrl, parsed, markdown),
      ...(title ? { title } : {}),
      ...(author ? { author } : {})
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const buildDefuddleWebMetadata = (
  sourceUrl: string | undefined,
  finalUrl: string | undefined,
  parsed: Record<string, unknown>,
  markdown: string
): WebArticleMetadata => {
  const web: WebArticleMetadata = {}
  const title = cleanString(parsed['title'])
  const author = cleanString(parsed['author'])
  const site = cleanString(parsed['site'])
  const published = cleanString(parsed['published'])
  const language = cleanString(parsed['language'])
  const description = cleanString(parsed['description'])

  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  web.wordCount = typeof parsed['wordCount'] === 'number' && Number.isFinite(parsed['wordCount'])
    ? parsed['wordCount']
    : countWords(markdown)
  if (description) web.description = description

  return web
}

const runDefuddleUrl = async (
  source: string,
  sourceUrl?: string,
  options?: UrlRequestOptions
): Promise<UrlArticleRunResult> => {
  if (isRemoteSource(source)) {
    const htmlInput = await fetchRemoteHtml(source, {
      timeoutMs: getUrlRequestTimeoutMs(options),
      signal: options?.requestSignal,
      providerLabel: 'Defuddle'
    })
    const extracted = await extractHtmlToMarkdown({
      html: htmlInput.html,
      documentUrl: htmlInput.finalUrl,
      ...(sourceUrl ? { sourceUrl } : {}),
      finalUrl: htmlInput.finalUrl
    })

    return {
      markdown: extracted.markdown,
      web: extracted.web,
      fileSize: htmlInput.fileSize,
      title: extracted.title ?? fallbackTitleFromSource(source),
      ...(extracted.author ? { author: extracted.author } : {})
    }
  }

  const htmlInput = await readLocalHtml(source)
  const extracted = await extractHtmlToMarkdown({
    html: htmlInput.html,
    documentUrl: htmlInput.localFileUrl
  })

  return {
    markdown: extracted.markdown,
    web: extracted.web,
    fileSize: htmlInput.fileSize,
    title: extracted.title ?? fallbackTitleFromSource(source),
    ...(extracted.author ? { author: extracted.author } : {})
  }
}

export const defuddleArticleAdapter: UrlArticleProviderAdapter = {
  id: 'defuddle',
  displayName: 'Defuddle',
  run: runDefuddleUrl
}
