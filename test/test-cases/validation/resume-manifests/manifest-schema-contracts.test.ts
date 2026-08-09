import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import {
  parseProviderResult,
  readBatchManifest,
  readExtractBatchManifest,
  readProviderResultEntry,
  readRunManifest,
  readRunManifestOutcome,
  readVersionedManifest,
  writeBatchManifest,
  writeExtractBatchManifest
} from '~/cli/commands/process-steps/manifest-utils'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { readOcrRunManifestEntry, writeOcrBatchManifest, writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-manifest'
import { readSttProviderCheckpoint, readSttRunManifestEntry, writeSttBatchManifest, writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'
import { readUrlRunManifestEntry, writeUrlRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-manifest'
import { runExtractTranscriptVideo } from '~/cli/commands/process-steps/step-2-extract/transcript-video/run-transcript-video'

const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('manifest schema contracts', () => {
  test('versioned manifest reads distinguish missing, invalid, unsupported, and valid envelopes', async () => {
    await withTempDir('autoshow-versioned-manifest-reader-', async (dir) => {
      const runPath = join(dir, 'run.json')
      expect(await readRunManifestOutcome(dir, 'extract')).toMatchObject({
        status: 'missing',
        manifestPath: runPath,
        supportedVersion: 3
      })

      await Bun.write(runPath, JSON.stringify({ kind: 'extract', metadata: {} }))
      expect(await readRunManifestOutcome(dir, 'extract')).toMatchObject({ status: 'invalid' })

      await Bun.write(runPath, JSON.stringify({ schemaVersion: 2, kind: 'extract', metadata: {} }))
      expect(await readRunManifestOutcome(dir, 'extract')).toMatchObject({
        status: 'unsupported-version',
        foundVersion: 2,
        supportedVersion: 3
      })

      await Bun.write(runPath, JSON.stringify({ schemaVersion: 3, kind: 'image', metadata: {} }))
      expect(await readRunManifestOutcome(dir, 'extract')).toMatchObject({ status: 'invalid' })

      await Bun.write(runPath, JSON.stringify({ schemaVersion: 3, kind: 'extract', metadata: { marker: true } }))
      expect(await readRunManifestOutcome(dir, 'extract')).toMatchObject({
        status: 'ok',
        manifest: { schemaVersion: 3, kind: 'extract', metadata: { marker: true } }
      })

      await Bun.write(runPath, '{')
      await expect(readRunManifestOutcome(dir, 'extract')).rejects.toThrow()
    })
  })

  test('canonical provider-result parsing can tolerate omitted metadata only when requested', async () => {
    await withTempDir('autoshow-provider-result-parser-', async (dir) => {
      const resultPath = join(dir, 'result.json')
      const envelope = {
        schemaVersion: 2,
        kind: 'provider-result',
        provider: 'fixture',
        model: 'fixture-model',
        result: { text: 'Hello.' }
      }
      await Bun.write(resultPath, JSON.stringify(envelope))

      expect(parseProviderResult(envelope)).toBeUndefined()
      expect(parseProviderResult(envelope, { lenientMetadata: true })).toMatchObject({
        metadata: {},
        result: { text: 'Hello.' }
      })
      expect(await readVersionedManifest(
        resultPath,
        'provider-result',
        (raw) => parseProviderResult(raw, { lenientMetadata: true })
      )).toMatchObject({ status: 'ok' })
    })
  })

  test('provider result and checkpoint readers reject unsupported envelope versions', async () => {
    await withTempDir('autoshow-old-provider-envelopes-', async (dir) => {
      const resultDir = join(dir, 'result')
      const checkpointDir = join(dir, 'checkpoint')
      await Promise.all([
        mkdir(resultDir, { recursive: true }),
        mkdir(checkpointDir, { recursive: true })
      ])
      await Bun.write(join(resultDir, 'result.json'), JSON.stringify({
        schemaVersion: 1,
        kind: 'provider-result',
        provider: 'fixture',
        metadata: {},
        result: {}
      }))
      await Bun.write(join(checkpointDir, 'checkpoint.json'), JSON.stringify({
        schemaVersion: 1,
        kind: 'provider-checkpoint',
        provider: 'fixture',
        metadata: {}
      }))

      await expect(readProviderResultEntry(resultDir)).rejects.toThrow('found schemaVersion 1')
      await expect(readSttProviderCheckpoint(checkpointDir)).rejects.toThrow('found schemaVersion 1')
    })
  })

  test('transcript-video reports unsupported extract manifests instead of misclassifying the directory', async () => {
    await withTempDir('autoshow-transcript-video-old-manifest-', async (dir) => {
      const runPath = join(dir, 'run.json')
      await Bun.write(runPath, JSON.stringify({
        schemaVersion: 1,
        kind: 'extract',
        metadata: { extractRoute: 'media' }
      }))

      await expect(runExtractTranscriptVideo(dir, {})).rejects.toThrow(
        `Unsupported manifest version at ${runPath}: found schemaVersion 1, but this build supports schemaVersion 3. Old runs are not resumable with this build — re-run the pipeline.`
      )
    })
  })

  test('STT, OCR, and URL manifest writers serialize extract kind with extractRoute metadata', async () => {
    await withTempDir('autoshow-extract-run-manifests-', async (dir) => {
      const mediaRunDir = join(dir, 'media-run')
      const documentRunDir = join(dir, 'document-run')
      const mediaBatchDir = join(dir, 'media-batch')
      const documentBatchDir = join(dir, 'document-batch')
      const articleRunDir = join(dir, 'article-run')
      await Promise.all([
        mkdir(mediaRunDir, { recursive: true }),
        mkdir(documentRunDir, { recursive: true }),
        mkdir(articleRunDir, { recursive: true }),
        mkdir(mediaBatchDir, { recursive: true }),
        mkdir(documentBatchDir, { recursive: true })
      ])

      await writeSttRunManifest(mediaRunDir, { extractRoute: 'document', marker: 'media' })
      await writeOcrRunManifest(documentRunDir, { extractRoute: 'media', marker: 'document' })
      await writeUrlRunManifest(articleRunDir, { extractRoute: 'document', marker: 'article' })
      await writeSttBatchManifest(mediaBatchDir, [{ input: 'audio.mp3', completionStatus: 'full' }])
      await writeOcrBatchManifest(documentBatchDir, [{ input: 'document.pdf', completionStatus: 'full' }])

      const mediaRun = await readRunManifest(mediaRunDir)
      const documentRun = await readRunManifest(documentRunDir)
      const articleRun = await readRunManifest(articleRunDir)
      const mediaBatch = await readBatchManifest(mediaBatchDir, 'extract')
      const documentBatch = await readBatchManifest(documentBatchDir, 'extract')

      expect(mediaRun?.kind).toBe('extract')
      expect(mediaRun?.metadata['extractRoute']).toBe('media')
      expect(documentRun?.kind).toBe('extract')
      expect(documentRun?.metadata['extractRoute']).toBe('document')
      expect(articleRun?.kind).toBe('extract')
      expect(articleRun?.metadata['extractRoute']).toBe('article')
      expect(await readSttRunManifestEntry(mediaRunDir)).toMatchObject({ extractRoute: 'media', marker: 'media' })
      expect(await readOcrRunManifestEntry(mediaRunDir)).toBeUndefined()
      expect(await readOcrRunManifestEntry(documentRunDir)).toMatchObject({ extractRoute: 'document', marker: 'document' })
      expect(await readSttRunManifestEntry(documentRunDir)).toBeUndefined()
      expect(await readUrlRunManifestEntry(articleRunDir)).toMatchObject({ extractRoute: 'article', marker: 'article' })
      expect(await readUrlRunManifestEntry(documentRunDir)).toBeUndefined()
      expect(mediaBatch?.manifest.kind).toBe('extract')
      expect(mediaBatch?.manifest.items[0]?.['extractRoute']).toBe('media')
      expect(documentBatch?.manifest.kind).toBe('extract')
      expect(documentBatch?.manifest.items[0]?.['extractRoute']).toBe('document')
      expect(await Bun.file(join(mediaBatchDir, 'stt-summary.json')).exists()).toBe(true)
    })
  })

  test('route-based extract batch manifests are accepted by resume handlers', async () => {
    await withTempDir('autoshow-extract-route-resume-', async (dir) => {
      const mediaDir = join(dir, 'media')
      const documentDir = join(dir, 'document')
      const mediaOutputDir = join(dir, 'media-output')
      const documentOutputDir = join(dir, 'document-output')
      await Promise.all([
        mkdir(mediaDir, { recursive: true }),
        mkdir(documentDir, { recursive: true }),
        mkdir(mediaOutputDir, { recursive: true }),
        mkdir(documentOutputDir, { recursive: true })
      ])

      await writeBatchManifest(mediaDir, 'extract', [{
        input: 'https://ajc.pics/autoshow/examples/1-audio.mp3',
        extractRoute: 'media',
        outputDir: mediaOutputDir,
        completionStatus: 'full',
        step1: { url: 'file:///tmp/autoshow-audio.mp3' },
        step2: { transcriptionService: 'whisper', transcriptionModel: 'tiny' },
        requestedProviders: [{ service: 'whisper', model: 'tiny', local: true }],
        providerStates: [{
          service: 'whisper',
          model: 'tiny',
          local: true,
          status: 'succeeded',
          artifactDir: 'providers/whisper-tiny',
          attempts: 1
        }]
      }])
      await writeBatchManifest(documentDir, 'extract', [{
        input: 'input/examples/document/1-document.pdf',
        extractRoute: 'document',
        outputDir: documentOutputDir,
        completionStatus: 'full',
        source: { filePath: '/tmp/autoshow-document.pdf' },
        requestedProviders: [{ service: 'tesseract', model: 'tesseract' }],
        providerStates: [{
          service: 'tesseract',
          model: 'tesseract',
          status: 'succeeded',
          artifactDir: 'providers/tesseract',
          attempts: 1
        }]
      }])
      await writeExtractBatchManifest(dir, {
        schemaVersion: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        childBatches: {
          media: 'media',
          document: 'document'
        },
        items: [
          {
            input: 'https://ajc.pics/autoshow/examples/1-audio.mp3',
            inputFamily: 'media',
            extractRoute: 'media',
            childBatchEntry: { route: 'media', index: 0 },
            completionStatus: 'full',
            outputDir: 'media-output'
          },
          {
            input: 'input/examples/document/1-document.pdf',
            inputFamily: 'document',
            extractRoute: 'document',
            childBatchEntry: { route: 'document', index: 0 },
            completionStatus: 'full',
            outputDir: 'document-output'
          }
        ]
      })

      const handler = getResumeHandler('extract')
      expect(handler).toBeDefined()
      if (!handler) {
        return
      }

      const opts = buildOptsFromFlags(false, {})
      await expect(handler.hasResumableWork({
        kind: 'extract',
        scope: 'batch',
        dir,
        manifestPath: join(dir, 'extract-batch.json')
      }, opts, new Set())).resolves.toBe(false)
      await expect(handler.hasResumableWork({
        kind: 'extract',
        extractRoute: 'media',
        scope: 'batch',
        dir: mediaDir,
        manifestPath: join(mediaDir, 'batch.json')
      }, opts, new Set())).resolves.toBe(false)
      await expect(handler.hasResumableWork({
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir: documentDir,
        manifestPath: join(documentDir, 'batch.json')
      }, opts, new Set())).resolves.toBe(false)
    })
  })

  test('parent extract resume synchronizes URL child batch completion', async () => {
    await withTempDir('autoshow-extract-url-resume-sync-', async (dir) => {
      const urlBatchDir = join(dir, 'article')
      const urlOutputDir = join(dir, 'url-output')
      await Promise.all([
        mkdir(urlBatchDir, { recursive: true }),
        mkdir(urlOutputDir, { recursive: true })
      ])

      const firecrawl = { service: 'firecrawl', model: 'firecrawl' }
      await writeUrlRunManifest(urlOutputDir, {
        resolvedStep2: {
          route: 'article',
          sourceKind: 'article',
          providers: [firecrawl]
        },
        completionStatus: 'full',
        requestedProviders: [firecrawl],
        providerStates: [{
          ...firecrawl,
          artifactDir: 'providers/firecrawl',
          status: 'succeeded',
          attempts: 1
        }]
      })
      await writeBatchManifest(urlBatchDir, 'extract', [{
        input: 'https://article.test/story.html',
        inputFamily: 'html_article',
        extractRoute: 'article',
        outputDir: urlOutputDir,
        completionStatus: 'incomplete',
        requestedProviders: [firecrawl]
      }])
      await writeExtractBatchManifest(dir, {
        schemaVersion: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        childBatches: { article: 'article' },
        items: [{
          input: 'https://article.test/story.html',
          inputFamily: 'html_article',
          extractRoute: 'article',
          childBatchEntry: { route: 'article', index: 0 },
          completionStatus: 'incomplete',
          outputDir: 'url-output'
        }]
      })

      const handler = getResumeHandler('extract')
      expect(handler).toBeDefined()
      if (!handler) {
        return
      }

      const opts = buildOptsFromFlags(
        false,
        { 'url-provider': 'firecrawl' },
        [],
        {},
        new Set(['url-provider'])
      )
      await handler.resume({
        kind: 'extract',
        scope: 'batch',
        dir,
        manifestPath: join(dir, 'extract-batch.json')
      }, opts, new Set(['url-provider']))

      const childManifest = await readBatchManifest(urlBatchDir, 'extract')
      const parentManifest = await readExtractBatchManifest(dir)
      expect(childManifest?.manifest.items[0]?.['completionStatus']).toBe('full')
      expect(parentManifest?.manifest.items[0]?.completionStatus).toBe('full')
    })
  })

  test('parent extract resume refuses to prune unparseable manifest entries', async () => {
    await withTempDir('autoshow-extract-refuse-prune-', async (dir) => {
      const handler = getResumeHandler('extract')
      expect(handler).toBeDefined()
      if (!handler) {
        return
      }

      const cases = [
        {
          name: 'unknown-input-family',
          item: {
            input: 'future.input',
            inputFamily: 'future_family',
            completionStatus: 'full',
            outputDir: 'future-output'
          }
        },
        {
          name: 'unknown-extract-route',
          item: {
            input: 'https://article.test/future.html',
            inputFamily: 'html_article',
            extractRoute: 'future-route',
            completionStatus: 'full',
            outputDir: 'future-output'
          }
        }
      ] as const

      for (const fixture of cases) {
        const batchDir = join(dir, fixture.name)
        const manifestPath = join(batchDir, 'extract-batch.json')
        await mkdir(batchDir, { recursive: true })
        const original = `${JSON.stringify({
          schemaVersion: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          childBatches: {},
          items: [fixture.item]
        }, null, 2)}\n`
        await Bun.write(manifestPath, original)

        const explicitFlags = new Set(['url-provider'])
        await expect(handler.resume({
          kind: 'extract',
          scope: 'batch',
          dir: batchDir,
          manifestPath
        }, buildOptsFromFlags(false, { 'url-provider': 'firecrawl' }, [], {}, explicitFlags), explicitFlags)).rejects.toThrow(
          `Refusing to rewrite ${manifestPath}: manifest entry 1 is unparseable by this build.`
        )
        expect(await Bun.file(manifestPath).text()).toBe(original)
      }
    })
  })
})
