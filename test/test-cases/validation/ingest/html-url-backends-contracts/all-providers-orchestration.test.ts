import { expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { readBatchManifest, readRunManifest, writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { writeUrlRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-manifest'
import { resumeUrlArticleTarget } from '~/cli/commands/setup-and-utilities/resume/extract/url-resume'
import {
  buildAbortError,
  buildMockArticle,
  buildOptsFromFlags,
  HOSTED_URL_ARTICLE_BACKENDS,
  htmlDocument,
  join,
  makeTempDir,
  processUrlArticle,
  URL_ARTICLE_BACKENDS,
  URL_ARTICLE_PROVIDER_ADAPTERS,
  writeFile
} from './shared'
import type { HtmlArticleBackend, UrlRequestOptions } from './shared'

test('--all-providers URL orchestrator writes provider artifacts and a multi-provider run manifest', async () => {
  const tempRoot = await makeTempDir('autoshow-all-url-')

  try {
    const seenOptions = new Map<HtmlArticleBackend, UrlRequestOptions | undefined>()
    for (const backend of URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl, options) => {
        seenOptions.set(backend, options)
        return buildMockArticle(backend, source, sourceUrl)
      }
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'url-request-timeout-ms': '25000',
      'url-request-attempts': '2'
    })
    const output = await processUrlArticle('https://article.test/story.html', tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'result.json')).exists()).toBe(false)
    expect(await Bun.file(join(output.outputDir, 'extraction.txt')).exists()).toBe(false)

    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      const providerDir = join(output.outputDir, 'providers', backend)
      const extractionText = await Bun.file(join(providerDir, 'extraction.txt')).text()
      const providerResult = await Bun.file(join(providerDir, 'result.json')).json() as Record<string, unknown>

      expect(extractionText).toContain(`${backend} Article`)
      expect(providerResult).toMatchObject({
        schemaVersion: 2,
        kind: 'provider-result',
        provider: backend,
        model: backend
      })
      expect(providerResult['result']).toMatchObject({
        text: expect.stringContaining(`${backend} Article`)
      })
    }

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      kind: string
      metadata: {
        extractRoute: string
        completionStatus: string
        requestedProviders: Array<{ service: string, model: string }>
        providerStates: Array<{ service: string, model: string, status: string }>
        step2: unknown[]
        resolvedStep2: { providers: Array<{ service: string, model: string }> }
      }
    }

    expect(manifest.kind).toBe('extract')
    expect(manifest.metadata.extractRoute).toBe('article')
    expect(manifest.metadata.completionStatus).toBe('full')
    expect(manifest.metadata.requestedProviders).toEqual(
      HOSTED_URL_ARTICLE_BACKENDS.map((backend) => ({ service: backend, model: backend }))
    )
    expect(manifest.metadata.providerStates.map((state) => state.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded'
    ])
    expect(manifest.metadata.step2).toHaveLength(HOSTED_URL_ARTICLE_BACKENDS.length)
    expect(manifest.metadata.resolvedStep2.providers.map((provider) => provider.service)).toEqual([...HOSTED_URL_ARTICLE_BACKENDS])
    expect(manifest.metadata.resolvedStep2.providers).toEqual(manifest.metadata.requestedProviders)
    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'result.json')).exists()).toBe(false)
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      expect(seenOptions.get(backend)).toMatchObject({
        timeoutMs: 25000,
        requestAttempts: 2
      })
    }
    expect(seenOptions.has('defuddle')).toBe(false)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('--all-providers plus --all-local URL orchestrator preserves the full backend set', async () => {
  const tempRoot = await makeTempDir('autoshow-all-url-combined-')

  try {
    for (const backend of URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl) =>
        buildMockArticle(backend, source, sourceUrl)
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'all-local-url': true
    })
    const output = await processUrlArticle('https://article.test/all.html', tempRoot, opts)
    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        requestedProviders: Array<{ service: string, model: string }>
        resolvedStep2: { providers: Array<{ service: string, model: string }> }
      }
    }

    expect(manifest.metadata.requestedProviders).toEqual(
      URL_ARTICLE_BACKENDS.map((backend) => ({ service: backend, model: backend }))
    )
    expect(manifest.metadata.resolvedStep2.providers.map((provider) => provider.service)).toEqual([...URL_ARTICLE_BACKENDS])
    expect(manifest.metadata.resolvedStep2.providers).toEqual(manifest.metadata.requestedProviders)
    for (const backend of URL_ARTICLE_BACKENDS) {
      expect(await Bun.file(join(output.outputDir, 'providers', backend, 'result.json')).exists()).toBe(true)
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('--all-providers URL manifest records one exhausted failed URL provider without an actual-cost artifact', async () => {
  const tempRoot = await makeTempDir('autoshow-all-url-failed-provider-')
  const originalSleep = Bun.sleep

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl) =>
        buildMockArticle(backend, source, sourceUrl)
    }
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async () => {
      throw buildAbortError('Zyte request timed out after 25ms')
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'url-request-timeout-ms': '25',
      'url-request-attempts': '2'
    })
    const output = await processUrlArticle('https://article.test/partial.html', tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'providers', 'zyte', 'result.json')).exists()).toBe(false)
    expect(await Bun.file(join(output.outputDir, 'providers', 'firecrawl', 'result.json')).exists()).toBe(true)

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        completionStatus: string
        missingProviders: Array<{ service: string, model: string }>
        errors?: Array<{ service: string, model: string, message: string }>
        providerStates: Array<{ service: string, status: string, attempts: number, lastError?: { message: string } }>
        cost: { actual: { steps?: unknown[], totalCost: number } }
      }
    }

    expect(manifest.metadata.completionStatus).toBe('incomplete')
    expect(manifest.metadata.missingProviders).toEqual([{ service: 'zyte', model: 'zyte' }])
    expect(manifest.metadata.errors).toEqual([{
      service: 'zyte',
      model: 'zyte',
      message: expect.stringContaining('Zyte request failed after 2/2 attempts with 25ms timeout')
    }])
    expect(manifest.metadata.providerStates.find((state) => state.service === 'zyte')).toMatchObject({
      service: 'zyte',
      status: 'failed',
      attempts: 2,
      lastError: {
        message: expect.stringContaining('Zyte request timed out after 25ms')
      }
    })
    expect(manifest.metadata.cost.actual.steps?.some((step) =>
      typeof step === 'object' && step !== null && JSON.stringify(step).includes('zyte')
    )).toBe(false)
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('URL resume persists recovered provider state to the batch manifest', async () => {
  const tempRoot = await makeTempDir('autoshow-url-resume-batch-')
  const originalSleep = Bun.sleep

  try {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async (source, sourceUrl) =>
        buildMockArticle(backend, source, sourceUrl)
    }
    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async () => {
      throw buildAbortError('Zyte request timed out after 25ms')
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'url-request-timeout-ms': '25',
      'url-request-attempts': '2'
    }, [], {}, new Set(['all-url']))
    const output = await processUrlArticle('https://article.test/resume.html', tempRoot, opts)
    const runManifest = await readRunManifest(output.outputDir, 'extract')
    expect(runManifest?.metadata['completionStatus']).toBe('incomplete')

    const batchDir = join(tempRoot, 'batch')
    await mkdir(batchDir, { recursive: true })
    await writeBatchManifest(batchDir, 'extract', [{
      ...runManifest!.metadata,
      outputDir: output.outputDir
    }])

    URL_ARTICLE_PROVIDER_ADAPTERS.zyte.run = async (source, sourceUrl) =>
      buildMockArticle('zyte', source, sourceUrl)

    await resumeUrlArticleTarget({
      kind: 'extract',
      extractRoute: 'article',
      scope: 'batch',
      dir: batchDir,
      manifestPath: join(batchDir, 'batch.json')
    }, opts)

    const batchManifest = await readBatchManifest(batchDir, 'extract')
    expect(batchManifest?.manifest.items[0]?.['completionStatus']).toBe('full')
    expect(batchManifest?.manifest.items[0]?.['providerStates']).toEqual(
      expect.arrayContaining([expect.objectContaining({ service: 'zyte', status: 'succeeded' })])
    )
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalSleep
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('URL batch resume refuses to rewrite a pruned manifest', async () => {
  const tempRoot = await makeTempDir('autoshow-url-resume-refuse-prune-')

  try {
    const manifestPath = join(tempRoot, 'batch.json')
    const original = `${JSON.stringify({
      schemaVersion: 3,
      kind: 'extract',
      items: ['future-entry']
    }, null, 2)}\n`
    await Bun.write(manifestPath, original)

    await expect(resumeUrlArticleTarget({
      kind: 'extract',
      extractRoute: 'article',
      scope: 'batch',
      dir: tempRoot,
      manifestPath
    }, buildOptsFromFlags(false, {}))).rejects.toThrow(
      `Refusing to rewrite ${manifestPath}: manifest entry 1 is unparseable by this build.`
    )
    expect(await Bun.file(manifestPath).text()).toBe(original)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('URL resume exits 2 for a stored failed run with no resumable backends', async () => {
  const tempRoot = await makeTempDir('autoshow-url-resume-failed-')

  try {
    await writeUrlRunManifest(tempRoot, {
      resolvedStep2: {
        route: 'article',
        sourceKind: 'article',
        providers: [{ service: 'defuddle', model: 'defuddle' }]
      },
      completionStatus: 'failed',
      requestedProviders: [{ service: 'defuddle', model: 'defuddle' }],
      providerStates: [{
        service: 'defuddle',
        model: 'defuddle',
        artifactDir: 'providers/defuddle',
        status: 'skipped',
        attempts: 0
      }]
    })

    await expect(resumeUrlArticleTarget({
      kind: 'extract',
      extractRoute: 'article',
      scope: 'single',
      dir: tempRoot,
      manifestPath: join(tempRoot, 'run.json')
    }, buildOptsFromFlags(false, {}))).rejects.toMatchObject({
      exitCode: 2,
      stage: 'resume:url'
    })
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('--all-providers plus --all-local URL with local HTML runs defuddle and marks hosted backends skipped', async () => {
  const tempRoot = await makeTempDir('autoshow-local-all-url-')

  try {
    const localHtml = join(tempRoot, 'local-article.html')
    await writeFile(localHtml, htmlDocument)

    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async (source, sourceUrl) =>
      buildMockArticle('defuddle', source, sourceUrl)
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      URL_ARTICLE_PROVIDER_ADAPTERS[backend].run = async () => {
        throw new Error(`${backend} should not run for local HTML --all-providers`)
      }
    }

    const opts = buildOptsFromFlags(false, {
      'all-url': true,
      'all-local-url': true
    })
    const output = await processUrlArticle(localHtml, tempRoot, opts)

    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'result.json')).exists()).toBe(true)
    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'extraction.txt')).exists()).toBe(true)
    for (const backend of HOSTED_URL_ARTICLE_BACKENDS) {
      expect(await Bun.file(join(output.outputDir, 'providers', backend, 'result.json')).exists()).toBe(false)
      expect(await Bun.file(join(output.outputDir, 'providers', backend, 'extraction.txt')).exists()).toBe(false)
    }

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        completionStatus: string
        requestedProviders: Array<{ service: string, model: string }>
        resolvedStep2: { providers: Array<{ service: string, model: string }> }
        providerStates: Array<{ service: string, status: string }>
      }
    }

    expect(manifest.metadata.completionStatus).toBe('incomplete')
    expect(manifest.metadata.requestedProviders).toEqual(
      URL_ARTICLE_BACKENDS.map((backend) => ({ service: backend, model: backend }))
    )
    expect(manifest.metadata.resolvedStep2.providers.map((provider) => provider.service)).toEqual([...URL_ARTICLE_BACKENDS])
    expect(manifest.metadata.resolvedStep2.providers).toEqual(manifest.metadata.requestedProviders)
    expect(manifest.metadata.providerStates).toEqual([
      { service: 'defuddle', model: 'defuddle', artifactDir: 'providers/defuddle', status: 'succeeded', attempts: 1 },
      expect.objectContaining({ service: 'firecrawl', status: 'skipped' }),
      expect.objectContaining({ service: 'glm-reader', status: 'skipped' }),
      expect.objectContaining({ service: 'spider', status: 'skipped' }),
      expect.objectContaining({ service: 'supadata', status: 'skipped' }),
      expect.objectContaining({ service: 'zyte', status: 'skipped' })
    ])
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('local HTML with a single hosted URL provider still runs and records defuddle', async () => {
  const tempRoot = await makeTempDir('autoshow-local-single-url-')

  try {
    const localHtml = join(tempRoot, 'local-article.html')
    await writeFile(localHtml, htmlDocument)

    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async (source, sourceUrl) =>
      buildMockArticle('defuddle', source, sourceUrl)
    URL_ARTICLE_PROVIDER_ADAPTERS.firecrawl.run = async () => {
      throw new Error('firecrawl should not run for local HTML')
    }

    const opts = buildOptsFromFlags(false, {
      'url-provider': 'firecrawl'
    }, [], {}, new Set(['url-provider']))
    const output = await processUrlArticle(localHtml, tempRoot, opts)

    const manifest = await Bun.file(join(output.outputDir, 'run.json')).json() as {
      metadata: {
        completionStatus: string
        requestedProviders: Array<{ service: string, model: string }>
        resolvedStep2: {
          backend?: string
          backends?: string[]
          providers?: Array<{ service: string, model: string }>
        }
      }
    }

    expect(await Bun.file(join(output.outputDir, 'result.json')).exists()).toBe(true)
    expect(await Bun.file(join(output.outputDir, 'providers', 'defuddle', 'result.json')).exists()).toBe(false)
    expect(await Bun.file(join(output.outputDir, 'providers', 'firecrawl', 'result.json')).exists()).toBe(false)
    expect(manifest.metadata.completionStatus).toBe('full')
    expect(manifest.metadata.requestedProviders).toEqual([{ service: 'defuddle', model: 'defuddle' }])
    expect(manifest.metadata.resolvedStep2).toMatchObject({
      providers: [{ service: 'defuddle', model: 'defuddle' }]
    })
    // `providers` is the sole persisted backend record. The legacy `backend`/`backends`
    // keys were write-only and are no longer emitted; resume reconstructs the backend
    // set from `requestedProviders` instead.
    expect(manifest.metadata.resolvedStep2.backend).toBeUndefined()
    expect(manifest.metadata.resolvedStep2.backends).toBeUndefined()
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
