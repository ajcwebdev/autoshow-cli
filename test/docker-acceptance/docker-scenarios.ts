import { expect } from 'bun:test'
import { requireCondition } from '../test-utils/require-condition'
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { SUPPORTED_WHISPERFILE_MODELS } from '../../src/cli/commands/setup-and-utilities/models/stt-models'
import { selectCheapestDefaultLlmSelection } from '../../src/cli/commands/setup-and-utilities/models/cheapest-models'
import { derivePipelineItemRecord } from '../../src/cli/commands/command-shared/pipeline-manifest'
import type { OcrE2eExtractMetadata, PipelineManifest } from '../../src/types'
import { assertSttExtractRun } from '../test-utils/assert-stt-extract-run'
import { artifactExists, assertArtifact, assertContains, assertDownloadOnly, assertDownloadRecord, assertRejection, downloadScenarios, PUBLIC_DOWNLOADS, rejectionScenarios, DOWNLOAD_TIMESTAMPED_CHILD_DIR_PATTERN } from '../scenarios/local-cli-contracts'
import type { CliOutcome, LocalExecutionAdapter } from '../scenarios/local-cli-contracts'
import { containerFixture, FIXTURE_ORIGIN } from './docker-fixtures'
import type { DockerOptions, Suite } from './docker-options'

export const MODEL_SELECTORS = [
  'whisperfile:tiny', 'whisperfile:tiny.en', 'whisperfile:small', 'whisperfile:small.en',
] as const
export type ModelSelector = typeof MODEL_SELECTORS[number]
export interface DockerScenario {
  id: string
  suite: Exclude<Suite, 'all'>
  network: 'none' | 'fixture' | 'public'
  model?: ModelSelector
  provision?: 'defuddle'
  args: string[]
  verify(adapter: LocalExecutionAdapter, outcome: CliOutcome): Promise<void>
}

function outputDirectory(result: CliOutcome): string {
  expect(result.exitCode, result.stderr).toBe(0)
  requireCondition(result.outputDir, 'Expected an output directory with a canonical manifest')
  return result.outputDir
}

// Keep persisted evidence unchanged. Map paths only in the in-memory inspection view.
export async function mappedManifest(adapter: LocalExecutionAdapter, dir: string): Promise<PipelineManifest> {
  const raw: unknown = await Bun.file(join(dir, 'manifest.json')).json()
  function map(value: unknown): unknown {
    if (typeof value === 'string' && /^\/(results|fixtures|app\/runtime|home\/bun)(\/|$)/.test(value)) return adapter.hostPath(value)
    if (Array.isArray(value)) return value.map(map)
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, map(child)]))
    return value
  }
  const manifest = map(raw) as PipelineManifest
  requireCondition(Array.isArray(manifest.items) && manifest.items.length > 0, 'Manifest has no items')
  return manifest
}

export async function mappedRecord(adapter: LocalExecutionAdapter, dir: string): Promise<Record<string, unknown>> {
  const manifest = await mappedManifest(adapter, dir)
  expect(manifest.scope).toBe('single')
  expect(manifest.items.length).toBe(1)
  expect(manifest.items[0]!.status).toBe('full')
  return derivePipelineItemRecord(dir, manifest.items[0]!)
}

function downloadCases(): DockerScenario[] {
  const urls = { ...PUBLIC_DOWNLOADS, audio: `${FIXTURE_ORIGIN}/speech.mp3`, video: `${FIXTURE_ORIGIN}/speech.mp4` }
  return downloadScenarios(containerFixture, urls, `${FIXTURE_ORIGIN}/feed.xml`).filter(scenario => scenario.kind !== 'youtube').map(scenario => ({
    id: scenario.id,
    suite: scenario.kind === 'twitch' ? 'network' : 'core',
    network: scenario.kind === 'twitch' ? 'public' : scenario.id.startsWith('download-local') ? 'none' : 'fixture',
    args: ['download', scenario.input, ...scenario.args],
    async verify(adapter, result) {
      const dir = outputDirectory(result)
      const manifest = await mappedManifest(adapter, dir)
      expect(manifest.command).toBe('download')
      if (scenario.batch) {
        expect(manifest.scope).toBe('batch')
        expect(manifest.source?.['sourceKind']).toBe(scenario.kind)
        expect(manifest.source?.['selectedCount']).toBe(1)
        expect(manifest.items.length).toBe(1)
        const children = (await readdir(dir, { withFileTypes: true })).filter(entry => entry.isDirectory())
        expect(children.length, 'Unexpected batch child directory count').toBe(manifest.items.length)
        const child = manifest.items[0]!
        expect(child.status).toBe('full')
        requireCondition(child.outputDir)
        const childDir = join(dir, child.outputDir) // relative manifests are canonical; absolute paths handled below
        const resolved = child.outputDir.startsWith('/') ? child.outputDir : childDir
        requireCondition(!DOWNLOAD_TIMESTAMPED_CHILD_DIR_PATTERN.test(basename(resolved)), 'Batch child must not have a run timestamp')
        await assertArtifact(join(resolved, 'manifest.json'))
        const record = await mappedRecord(adapter, resolved)
        assertContains(derivePipelineItemRecord(dir, child), { ...record, outputDir: resolved })
        await assertDownloadRecord('audio', record, resolved)
        await assertDownloadOnly(resolved, record)
      } else {
        const record = await mappedRecord(adapter, dir)
        await assertDownloadRecord(scenario.kind, record, dir)
        await assertDownloadOnly(dir, record)
        if (scenario.id.startsWith('download-local')) assertContains(record, { step1: { slug: scenario.kind === 'pdf' ? 'document' : 'speech' } })
      }
    }
  }))
}

function ocrCases(): DockerScenario[] {
  const definitions = [
    { id: 'ocr-pdf-default', input: 'pdf', args: [] },
    { id: 'ocr-pdf-json', input: 'pdf', args: ['--format', 'json'] },
    { id: 'ocr-image-default', input: 'image', args: [] },
    { id: 'ocr-image-explicit', input: 'image', args: ['--provider', 'tesseract'] },
    { id: 'epub-text', input: 'epub', args: [] },
    { id: 'epub-chapters', input: 'epub', args: ['--length', '5'] },
    { id: 'epub-chunks', input: 'epub', args: ['--no-chapters', '--length', '1'] },
    { id: 'pdf-chapters', input: 'pdf', args: ['--chapters', '--format', 'json'] },
    { id: 'ocr-ignored-chapters', input: 'image', args: ['--chapters', '--format', 'json'] }
  ]
  return definitions.map(scenario => ({
    id: scenario.id, suite: 'core', network: 'none', args: ['extract', containerFixture(scenario.input), ...scenario.args],
    async verify(adapter, result) {
      const dir = outputDirectory(result)
      const manifest = await mappedManifest(adapter, dir)
      const metadata = await mappedRecord(adapter, dir) as OcrE2eExtractMetadata
      expect(manifest.command).toBe('extract')
      expect(manifest.items[0]?.extractRoute).toBe('document')
      const json = scenario.args.includes('json')
      if (json) await assertArtifact(join(dir, 'result.json'))
      else await assertArtifact(join(dir, 'extraction.txt'))
      if (json) await Bun.file(join(dir, 'result.json')).json()
      else expect(await Bun.file(join(dir, 'extraction.txt')).text()).toMatch(/synthetic/i)
      expect(await artifactExists(join(dir, json ? 'extraction.txt' : 'result.json'))).toBe(false)
      if (scenario.input === 'epub') {
        const text = await Bun.file(join(dir, 'extraction.txt')).text()
        requireCondition(!text.startsWith('Page 1\n'))
        requireCondition(text.includes('Chapter 1: Introduction to AutoShow'))
        assertContains(metadata, { resolvedStep2: { route: 'native-document', sourceKind: 'epub' }, requestedProviders: [], providerStates: [], missingProviders: [] })
        assertContains(metadata.step2, { extractionMethod: 'epub-text', outputFidelity: 'cleaned-epub-text' })
      } else {
        const sourceKind = scenario.input === 'pdf' ? 'pdf' : 'image'
        assertContains(metadata, {
          resolvedStep2: { route: 'ocr', sourceKind, providers: [{ service: 'tesseract', model: 'tesseract', origin: scenario.args.includes('--provider') ? 'explicit' : 'default' }] },
          requestedProviders: [{ service: 'tesseract', model: 'tesseract' }], missingProviders: [],
          providerStates: [{ service: 'tesseract', model: 'tesseract', artifactDir: '.', status: 'succeeded', attempts: 1 }]
        })
        if (sourceKind === 'image') expect(metadata.step2?.extractionMethod).toBe('image+tesseract')
      }
      if (scenario.input === 'epub' || scenario.id === 'pdf-chapters') {
        const chunks = scenario.id === 'epub-chunks'
        const name = chunks ? 'chunks' : 'chapters'
        const files = (await readdir(join(dir, name))).filter(file => file.endsWith('.txt')).sort()
        requireCondition(files.length >= (chunks ? 2 : 1), `Missing ${name}`)
        expect(await artifactExists(join(dir, chunks ? 'chapters' : 'chunks'))).toBe(false)
        assertContains(metadata.step2?.chapterExport, { sourceFormat: scenario.input, mode: name, directories: [name] })
        if (scenario.id === 'epub-chapters' || chunks) expect(metadata.step2?.chapterExport?.chunkLimitChars).toBe(chunks ? 1000 : 5000)
        if (scenario.input === 'epub' && !chunks) {
          requireCondition((metadata.step2?.chapterExport?.logicalChapterCount ?? 0) > 0)
          expect(metadata.step2?.chapterExport?.logicalChapterSource ?? '').toMatch(/^(toc|spine|heading)$/)
          requireCondition((await Bun.file(join(dir, name, files[0]!)).text()).startsWith('Chapter 1:'))
        }
        if (scenario.id === 'pdf-chapters') requireCondition((metadata.step2?.pdfChapterDetection?.chapters?.length ?? 0) > 0)
      }
      if (scenario.id === 'ocr-ignored-chapters') {
        requireCondition(`${result.stdout}\n${result.stderr}`.includes('Chapter export flags (--chapters, --no-chapters, --length) are ignored for inputs other than EPUB and PDF.'))
        expect(await artifactExists(join(dir, 'chapters'))).toBe(false)
        expect(metadata.step2?.chapterExport).toBe(undefined)
      }
    }
  }))
}

function sttCase(id: string, selector: ModelSelector, args: string[], origin: 'default' | 'explicit', split = false): DockerScenario {
  const [service, model] = selector.split(':') as ['whisperfile', string]
  return {
    id, suite: 'models', network: 'none', model: selector, args,
    async verify(adapter, result) {
      const dir = outputDirectory(result)
      await assertSttExtractRun(dir, {
        transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
        target: { service, model, local: true, origin },
        modelMatch: { contains: `whisper-${model}.llamafile` },
        expectPrompt: true, resolvedStep2: true, providerStates: true,
        splitSegmentsDir: split ? 'split-attempts/pass_001/segments' : false
      }, path => mappedRecord(adapter, path))
      expect(await Bun.file(join(dir, 'transcription.txt')).text(), 'Known speech was not recognized').toMatch(/country|nation|americans/i)
      if (split) expect(`${result.stdout}\n${result.stderr}`).toMatch(/whisperfile STT segment \d+\/\d+ completed/)
    }
  }
}

function lyricCase(id: string, mode: 'captions' | 'tiny' | 'default' | 'batch'): DockerScenario {
  const batch = mode === 'batch'
  const args = ['music', batch ? '--batch' : '--audio', containerFixture(batch ? 'batch' : 'audio')]
  if (mode === 'captions') args.push('--captions', containerFixture('captions'))
  if (mode === 'tiny' || batch) args.push('--model', 'tiny')
  if (batch) args.push('--json')
  return {
    id, suite: mode === 'captions' ? 'core' : 'models', network: 'none', args,
    ...(mode === 'captions' ? {} : { model: mode === 'default' ? 'whisperfile:small.en' : 'whisperfile:tiny' }),
    async verify(adapter, result) {
      const dir = outputDirectory(result)
      const manifest = await mappedManifest(adapter, dir)
      expect(manifest.command).toBe('music')
      if (batch) {
        assertContains(JSON.parse(result.stdout), { type: 'result', status: 'success', data: { dryRun: false, metrics: { total: 2, succeeded: 2, failed: 0 } } })
        expect(manifest.scope).toBe('batch')
        expect(manifest.source?.['mode']).toBe('lyric-video')
        expect(manifest.items.map(item => basename(item.outputDir ?? '')).sort()).toStrictEqual(['01-batch-one', '02-batch-two'])
      }
      for (const item of manifest.items) {
        expect(item.status).toBe('full')
        const childDir = batch ? item.outputDir!.startsWith('/') ? item.outputDir! : join(dir, item.outputDir!) : dir
        const record = await mappedRecord(adapter, childDir)
        expect(record['mode']).toBe('lyric-video')
        const stem = batch ? basename(childDir) : mode === 'captions' ? 'speech-fixed' : 'speech'
        for (const ext of ['mp4', 'vtt', 'srt']) await assertArtifact(join(childDir, `${stem}.${ext}`))
        expect(await artifactExists(join(childDir, '.lyrics-tmp'))).toBe(false)
        const transcription = record['transcription'] as Record<string, unknown>
        expect(transcription['mode']).toBe(mode === 'captions' ? 'captions' : 'whisperfile')
        if (mode !== 'captions') {
          const model = mode === 'default' ? 'small.en' : 'tiny'
          expect(transcription['model']).toBe(model)
          requireCondition(String(transcription['descriptor']).includes(`whisper-${model}.llamafile`))
          requireCondition(Number(transcription['cueCount']) > 0)
        }
        const vtt = await Bun.file(join(childDir, `${stem}.vtt`)).text()
        requireCondition(vtt.includes('WEBVTT'))
        if (mode === 'captions') requireCondition(vtt.includes('short line one'))
        if (!batch) assertContains(record['render'], { backgroundMode: 'image' })
        assertContains(await adapter.probe(join(childDir, `${stem}.mp4`)), { codec_name: 'h264', width: 1920, height: 1080 })
      }
    }
  }
}

export function dockerScenarios(): DockerScenario[] {
  return [
    ...downloadCases(), ...ocrCases(),
    ...(['fixture', 'public'] as const).map((network): DockerScenario => ({
      id: `defuddle-${network}`, suite: network === 'public' ? 'network' : 'core', network, provision: 'defuddle',
      args: ['extract', network === 'public' ? PUBLIC_DOWNLOADS.article : `${FIXTURE_ORIGIN}/article.html`, '--provider', 'defuddle'],
      async verify(adapter, result) {
        const dir = outputDirectory(result)
        await assertArtifact(join(dir, 'extraction.txt'))
        assertContains(await mappedRecord(adapter, dir), {
          step1: { format: 'html' }, step2: { extractionMethod: 'html+defuddle' },
          resolvedStep2: { route: 'article', sourceKind: 'article', providers: [{ service: 'defuddle', model: 'defuddle' }] },
          requestedProviders: [{ service: 'defuddle', model: 'defuddle' }], missingProviders: []
        })
        if (network === 'fixture') requireCondition((await Bun.file(join(dir, 'extraction.txt')).text()).includes('blue sky'))
      }
    })),
    ...MODEL_SELECTORS.map(selector => sttCase(`stt-${selector.replace(':', '-')}`, selector, ['extract', containerFixture('audio'), '--provider', selector.replace(':', '=')], 'explicit')),
    sttCase('stt-default', 'whisperfile:tiny', ['extract', containerFixture('audio')], 'default'),
    sttCase('stt-whisperfile-default', 'whisperfile:tiny', ['extract', containerFixture('audio'), '--provider', 'whisperfile'], 'explicit'),
    sttCase('stt-split-audio', 'whisperfile:tiny', ['extract', containerFixture('audio'), '--provider', 'whisperfile=tiny', '--split'], 'explicit', true),
    sttCase('stt-split-video', 'whisperfile:tiny', ['extract', containerFixture('video'), '--provider', 'whisperfile=tiny', '--split'], 'explicit', true),
    lyricCase('lyrics-rerender', 'captions'), lyricCase('lyrics-explicit', 'tiny'), lyricCase('lyrics-default', 'default'), lyricCase('lyrics-batch', 'batch'),
    {
      id: 'write-default-price', suite: 'core', network: 'none', args: ['write', containerFixture('text'), '--price', '--json'],
      async verify(_adapter, result) {
        expect(result.exitCode, result.stderr).toBe(0)
        expect(result.outputDir).toBe(null)
        const cheapest = selectCheapestDefaultLlmSelection()
        const output = `${result.stdout}\n${result.stderr}`
        requireCondition(output.includes(cheapest.provider) && output.includes(cheapest.model), 'Price result did not resolve the cheapest default LLM')
        requireCondition(output.includes('"files"'), 'Missing price artifact plan')
        expect(await readdir(result.outputRoot).catch(() => []), 'Price mode wrote outputs').toStrictEqual([])
      }
    },
    ...rejectionScenarios(containerFixture).map((scenario): DockerScenario => ({
      id: scenario.id, suite: 'core', network: 'none', args: scenario.args,
      async verify(_adapter, result) { assertRejection(result, scenario) }
    }))
  ]
}

export function selectDockerScenarios(options: Pick<DockerOptions, 'suite' | 'model'>, all = dockerScenarios()): DockerScenario[] {
  const supported = ['tiny', 'tiny.en', 'small', 'small.en'].map(model => `whisperfile:${model}`).sort()
  expect<string[]>([...MODEL_SELECTORS].sort(), 'Supported local selectors changed; update acceptance scenarios and CI shards').toStrictEqual(supported)
  const registryRoot = resolve(import.meta.dir, '../../src/cli/commands/setup-and-utilities/models')
  const localModels: string[] = []
  for (const file of new Bun.Glob('**/*.json').scanSync({ cwd: registryRoot })) {
    const entries = JSON.parse(readFileSync(join(registryRoot, file), 'utf8')) as Record<string, { type?: string; models?: Record<string, unknown> }>
    for (const [provider, config] of Object.entries(entries)) {
      if (config?.type === 'local') for (const model of Object.keys(config.models ?? {})) localModels.push(`${provider}:${model}`)
    }
  }
  expect(localModels.sort(), 'Local model registry changed; add acceptance coverage').toStrictEqual([...SUPPORTED_WHISPERFILE_MODELS.map(model => `whisperfile:${model}`), 'defuddle:defuddle'].sort())
  requireCondition(all.some(scenario => scenario.id === 'ocr-image-explicit' && scenario.args.includes('tesseract')), 'Missing Tesseract coverage')
  requireCondition(all.some(scenario => scenario.id === 'defuddle-fixture'), 'Missing Defuddle coverage')
  expect(new Set(all.map(scenario => scenario.id)).size, 'Duplicate scenario IDs').toBe(all.length)
  for (const selector of MODEL_SELECTORS) requireCondition(all.some(scenario => scenario.id === `stt-${selector.replace(':', '-')}` && scenario.model === selector), `Missing inference coverage: ${selector}`)
  const selected = all.filter(scenario => (options.suite === 'all' || options.suite === scenario.suite) && (!options.model || scenario.model === options.model))
  requireCondition(selected.length > 0, `No scenarios selected for ${options.suite} ${options.model ?? ''}`)
  return selected
}
