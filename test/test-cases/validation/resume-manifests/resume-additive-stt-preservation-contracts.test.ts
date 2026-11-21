import { describe, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { resumeSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import type { MockFetchCall, ResumeTarget } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

// Additive STT resume over a compacted benchmark-style run: the stored audio lives outside the run
// (../../sources), provider results live in result.json sidecars, and one historical model is retired.
// Only the new AssemblyAI-STT-3.7 target is dispatched, through mocked fetch; nothing reaches a provider.

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ASSEMBLYAI_API_KEY'], tempPrefix: 'autoshow-stt-additive-preservation-', restoreBunSleep: true,
  beforeEachExtra: () => {
    process.env['ASSEMBLYAI_API_KEY'] = 'fixture'
    installMockFetch(() => { throw new Error('Unexpected unmocked provider request') })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const SOURCE_AUDIO = 'input/examples/audio/0-audio-short.mp3'
const NEW_TARGET = { service: 'assemblyai', model: 'assemblyai-stt-3-7' } as const
const STORED_PROMPT = '# Stored prompt\n\nWritten from the stored Deepgram transcript.\n'

type Json = Record<string, any>

const historical = [
  { service: 'deepgram', model: 'nova-3', dir: 'providers/deepgram-nova-3', cost: 0.0215, estimate: 0.02, ms: 1800, estimatedMs: 400 },
  { service: 'cloudflare', model: '@cf/deepgram/nova-3', dir: 'providers/cloudflare-@cf_deepgram_nova-3', cost: 0.0052, estimate: 0.005, ms: 2400, estimatedMs: 900 }
] as const

const settingsFor = (entry: typeof historical[number]) => ({
  schemaVersion: 1,
  settingsSchema: `${entry.service}.stt.v1`,
  request: { model: entry.model, diarization: { enabled: true } },
  local: { local: false, audioProfile: 'default', split: false, youtubeCaptions: false }
})

const step = (entry: typeof historical[number], field: 'cost' | 'processingTimeMs', value: number, extra: Json = {}) => ({
  step: 'stt', provider: entry.service, model: entry.model, [field]: value, inputMetric: 'durationSeconds', inputValue: 12.5, ...extra
})

const section = (field: 'cost' | 'processingTimeMs', pick: (entry: typeof historical[number]) => number, extra: Json = {}) => {
  const steps = historical.map(entry => step(entry, field, pick(entry), extra))
  return { [field === 'cost' ? 'totalCost' : 'totalProcessingTimeMs']: steps.reduce((sum, entry) => sum + (entry[field] as number), 0), steps }
}

const writeCompactedRun = async (root: string, storedSpeakerLabels = true): Promise<{ runDir: string, storedAudioPath: string }> => {
  const runDir = join(root, 'stt', 'run-a')
  const sourcePath = join(root, 'original', 'x.mp3')
  const storedAudioPath = join(root, 'sources', 'x.mp3')
  const audio = await Bun.file(SOURCE_AUDIO).bytes()
  await Bun.write(sourcePath, audio)
  await Bun.write(storedAudioPath, audio)
  await mkdir(runDir, { recursive: true })
  for (const entry of historical) {
    await Bun.write(join(runDir, entry.dir, 'result.json'), JSON.stringify({
      text: `Stored ${entry.service} transcript.`,
      segments: [{ start: '00:00:00', end: '00:00:02', text: `Stored ${entry.service} transcript.`, ...(storedSpeakerLabels ? { speaker: 'Speaker 1' } : {}) }]
    }, null, 2))
  }
  await Bun.write(join(runDir, 'prompt.md'), STORED_PROMPT)
  await writeSingleManifestFixture(runDir, 'extract', {
    step1: {
      title: 'x', duration: 'Unknown', channel: 'Unknown', description: '', url: pathToFileURL(sourcePath).href,
      slug: 'x', audioFileName: '../../sources/x.mp3', audioFileSize: audio.byteLength, durationSeconds: 12.5
    },
    resolvedStep2: { route: 'stt', sourceKind: 'media', providers: historical.map(({ service, model }) => ({ service, model, origin: 'explicit' })) },
    completionStatus: 'full',
    requestedProviders: historical.map(entry => ({
      service: entry.service, model: entry.model, local: false, diarizationOptions: { enabled: true }, settings: settingsFor(entry)
    })),
    providerStates: historical.map(entry => ({
      service: entry.service, model: entry.model, local: false, artifactDir: entry.dir, status: 'succeeded', attempts: 1,
      metadata: {
        transcriptionService: entry.service, transcriptionModel: entry.model, processingTime: entry.ms, tokenCount: 4,
        diarizationOptions: { enabled: true },
        hostedConcurrency: { provider: entry.service, limit: 4, maxInFlight: 2 }
      }
    })),
    missingProviders: [],
    cost: {
      estimated: section('cost', entry => entry.estimate, { costSource: 'estimated' }),
      observedEstimate: section('cost', entry => entry.estimate, { costSource: 'estimated' }),
      actual: section('cost', entry => entry.cost, { costSource: 'computed_usage' })
    },
    timing: {
      estimated: section('processingTimeMs', entry => entry.estimatedMs, { timingScope: 'estimated' }),
      actual: section('processingTimeMs', entry => entry.ms, { timingScope: 'actual' })
    }
  }, { extractRoute: 'media' })
  return { runDir, storedAudioPath }
}

const mockAssemblyAi = (): MockFetchCall[] => installMockFetch(call => {
  const path = new URL(call.url).pathname
  if (path === '/v2/upload' && call.method === 'POST') return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
  if (path === '/v2/transcript' && call.method === 'POST') return jsonResponse({ id: 'new-job' })
  if (path === '/v2/transcript/new-job' && call.method === 'GET') return jsonResponse({
    id: 'new-job', status: 'completed', text: 'Hello there.', speech_model_used: 'assemblyai-stt-3-7',
    utterances: [{ speaker: 'A', start: 0, end: 900, confidence: .97, text: 'Hello there.', words: [
      { text: 'Hello', start: 0, end: 400, confidence: .98, speaker: 'A' },
      { text: 'there.', start: 450, end: 900, confidence: .97, speaker: 'A' }
    ] }],
    words: [
      { text: 'Hello', start: 0, end: 400, confidence: .98, speaker: 'A' },
      { text: 'there.', start: 450, end: 900, confidence: .97, speaker: 'A' }
    ]
  })
  throw new Error(`Unexpected request: ${call.method} ${call.url}`)
})

const resumeWithNewTarget = async (runDir: string): Promise<void> => {
  const opts = buildOptsFromFlags({ 'assemblyai-stt': [NEW_TARGET.model] })
  const target: ResumeTarget = { kind: 'extract', extractRoute: 'media', scope: 'single', dir: runDir, manifestPath: join(runDir, PIPELINE_MANIFEST_FILE) }
  await resumeSttTarget(target, opts, collectSttTargets(opts))
}

const readItem = async (runDir: string): Promise<Json> => (await Bun.file(join(runDir, PIPELINE_MANIFEST_FILE)).json() as Json)['items'][0]
const isNew = (entry: Json): boolean => (entry['service'] ?? entry['provider']) === NEW_TARGET.service && entry['model'] === NEW_TARGET.model

describe('additive STT resume preserves canonical records', () => {
  test('mocked dispatch of one new target leaves stored providers, step1, steps, origins and prompt.md untouched', async () => {
    const { runDir } = await writeCompactedRun(await tempDirs.make())
    const before = await readItem(runDir)
    const calls = mockAssemblyAi()

    await resumeWithNewTarget(runDir)

    // Transport: exactly one upload, one creation and one poll for the new target, with 3.7's pinned style.
    expect(calls.map(call => `${call.method} ${new URL(call.url).pathname}`)).toEqual(['POST /v2/upload', 'POST /v2/transcript', 'GET /v2/transcript/new-job'])
    expect(calls[1]?.bodyJson).toMatchObject({ speech_models: [NEW_TARGET.model], disfluencies: false, format_text: true })

    const after = await readItem(runDir)
    const storedProviders = (after['providers'] as Json[]).filter(entry => !isNew(entry))
    expect(storedProviders).toEqual(before['providers'])
    for (const provider of storedProviders) {
      expect(provider).not.toHaveProperty('result')
      expect(provider['metadata']['hostedConcurrency']).toEqual({ provider: provider['service'], limit: 4, maxInFlight: 2 })
    }
    expect((after['providers'] as Json[]).filter(isNew)).toHaveLength(1)
    expect((after['providers'] as Json[]).find(isNew)).toMatchObject({ status: 'succeeded' })

    // The stored step1 stays authoritative and no media is materialized inside the run.
    expect(after['metadata']['step1']).toEqual(before['metadata']['step1'])
    expect((await readdir(runDir)).filter(name => /\.(mp3|m4a|wav|webm|mp4)$/.test(name))).toEqual([])

    // Historical cost and timing steps (including the retired Cloudflare model) are kept; one step is added.
    for (const [group, name, total, field] of [
      ['cost', 'estimated', 'totalCost', 'cost'],
      ['cost', 'observedEstimate', 'totalCost', 'cost'],
      ['cost', 'actual', 'totalCost', 'cost'],
      ['timing', 'estimated', 'totalProcessingTimeMs', 'processingTimeMs'],
      ['timing', 'actual', 'totalProcessingTimeMs', 'processingTimeMs']
    ] as const) {
      const old = before['metadata'][group][name]
      const next = after['metadata'][group][name]
      const added = (next['steps'] as Json[]).filter(isNew)
      expect(`${group}.${name}:${(next['steps'] as Json[]).filter(entry => !isNew(entry)).length}`).toBe(`${group}.${name}:2`)
      expect((next['steps'] as Json[]).filter(entry => !isNew(entry))).toEqual(old['steps'])
      expect(added).toHaveLength(1)
      expect(typeof added[0]![field]).toBe('number')
      expect(next[total]).toBeCloseTo(old[total] + added[0]![field], 9)
    }

    const origins = after['metadata']['resolvedStep2']['providers'] as Json[]
    expect(origins.filter(entry => !isNew(entry))).toEqual(before['metadata']['resolvedStep2']['providers'])
    expect(origins.filter(isNew)).toHaveLength(1)
    // Equal prompt scores (diarized, speaker-labelled) do not outrank the stored source.
    expect(await Bun.file(join(runDir, 'prompt.md')).text()).toBe(STORED_PROMPT)
  })

  for (const change of ['missing', 'size'] as const) {
    test(`stored audio ${change === 'missing' ? 'that is missing' : 'with a different size'} falls back to re-deriving step1 from the source`, async () => {
      const { runDir, storedAudioPath } = await writeCompactedRun(await tempDirs.make())
      if (change === 'missing') await Bun.file(storedAudioPath).delete()
      else await Bun.write(storedAudioPath, new Uint8Array([1, 2, 3]))
      const before = await readItem(runDir)
      mockAssemblyAi()

      await resumeWithNewTarget(runDir)

      const after = await readItem(runDir)
      const step1 = after['metadata']['step1'] as Json
      expect(step1['audioFileName']).not.toBe('../../sources/x.mp3')
      expect(await Bun.file(join(runDir, step1['audioFileName'])).exists()).toBe(true)
      // Canonical provider records are still kept even when the media is re-acquired.
      expect((after['providers'] as Json[]).filter(entry => !isNew(entry))).toEqual(before['providers'])
    })
  }
})

describe('additive STT resume prompt source', () => {
  test('a new provider that outranks the stored prompt source rewrites prompt.md', async () => {
    // Stored transcripts without speaker labels score below the diarized, speaker-labelled new transcript.
    const { runDir } = await writeCompactedRun(await tempDirs.make(), false)
    mockAssemblyAi()

    await resumeWithNewTarget(runDir)

    const prompt = await Bun.file(join(runDir, 'prompt.md')).text()
    expect(prompt).not.toBe(STORED_PROMPT)
    expect(prompt).toContain('Hello there.')
  })
})
