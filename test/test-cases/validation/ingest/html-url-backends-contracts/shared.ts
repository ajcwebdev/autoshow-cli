import { afterEach, beforeEach } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  runUrlArticleProviderWithStats,
  URL_ARTICLE_PROVIDER_ADAPTERS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import { processUrlArticle } from '~/cli/commands/process-steps/step-2-extract/step-2-url/process-url'
import { runOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/run-ocr'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import { runGlmReaderUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/glm-reader/run-glm-reader-url'
import { runSpiderUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/spider/run-spider-url'
import { runSupadataUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/url-supadata/run-supadata-url'
import { runZyteUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/zyte/run-zyte-url'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import type { DocumentMetadata, ExtractionOptions, HtmlArticleBackend, UrlArticleProviderAdapter, UrlArticleRunResult, UrlRequestOptions } from '~/types'
import { DEFAULT_URL_REQUEST_TIMEOUT_MS } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'

export const originalFetch = globalThis.fetch
export const envKeys = [
  'FIRECRAWL_API_KEY',
  'GLM_API_KEY',
  'SPIDER_API_KEY',
  'SUPADATA_API_KEY',
  'ZYTE_API_KEY',
  'AUTOSHOW_DEFUDDLE_ARGS_LOG',
  'AUTOSHOW_FAKE_DEFUDDLE_MODE',
  'AUTOSHOW_FAKE_DEFUDDLE_STDERR'
] as const
let previousEnv = new Map<string, string | undefined>()
export const originalBinDir = getConfiguredBinDir()
export const originalAdapterRuns = new Map<HtmlArticleBackend, UrlArticleProviderAdapter['run']>(
  URL_ARTICLE_BACKENDS.map((backend) => [backend, URL_ARTICLE_PROVIDER_ADAPTERS[backend].run])
)
export const tempDirs: string[] = []

export const longMarkdown = 'This article contains enough meaningful markdown content for the URL backend extraction contract to pass without reaching any hosted provider.'
export const htmlDocument = `<!doctype html>
<html>
  <head>
    <title>Moved Backend Article</title>
    <meta name="description" content="Backend extraction fixture">
  </head>
  <body>
    <article>
      <h1>Moved Backend Article</h1>
      <p>${longMarkdown}</p>
    </article>
  </body>
</html>`

beforeEach(() => {
  previousEnv = new Map(envKeys.map(key => [key, process.env[key]]))
  for (const key of envKeys) {
    delete process.env[key]
  }
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  for (const backend of URL_ARTICLE_BACKENDS) {
    const originalRun = originalAdapterRuns.get(backend)
    if (originalRun) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = originalRun
    }
  }
  for (const key of envKeys) {
    const originalValue = previousEnv.get(key)
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
  configureBinDir(originalBinDir ?? '')
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

export const buildMockArticle = (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined
): UrlArticleRunResult => {
  const markdown = `# ${backend} Article\n\n${longMarkdown} Mock provider ${backend} returned canonical URL article markdown for comparison.`
  return {
    markdown,
    title: `${backend} Article`,
    fileSize: markdown.length,
    web: {
      sourceUrl: sourceUrl ?? source,
      finalUrl: sourceUrl ? `https://article.test/final/${backend}` : `file://${source}`,
      title: `${backend} Article`,
      wordCount: markdown.split(/\s+/).filter(Boolean).length
    }
  }
}

export const buildAbortError = (message: string): Error => {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export const writeFakeDefuddleBin = async (): Promise<{ bin: string, argsLog: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-fake-defuddle-'))
  tempDirs.push(dir)
  const bin = join(dir, 'defuddle')
  const argsLog = join(dir, 'args.log')

  await writeFile(bin, [
    '#!/usr/bin/env bun',
    "import { appendFileSync, readFileSync } from 'node:fs'",
    'const args = process.argv.slice(2)',
    "if (args[0] === '--version') { console.log('0.17.0'); process.exit(0) }",
    "const logPath = process.env.AUTOSHOW_DEFUDDLE_ARGS_LOG",
    "if (logPath) appendFileSync(logPath, JSON.stringify(args) + '\\n')",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR) console.error(process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR)",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_MODE === 'nonzero') { console.log('partial stdout before failure'); console.error('fake defuddle failed'); process.exit(7) }",
    "if (process.env.AUTOSHOW_FAKE_DEFUDDLE_MODE === 'invalid-json') { console.log('{not valid json'); process.exit(0) }",
    "const sourcePath = args[1] ?? ''",
    "const html = sourcePath ? readFileSync(sourcePath, 'utf8') : ''",
    "const markdown = '# CLI Defuddle Article\\n\\nThis fake defuddle output includes enough meaningful markdown content from the CLI fixture. ' + (html.includes('Moved Backend Article') ? 'Moved Backend Article.' : 'Generic Article.')",
    "console.log(JSON.stringify({ contentMarkdown: markdown, content: 'SHOULD_NOT_USE_CONTENT', title: 'CLI Title', author: 'CLI Author', site: 'CLI Site', published: '2026-05-01T00:00:00Z', language: 'en', description: 'CLI description', wordCount: 88 }))"
  ].join('\n'))
  await chmod(bin, 0o755)

  configureBinDir(dir)
  process.env['AUTOSHOW_DEFUDDLE_ARGS_LOG'] = argsLog

  return { bin, argsLog }
}
export {
  buildOptsFromFlags,
  chmod,
  DEFAULT_URL_REQUEST_TIMEOUT_MS,
  extractHtmlToMarkdown,
  HOSTED_URL_ARTICLE_BACKENDS,
  join,
  mkdtemp,
  processUrlArticle,
  rm,
  runFirecrawlUrl,
  runGlmReaderUrl,
  runOcr,
  runSpiderUrl,
  runSupadataUrl,
  runUrlArticleProviderWithStats,
  runZyteUrl,
  tmpdir,
  URL_ARTICLE_BACKENDS,
  URL_ARTICLE_PROVIDER_ADAPTERS,
  writeFile
}

export type {
  DocumentMetadata,
  ExtractionOptions,
  HtmlArticleBackend,
  UrlArticleProviderAdapter,
  UrlArticleRunResult,
  UrlRequestOptions
}
