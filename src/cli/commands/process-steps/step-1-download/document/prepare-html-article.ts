import * as l from '~/utils/app-logger/app-logger'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { ensureDirectory } from '~/utils/cli-utils'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { validateData } from '~/utils/validate/validation'
import { DocumentMetadataSchema } from '~/types'
import { getUrlArticleProviderAdapter, runUrlArticleProvider } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import { fallbackTitleFromSource, formatErrorMessage, getLocalBaseName, isRemoteSource } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'
import { InfraError, serializeDiagnosticError } from '~/utils/error-handler'
import type { BatchChildRunContext, HtmlArticleBackend, PreparedDocument, UrlArticleRunResult, UrlRequestOptions } from '~/types'

export const buildArticleSlug = (
  source: string,
  fallbackTitle: string
): string => {
  if (!isRemoteSource(source)) {
    return getLocalBaseName(source)
  }

  try {
    const parsed = new URL(source)
    const host = parsed.hostname.replace(/^www\./, '')
    const pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })
      .map(segment => segment.replace(/\.[^.]+$/, ''))
      .filter(Boolean)

    const combined = [host, ...pathParts].join('-')
    const slug = sanitizeTitleSlug(combined, 180)
    if (slug.length > 0) {
      return slug
    }
  } catch {
  }

  return sanitizeTitleSlug(fallbackTitle, 180) || 'article'
}

export async function prepareHtmlArticle(
  source: string,
  outputDir: string,
  backend: HtmlArticleBackend,
  batchChildContext?: BatchChildRunContext,
  urlRunOptions?: UrlRequestOptions
): Promise<PreparedDocument> {
  const remote = isRemoteSource(source)
  let resolvedBackend = backend

  if (!remote) {
    if (backend !== 'defuddle') {
      l.warn(`Ignoring --url-provider ${backend} for local HTML inputs; using defuddle instead`, {
        category: 'pipeline',
        metadata: { requestedBackend: backend, resolvedBackend: 'defuddle' }
      })
    }
    resolvedBackend = 'defuddle'
  }

  const sourceUrl = remote ? source : undefined
  const articleStartedAt = Date.now()
  let article: UrlArticleRunResult

  if (resolvedBackend === 'defuddle') {
    if (remote) {
      try {
        article = await runUrlArticleProvider('defuddle', source, sourceUrl, urlRunOptions)
      } catch (defuddleError) {
        l.warn(`Defuddle article extraction failed; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`, {
          category: 'pipeline',
          metadata: { fallbackBackend: 'firecrawl' }, error: defuddleError
        })
        try {
          article = await runUrlArticleProvider('firecrawl', source, sourceUrl, urlRunOptions)
          resolvedBackend = 'firecrawl'
        } catch (firecrawlError) {
          throw InfraError(
            `Defuddle article extraction failed and Firecrawl fallback failed. ` +
            `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`,
            {
              stage: 'download:html-article',
              metadata: { defuddleError: serializeDiagnosticError(defuddleError) },
              ...(firecrawlError instanceof Error ? { cause: firecrawlError } : {})
            }
          )
        }
      }
    } else {
      article = await runUrlArticleProvider('defuddle', source, undefined, urlRunOptions)
    }
  } else {
    article = await runUrlArticleProvider(resolvedBackend, source, sourceUrl, urlRunOptions)
  }
  const htmlArticleProcessingTimeMs = Date.now() - articleStartedAt

  const step1Title = article.title ?? fallbackTitleFromSource(source)
  const step1Slug = buildArticleSlug(remote ? (article.web.finalUrl ?? source) : source, step1Title)
  const step1Metadata = validateData(DocumentMetadataSchema, {
    ...(step1Title ? { title: step1Title } : {}),
    slug: step1Slug,
    ...(article.author ? { author: article.author } : {}),
    pageCount: 1,
    format: 'html',
    fileSize: article.fileSize
  }, 'html article metadata')

  const effectiveBaseDir = outputDir.trim().length > 0 ? outputDir : getOutputRoot()
  const preparedOutputDir = await reserveBatchChildOutputDir(batchChildContext, {
    slug: step1Slug,
    publishedAt: batchChildContext?.batchItem?.publishedAt ?? normalizeBatchChildPublishedAt(article.web.published),
    fallbackLabel: step1Title || step1Slug || 'article'
  }) ?? resolveRunDirectory(effectiveBaseDir, step1Title || step1Slug || 'article', 'article')
  await ensureDirectory(preparedOutputDir)

  return {
    outputDir: preparedOutputDir,
    step1Metadata,
    preparedMarkdown: article.markdown,
    htmlArticleProcessingTimeMs,
    htmlArticleBackend: resolvedBackend,
    web: article.web
  }
}

export const getHtmlArticleBackendDisplayName = (backend: HtmlArticleBackend): string =>
  getUrlArticleProviderAdapter(backend).displayName
