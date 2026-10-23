import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compactArchive, discoverArchiveRuns, isRunDirectory } from '../../../../.codex/skills/consensus/scripts/shared/compact_archive'
import { compactRunResults } from '../../../../.codex/skills/consensus/scripts/stt/compact_provider_results'
import { deriveCanonicalItemRecord, readCanonicalManifest, type PipelineManifest } from '../../../../.codex/skills/consensus/scripts/shared/pipeline_manifest'
import { loadOcrProviderRuns } from '../../../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'
import { runSyncCommand } from '~/utils/sync-subprocess'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tracker = createTempDirTracker('autoshow-compact-archive-')
afterEach(tracker.cleanup)

const runner = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')

test('compact-results keeps whisper rawResponse and drops whisperfile rawResponse', async () => {
  const root = await tracker.make()
  const bulky = {
    text: 'hello',
    segments: [{ start: '00:00:00', end: '00:00:01', text: 'hello' }],
    evidence: {
      words: [{ word: 'hello', start: 0, end: 1 }],
      segments: [{ startSeconds: 0, endSeconds: 1, text: 'hello' }],
      rawResponse: { bulky: true },
      capabilities: { hasSpeakerLabels: false },
      timingQuality: 'ok',
    },
  }
  for (const name of ['whisper-tiny', 'whisperfile-tiny']) {
    const providerDir = join(root, 'providers', name)
    mkdirSync(providerDir, { recursive: true })
    writeFileSync(join(providerDir, 'result.json'), `${JSON.stringify(bulky)}\n`)
  }

  const stats = compactRunResults(root)
  expect(stats.map((stat) => stat.directoryName).sort()).toEqual(['whisper-tiny', 'whisperfile-tiny'])
  const byName = Object.fromEntries(stats.map((stat) => [stat.directoryName, stat]))
  expect(byName['whisper-tiny']?.keptRawResponse).toBe(true)
  expect(byName['whisper-tiny']?.droppedRawResponse).toBe(false)
  expect(byName['whisperfile-tiny']?.keptRawResponse).toBe(false)
  expect(byName['whisperfile-tiny']?.droppedRawResponse).toBe(true)

  const whisper = JSON.parse(readFileSync(join(root, 'providers', 'whisper-tiny', 'result.json'), 'utf8')) as {
    evidence: Record<string, unknown>
  }
  const whisperfile = JSON.parse(readFileSync(join(root, 'providers', 'whisperfile-tiny', 'result.json'), 'utf8')) as {
    evidence: Record<string, unknown>
  }
  expect(whisper.evidence['rawResponse']).toEqual({ bulky: true })
  expect(whisperfile.evidence['rawResponse']).toBeUndefined()
})

function writeRun(root: string, name: string): string {
  const runDir = join(root, name)
  const providerDir = join(runDir, 'providers', 'deepgram-nova-3')
  mkdirSync(join(providerDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001'), { recursive: true })
  mkdirSync(join(providerDir, 'page-inputs'), { recursive: true })
  const result = {
    text: 'hello',
    segments: [{ start: '00:00:00', end: '00:00:01', text: 'hello' }],
    evidence: {
      words: [{ word: 'hello', start: 0, end: 1 }],
      segments: [{ startSeconds: 0, endSeconds: 1, text: 'hello' }],
      rawResponse: { bulky: true },
      capabilities: { hasSpeakerLabels: false },
      timingQuality: 'ok',
    },
  }
  writeFileSync(join(providerDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(join(providerDir, 'transcription.txt'), '[00:00:00] hello\n')
  writeFileSync(join(providerDir, 'transcription.words.json'), `${JSON.stringify([{ word: 'hello' }])}\n`)
  writeFileSync(join(providerDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(join(providerDir, 'page-inputs', 'page-000001.png'), 'png')
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify({
    command: 'extract',
    scope: 'single',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    items: [{
      extractRoute: 'media',
      outputDir: name,
      status: 'full',
      metadata: { step1: { durationSeconds: 1 } },
      providers: [{
        service: 'deepgram',
        model: 'nova-3',
        artifactDir: 'providers/deepgram-nova-3',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: { tokenCount: 1 },
        result,
      }],
    }],
  }, null, 2)}\n`)
  return runDir
}

function writeOcrRun(root: string, name: string): string {
  const runDir = join(root, name)
  const succeededDir = join(runDir, 'providers', 'openai-gpt-6-luna')
  const failedDir = join(runDir, 'providers', 'openai-gpt-6.1-sol')
  mkdirSync(join(succeededDir, 'page-results'), { recursive: true })
  mkdirSync(join(failedDir, 'page-results'), { recursive: true })
  const result = {
    pages: [{ pageNumber: 1, method: 'ocr', text: 'ARGUMENT OF THE FIRST BOOK.' }],
    extractionMethod: 'openai-ocr',
    ocrService: 'openai',
    ocrModel: 'gpt-6-luna',
    totalPages: 1,
  }
  writeFileSync(join(succeededDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(join(succeededDir, 'extraction.txt'), 'ARGUMENT OF THE FIRST BOOK.\n')
  writeFileSync(join(succeededDir, 'fallback-state.json'), `${JSON.stringify({ version: 2, terminalReason: 'completed' }, null, 2)}\n`)
  writeFileSync(join(succeededDir, 'partial-extraction.txt'), 'ARGUMENT OF THE FIRST BOOK.\n')
  writeFileSync(join(succeededDir, 'page-results', 'page-000001.json'), `${JSON.stringify({ pageNumber: 1, run: result }, null, 2)}\n`)
  writeFileSync(join(succeededDir, 'page-results', 'page-000001.txt'), 'ARGUMENT OF THE FIRST BOOK.\n')
  writeFileSync(join(failedDir, 'error.json'), `${JSON.stringify({ error: 'invalid structured response' }, null, 2)}\n`)
  writeFileSync(join(failedDir, 'fallback-state.json'), `${JSON.stringify({ version: 2, terminalReason: 'failed' }, null, 2)}\n`)
  writeFileSync(join(failedDir, 'partial-extraction.txt'), 'Page 1\npartial\n')
  writeFileSync(join(failedDir, 'page-results', 'page-000001.json'), `${JSON.stringify({ pageNumber: 1 }, null, 2)}\n`)
  writeFileSync(join(failedDir, 'page-results', 'page-000002-invalid-response.txt'), 'not json\n')
  writeFileSync(join(runDir, 'page-metrics.json'), `${JSON.stringify({
    schemaVersion: 1,
    runDir,
    providers: [{
      providerKey: 'openai/gpt-6-luna',
      directoryName: 'openai-gpt-6-luna',
      resultPath: join(succeededDir, 'result.json'),
    }],
    pages: [],
  }, null, 2)}\n`)
  writeFileSync(join(runDir, 'outliers.json'), `${JSON.stringify({
    schemaVersion: 1,
    runDir,
    blankOutputPages: [],
  }, null, 2)}\n`)
  writeFileSync(join(runDir, 'selective-adjudication-pages.json'), `${JSON.stringify({
    schemaVersion: 1,
    pageCount: 1,
    pages: [],
  }, null, 2)}\n`)
  writeFileSync(join(runDir, 'variant-comparison-summary.json'), `${JSON.stringify({
    schemaVersion: 1,
    runDir,
    variants: [],
  }, null, 2)}\n`)
  writeFileSync(join(runDir, 'provider-comparison-report.json'), `${JSON.stringify({
    schemaVersion: 2,
    kind: 'ocr-provider-comparison',
    runDir,
    consensusExtractionPath: join(runDir, 'consensus-extraction.txt'),
    providerCount: 1,
  }, null, 2)}\n`)
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify({
    command: 'extract',
    scope: 'single',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    items: [{
      extractRoute: 'file',
      outputDir: name,
      status: 'partial',
      metadata: {},
      providers: [{
        service: 'openai',
        model: 'gpt-6-luna',
        artifactDir: 'providers/openai-gpt-6-luna',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {},
        result,
      }, {
        service: 'openai',
        model: 'gpt-6.1-sol',
        artifactDir: 'providers/openai-gpt-6.1-sol',
        status: 'failed',
        attempts: 1,
        options: {},
        metadata: {},
      }],
    }],
  }, null, 2)}\n`)
  return runDir
}

function writeOcrMetadataRun(root: string, name: string, edit?: (manifest: PipelineManifest) => void): string {
  const runDir = join(root, name)
  const providerMetadata = [
    { totalPages: 1, processingTime: 120, tokenEstimate: { input: 100, output: 10 }, pageEvidence: [{ page: 1, usage: { input: 100, output: 10 } }] },
    { totalPages: 1, processingTime: 240, tokenEstimate: { input: 200, output: 20 }, pageEvidence: [{ page: 1, usage: { input: 200, output: 20 } }] },
  ]
  const manifest: PipelineManifest = {
    command: 'extract', scope: 'single', createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
    source: { kind: 'synthetic-test-evidence', originalHash: 'unchanged' },
    items: [{
      extractRoute: 'document', outputDir: '.', status: 'incomplete',
      metadata: {
        step2: structuredClone([...providerMetadata].reverse()),
        cost: { actual: { totalCost: 3, steps: [
          { provider: 'openai', model: 'model-a', cost: 1 }, { provider: 'gemini', model: 'model-b', cost: 2 },
        ] } },
        timing: { actual: { steps: [
          { provider: 'openai', model: 'model-a', processingTimeMs: 120 },
          { provider: 'gemini', model: 'model-b', processingTimeMs: 240 },
        ] } },
      },
      providers: [
        { service: 'openai', model: 'model-a', artifactDir: 'providers/openai-model-a', status: 'succeeded', attempts: 1, options: {}, metadata: providerMetadata[0]! },
        { service: 'gemini', model: 'model-b', artifactDir: 'providers/gemini-model-b', status: 'succeeded', attempts: 1, options: {}, metadata: providerMetadata[1]! },
        { service: 'grok', model: 'model-c', artifactDir: 'providers/grok-model-c', status: 'failed', attempts: 1, options: {},
          metadata: { retainedReservationCents: 5, nativeFinishReason: 'length' }, error: { message: 'output limit', receiptId: 'preserved-proof' } },
      ],
    }],
  }
  edit?.(manifest)
  for (const provider of manifest.items[0]!.providers) {
    const dir = join(runDir, provider.artifactDir)
    mkdirSync(dir, { recursive: true })
    if (provider.status === 'succeeded') {
      const text = 'SYNTHETIC OCR DOCUMENT'
      writeFileSync(join(dir, 'result.json'), JSON.stringify({ text, pages: [{ pageNumber: 1, method: 'ocr', text }], totalPages: 1 }, null, 2))
      writeFileSync(join(dir, 'extraction.txt'), text + '\n')
    } else {
      mkdirSync(join(dir, 'page-results'), { recursive: true })
      writeFileSync(join(dir, 'page-results', 'page-000001-invalid-response.txt'), 'preserved invalid response\n')
      writeFileSync(join(dir, 'error.json'), JSON.stringify(provider.error ?? { message: 'synthetic failure' }, null, 2))
    }
  }
  writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return runDir
}

describe('consensus compact-archive', () => {
  test('deduplicates reordered OCR step2 copies while canonical readers, prices, timings and failed evidence stay equivalent', async () => {
    const root = await tracker.make()
    const dir = writeOcrMetadataRun(root, 'synthetic-document')
    const before = readCanonicalManifest(dir)
    const beforeRecord = deriveCanonicalItemRecord(dir, before.items[0]!)
    const beforeRuns = loadOcrProviderRuns(dir)
    const failurePath = join(dir, 'providers/grok-model-c/error.json')
    const failure = readFileSync(failurePath, 'utf8')

    const stats = compactArchive(root)
    const after = readCanonicalManifest(dir)
    expect(stats[0]?.strippedManifestStep2).toBe(1)
    expect(stats[0]!.manifestBytesAfter).toBeLessThan(stats[0]!.manifestBytesBefore)
    expect(after.items[0]!.metadata['step2']).toBeUndefined()
    expect(deriveCanonicalItemRecord(dir, after.items[0]!)).toEqual(beforeRecord)
    expect(loadOcrProviderRuns(dir)).toEqual(beforeRuns)
    expect(after.items[0]!.providers).toEqual(before.items[0]!.providers)
    expect(after.source).toEqual(before.source)
    expect(after.items[0]!.metadata['cost']).toEqual(before.items[0]!.metadata['cost'])
    expect(after.items[0]!.metadata['timing']).toEqual(before.items[0]!.metadata['timing'])
    expect(readFileSync(failurePath, 'utf8')).toBe(failure)
    expect(readFileSync(join(dir, 'providers/grok-model-c/page-results/page-000001-invalid-response.txt'), 'utf8')).toBe('preserved invalid response\n')
    expect(readFileSync(join(dir, 'providers/openai-model-a/extraction.txt'), 'utf8')).toBe('SYNTHETIC OCR DOCUMENT\n')

    const firstBytes = readFileSync(join(dir, 'manifest.json'), 'utf8')
    expect(compactArchive(root)[0]?.strippedManifestStep2).toBe(0)
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(firstBytes)
  })

  test('preserves unique, mismatched, incomplete and failed-only step2 evidence', async () => {
    const root = await tracker.make()
    const edits: Array<(manifest: PipelineManifest) => void> = [
      manifest => { manifest.items[0]!.metadata['step2'] = [{ uniqueEvidence: 'keep' }] },
      manifest => { manifest.items[0]!.metadata['step2'] = [manifest.items[0]!.providers[0]!.metadata, manifest.items[0]!.providers[0]!.metadata] },
      manifest => { manifest.items[0]!.metadata['step2'] = [manifest.items[0]!.providers[0]!.metadata] },
      manifest => { for (const provider of manifest.items[0]!.providers) provider.status = 'failed' },
      manifest => { for (const provider of manifest.items[0]!.providers) provider.metadata = {}; manifest.items[0]!.metadata['step2'] = [{}] },
    ]
    const before = edits.map((edit, index) => {
      const dir = writeOcrMetadataRun(root, `preserve-${index}`, edit)
      return { dir, manifest: readCanonicalManifest(dir) }
    })
    const stats = compactArchive(root)
    expect(stats.every(stat => stat.strippedManifestStep2 === 0)).toBe(true)
    for (const row of before) expect(readCanonicalManifest(row.dir)).toEqual(row.manifest)
  })

  test('preserves step2 in non-document and non-extract manifests', async () => {
    const root = await tracker.make()
    const edits: Array<(manifest: PipelineManifest) => void> = [
      manifest => { manifest.command = 'image' },
      manifest => { manifest.items[0]!.extractRoute = 'media' },
      manifest => { manifest.items[0]!.extractRoute = 'file' },
    ]
    const before = edits.map((edit, index) => {
      const dir = writeOcrMetadataRun(root, `other-${index}`, edit)
      return { dir, manifest: readCanonicalManifest(dir) }
    })
    expect(compactArchive(root).every(stat => stat.strippedManifestStep2 === 0)).toBe(true)
    for (const row of before) expect(readCanonicalManifest(row.dir)).toEqual(row.manifest)
  })

  test('public OCR archive command reports deduplication and its compacted run still builds a packet', async () => {
    const root = await tracker.make()
    const dir = writeOcrMetadataRun(root, 'synthetic-document')
    const compact = runSyncCommand('bun', [runner, 'ocr', 'compact-archive', root])
    expect(compact.exitCode).toBe(0)
    expect(compact.stdout).toContain('duplicate OCR step2 copies removed: 1')
    const packet = runSyncCommand('bun', [runner, 'ocr', 'build-packet', dir, '--out', join(root, 'packet.json')])
    expect(packet.exitCode).toBe(0)
    const result = JSON.parse(readFileSync(join(root, 'packet.json'), 'utf8')) as { providerStats: unknown[] }
    expect(result.providerStats).toHaveLength(2)
    const second = runSyncCommand('bun', [runner, 'ocr', 'compact-archive', root])
    expect(second.exitCode).toBe(0)
    expect(second.stdout).toContain('duplicate OCR step2 copies removed: 0')
  })

  test('refuses a single run directory', async () => {
    const root = await tracker.make()
    const runDir = writeRun(root, '1-audio')
    expect(isRunDirectory(runDir)).toBe(true)
    expect(() => discoverArchiveRuns(runDir)).toThrow(/refuses a single run directory/)

    const result = runSyncCommand('bun', [runner, 'stt', 'compact-archive', runDir])
    expect(result.exitCode).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('refuses a single run directory')
    expect(existsSync(join(runDir, 'providers', 'deepgram-nova-3', 'split-attempts'))).toBe(true)
  })

  test('compacts every run under an archive root and prunes derived trees', async () => {
    const root = await tracker.make()
    writeRun(root, 'run-a')
    writeRun(root, 'run-b')

    const result = runSyncCommand('bun', [runner, 'stt', 'compact-archive', root])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Compacted 2 run directories')

    for (const name of ['run-a', 'run-b']) {
      const runDir = join(root, name)
      const resultPayload = JSON.parse(readFileSync(join(runDir, 'providers', 'deepgram-nova-3', 'result.json'), 'utf8')) as {
        evidence: Record<string, unknown>
      }
      expect(resultPayload.evidence['words']).toBeUndefined()
      expect(resultPayload.evidence['segments']).toBeUndefined()
      expect(resultPayload.evidence['rawResponse']).toBeUndefined()
      expect(resultPayload.evidence['timingQuality']).toBe('ok')
      expect(existsSync(join(runDir, 'providers', 'deepgram-nova-3', 'transcription.txt'))).toBe(true)
      expect(existsSync(join(runDir, 'providers', 'deepgram-nova-3', 'transcription.words.json'))).toBe(false)

      const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8')) as {
        items: Array<{ providers: Array<{ result?: unknown }> }>
      }
      expect(manifest.items[0]?.providers[0]?.result).toBeUndefined()
      expect(existsSync(join(runDir, 'providers', 'deepgram-nova-3', 'split-attempts'))).toBe(false)
      expect(existsSync(join(runDir, 'providers', 'deepgram-nova-3', 'page-inputs'))).toBe(false)
    }
  })

  test('compacts image-style runs that have a manifest but no providers directory', async () => {
    const root = await tracker.make()
    const runDir = join(root, '2026-05-21_image-gen')
    mkdirSync(runDir, { recursive: true })
    writeFileSync(join(runDir, 'generated-image.png'), 'png')
    writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify({
      command: 'image',
      scope: 'single',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      items: [{
        outputDir: '2026-05-21_image-gen',
        status: 'full',
        metadata: { image: { prompt: 'a cat' } },
        providers: [{
          service: 'openai',
          model: 'gpt-image-2.5-flare',
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1,
          options: {},
          metadata: {},
        }],
      }],
    }, null, 2)}\n`)

    expect(isRunDirectory(runDir)).toBe(true)
    const result = runSyncCommand('bun', [runner, 'image', 'compact-archive', root])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Compacted 1 run directory')
    expect(existsSync(join(runDir, 'generated-image.png'))).toBe(true)
    const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8')) as {
      items: Array<{ providers: Array<{ result?: unknown }> }>
    }
    expect(manifest.items[0]?.providers[0]?.result).toBeUndefined()
  })

  test('discovers nested category roots under docs/benchmarks-style parents', async () => {
    const root = await tracker.make()
    writeRun(join(root, 'stt/with-speakers'), '1-audio')
    writeRun(join(root, 'text/ocr'), '01-book')

    const runs = discoverArchiveRuns(root)
    expect(runs.map((path) => path.slice(root.length + 1)).sort()).toEqual([
      'stt/with-speakers/1-audio',
      'text/ocr/01-book',
    ])

    const stats = compactArchive(root)
    expect(stats).toHaveLength(2)
    expect(stats.every((stat) => stat.strippedManifestResults === 1)).toBe(true)
    expect(stats.every((stat) => stat.prunedDirectories.length === 2)).toBe(true)
    expect(stats.every((stat) => stat.prunedFiles.includes('providers/deepgram-nova-3/transcription.words.json'))).toBe(true)
  })

  test('prunes OCR page-results after result.json exists and keeps failed-provider checkpoints', async () => {
    const root = await tracker.make()
    writeOcrRun(root, '05-pages-sample-document')

    const result = runSyncCommand('bun', [runner, 'ocr', 'compact-archive', root])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Compacted 1 run directory')

    const succeededDir = join(root, '05-pages-sample-document', 'providers', 'openai-gpt-6-luna')
    const failedDir = join(root, '05-pages-sample-document', 'providers', 'openai-gpt-6.1-sol')
    expect(existsSync(join(succeededDir, 'result.json'))).toBe(true)
    expect(existsSync(join(succeededDir, 'extraction.txt'))).toBe(true)
    expect(existsSync(join(succeededDir, 'page-results'))).toBe(false)
    expect(existsSync(join(succeededDir, 'fallback-state.json'))).toBe(false)
    expect(existsSync(join(succeededDir, 'partial-extraction.txt'))).toBe(false)
    expect(existsSync(join(failedDir, 'result.json'))).toBe(false)
    expect(existsSync(join(failedDir, 'page-results', 'page-000001.json'))).toBe(true)
    expect(existsSync(join(failedDir, 'page-results', 'page-000002-invalid-response.txt'))).toBe(true)
    expect(existsSync(join(failedDir, 'fallback-state.json'))).toBe(true)
    expect(existsSync(join(failedDir, 'partial-extraction.txt'))).toBe(true)
    expect(existsSync(join(failedDir, 'error.json'))).toBe(true)

    const runDir = join(root, '05-pages-sample-document')
    const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8')) as {
      items: Array<{ providers: Array<{ result?: unknown }> }>
    }
    expect(manifest.items[0]?.providers[0]?.result).toBeUndefined()
    expect(manifest.items[0]?.providers[1]?.result).toBeUndefined()

    const pageMetricsRaw = readFileSync(join(runDir, 'page-metrics.json'), 'utf8')
    expect(pageMetricsRaw).not.toContain('\n  ')
    const pageMetrics = JSON.parse(pageMetricsRaw) as {
      runDir: string
      providers: Array<{ resultPath: string }>
    }
    expect(pageMetrics.runDir).toBe('.')
    expect(pageMetrics.providers[0]?.resultPath).toBe('providers/openai-gpt-6-luna/result.json')
    const report = JSON.parse(readFileSync(join(runDir, 'provider-comparison-report.json'), 'utf8')) as {
      runDir: string
      consensusExtractionPath: string
    }
    expect(report.runDir).toBe('.')
    expect(report.consensusExtractionPath).toBe('consensus-extraction.txt')
  })

  test('prunes STT split-attempts after result.json exists and keeps failed-provider checkpoints', async () => {
    const root = await tracker.make()
    const runDir = join(root, '1-audio')
    const succeededDir = join(runDir, 'providers', 'deepgram-nova-3')
    const failedDir = join(runDir, 'providers', 'soniox-stt-async-v5')
    mkdirSync(join(succeededDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001'), { recursive: true })
    mkdirSync(join(failedDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001'), { recursive: true })
    const result = {
      text: 'hello',
      segments: [{ start: '00:00:00', end: '00:00:01', text: 'hello' }],
      evidence: { capabilities: { hasSpeakerLabels: true }, timingQuality: 'native_word' },
    }
    writeFileSync(join(succeededDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
    writeFileSync(join(succeededDir, 'transcription.txt'), '[00:00:00] [speaker-1] hello\n')
    writeFileSync(join(succeededDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
    writeFileSync(join(failedDir, 'error.json'), `${JSON.stringify({ error: 'timeout' }, null, 2)}\n`)
    writeFileSync(join(failedDir, 'raw-response.json'), `${JSON.stringify({ job: 'pending' }, null, 2)}\n`)
    writeFileSync(join(failedDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
    writeFileSync(join(failedDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'transcription.txt'), '[00:00:00] hello\n')
    writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify({
      command: 'extract',
      scope: 'single',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      items: [{
        extractRoute: 'media',
        outputDir: '1-audio',
        status: 'partial',
        metadata: { step1: { durationSeconds: 1 } },
        providers: [{
          service: 'deepgram',
          model: 'nova-3',
          artifactDir: 'providers/deepgram-nova-3',
          status: 'succeeded',
          attempts: 1,
          options: {},
          metadata: {},
          result,
        }, {
          service: 'soniox',
          model: 'stt-async-v5',
          artifactDir: 'providers/soniox-stt-async-v5',
          status: 'failed',
          attempts: 1,
          options: {},
          metadata: {},
        }],
      }],
    }, null, 2)}\n`)

    const command = runSyncCommand('bun', [runner, 'stt', 'compact-archive', root])
    expect(command.exitCode).toBe(0)
    expect(existsSync(join(succeededDir, 'result.json'))).toBe(true)
    expect(existsSync(join(succeededDir, 'transcription.txt'))).toBe(true)
    expect(existsSync(join(succeededDir, 'split-attempts'))).toBe(false)
    expect(existsSync(join(failedDir, 'result.json'))).toBe(false)
    expect(existsSync(join(failedDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'result.json'))).toBe(true)
    expect(existsSync(join(failedDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', 'transcription.txt'))).toBe(true)
    expect(existsSync(join(failedDir, 'error.json'))).toBe(true)
    expect(existsSync(join(failedDir, 'raw-response.json'))).toBe(true)
  })
})
