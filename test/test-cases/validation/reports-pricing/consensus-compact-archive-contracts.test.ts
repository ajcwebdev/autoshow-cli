import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compactArchive, discoverArchiveRuns, isRunDirectory } from '../../../../.codex/skills/consensus/scripts/shared/compact_archive'
import { runSyncCommand } from '~/utils/sync-subprocess'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tracker = createTempDirTracker('autoshow-compact-archive-')
afterEach(tracker.cleanup)

const runner = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')

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
  const succeededDir = join(runDir, 'providers', 'kimi-kimi-k2.6')
  const failedDir = join(runDir, 'providers', 'kimi-kimi-k3')
  mkdirSync(join(succeededDir, 'page-results'), { recursive: true })
  mkdirSync(join(failedDir, 'page-results'), { recursive: true })
  const result = {
    pages: [{ pageNumber: 1, method: 'ocr', text: 'ARGUMENT OF THE FIRST BOOK.' }],
    extractionMethod: 'kimi-ocr',
    ocrService: 'kimi',
    ocrModel: 'kimi-k2.6',
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
      providerKey: 'kimi/kimi-k2.6',
      directoryName: 'kimi-kimi-k2.6',
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
        service: 'kimi',
        model: 'kimi-k2.6',
        artifactDir: 'providers/kimi-kimi-k2.6',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {},
        result,
      }, {
        service: 'kimi',
        model: 'kimi-k3',
        artifactDir: 'providers/kimi-kimi-k3',
        status: 'failed',
        attempts: 1,
        options: {},
        metadata: {},
      }],
    }],
  }, null, 2)}\n`)
  return runDir
}

describe('consensus compact-archive', () => {
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
          model: 'gpt-image-2',
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
    writeRun(join(root, 'stt-with-speakers'), '1-audio')
    writeRun(join(root, 'ocr'), '01-book')

    const runs = discoverArchiveRuns(root)
    expect(runs.map((path) => path.slice(root.length + 1)).sort()).toEqual([
      'ocr/01-book',
      'stt-with-speakers/1-audio',
    ])

    const stats = compactArchive(root)
    expect(stats).toHaveLength(2)
    expect(stats.every((stat) => stat.strippedManifestResults === 1)).toBe(true)
    expect(stats.every((stat) => stat.prunedDirectories.length === 2)).toBe(true)
    expect(stats.every((stat) => stat.prunedFiles.includes('providers/deepgram-nova-3/transcription.words.json'))).toBe(true)
  })

  test('prunes OCR page-results after result.json exists and keeps failed-provider checkpoints', async () => {
    const root = await tracker.make()
    writeOcrRun(root, '05-pages-the-odyssey')

    const result = runSyncCommand('bun', [runner, 'ocr', 'compact-archive', root])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Compacted 1 run directory')

    const succeededDir = join(root, '05-pages-the-odyssey', 'providers', 'kimi-kimi-k2.6')
    const failedDir = join(root, '05-pages-the-odyssey', 'providers', 'kimi-kimi-k3')
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

    const runDir = join(root, '05-pages-the-odyssey')
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
    expect(pageMetrics.providers[0]?.resultPath).toBe('providers/kimi-kimi-k2.6/result.json')
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
