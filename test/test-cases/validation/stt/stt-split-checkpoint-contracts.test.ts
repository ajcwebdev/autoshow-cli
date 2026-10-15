import { describe, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildSplitSegmentFingerprint,
  readSplitSegmentCheckpoint,
  runAdaptiveSplitTranscription,
  SPLIT_SEGMENT_CHECKPOINT_FILE,
  writeSplitSegmentCheckpoint
} from '~/cli/commands/stt/run-stt/split-execution'
import { clearProviderDirForRecovery } from '~/cli/commands/stt/process-stt/stt-batch-worker'
import type { SttTarget } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
  tempPrefix: 'autoshow-stt-split-checkpoint-',
  beforeEachExtra: () => {
    process.env['CLOUDFLARE_API_TOKEN'] = 'synthetic-token'
    process.env['CLOUDFLARE_ACCOUNT_ID'] = 'synthetic-account'
  }
})

const SOURCE_AUDIO = 'input/examples/audio/1-audio.mp3'
const TARGET: SttTarget = { service: 'cloudflare', model: '@cf/openai/whisper', local: false }
// 15-second pieces of the 60-second clip: four segments.
const SEGMENT_MINUTES = 0.25

const segmentResponse = (label: string) => jsonResponse({
  result: { text: label, word_count: 2, words: [{ word: label.split(' ')[0], start: 0, end: 0.5 }, { word: label.split(' ')[1], start: 0.5, end: 1 }] },
  success: true,
  errors: [],
  messages: []
})

const runSplit = async (outputDir: string) => await runAdaptiveSplitTranscription(
  TARGET,
  SOURCE_AUDIO,
  outputDir,
  { sttSegmentConcurrency: 1, audioDurationSeconds: 59.585306 },
  SEGMENT_MINUTES,
  Bun.file(SOURCE_AUDIO).size
)

describe('STT split segment checkpoints', () => {
  test('a failed split run keeps finished segments and the next run sends only the missing ones', async () => {
    const outputDir = await tempDirs.make()

    let firstRunRequests = 0
    installMockFetch(() => {
      firstRunRequests += 1
      return firstRunRequests === 3
        ? jsonResponse({ success: false, errors: [{ code: 5004, message: 'Invalid data' }], result: null }, { status: 400 })
        : segmentResponse(`piece ${firstRunRequests}`)
    })
    await expect(runSplit(outputDir)).rejects.toThrow('Cloudflare transcription failed (400)')
    expect(firstRunRequests).toBe(3)

    const segmentRuns = join(outputDir, 'split-attempts', 'pass_001', 'segment-runs')
    const saved = await Promise.all(['segment_001', 'segment_002', 'segment_003'].map(async segment =>
      await Bun.file(join(segmentRuns, segment, SPLIT_SEGMENT_CHECKPOINT_FILE)).exists()))
    expect(saved).toEqual([true, true, false])

    let secondRunRequests = 0
    installMockFetch(() => {
      secondRunRequests += 1
      return segmentResponse(`retry ${secondRunRequests}`)
    })
    const { result, metadata } = await runSplit(outputDir)

    // Segments 1 and 2 come from their checkpoints; only segments 3 and 4 are sent again.
    expect(secondRunRequests).toBe(2)
    expect(result.text).toBe('piece 1 piece 2 retry 1 retry 2')
    expect(result.segments.map(segment => segment.start)).toEqual(['00:00:00.000', '00:00:15.000', '00:00:30.000', '00:00:45.000'])
    expect(metadata).toMatchObject({ transcriptionService: 'cloudflare', transcriptionModel: TARGET.model })

    let thirdRunRequests = 0
    installMockFetch(() => {
      thirdRunRequests += 1
      return segmentResponse('unexpected request')
    })
    expect((await runSplit(outputDir)).result.text).toBe('piece 1 piece 2 retry 1 retry 2')
    expect(thirdRunRequests).toBe(0)
  })

  test('the fingerprint changes with the model, the segment position, and the audio bytes', async () => {
    const dir = await tempDirs.make()
    const audioA = join(dir, 'a.mp3')
    const audioB = join(dir, 'b.mp3')
    await Bun.write(audioA, new Uint8Array([1, 2, 3]))
    await Bun.write(audioB, new Uint8Array([1, 2, 4]))
    const segment = { path: audioA, startSeconds: 0, durationSeconds: 15 }

    const base = await buildSplitSegmentFingerprint(TARGET, segment)
    expect(await buildSplitSegmentFingerprint(TARGET, { ...segment })).toBe(base)
    expect(await buildSplitSegmentFingerprint({ ...TARGET, model: '@cf/openai/whisper-tiny-en' }, segment)).not.toBe(base)
    expect(await buildSplitSegmentFingerprint(TARGET, { ...segment, startSeconds: 15 })).not.toBe(base)
    expect(await buildSplitSegmentFingerprint(TARGET, { ...segment, path: audioB })).not.toBe(base)
    expect(await buildSplitSegmentFingerprint({ ...TARGET, diarizationOptions: { enabled: true } }, segment)).not.toBe(base)
  })

  test('a checkpoint is reused only when its fingerprint matches and its content is a transcription', async () => {
    const dir = await tempDirs.make()
    const data = {
      result: { text: 'saved', segments: [{ start: '00:00:00.000', end: '00:00:01.000', text: 'saved' }] },
      metadata: { transcriptionService: 'cloudflare' as const, transcriptionModel: TARGET.model, processingTime: 10, tokenCount: 1 }
    }
    await writeSplitSegmentCheckpoint(dir, 'fingerprint-a', data)

    expect(await readSplitSegmentCheckpoint(dir, 'fingerprint-a')).toEqual(data)
    expect(await readSplitSegmentCheckpoint(dir, 'fingerprint-b')).toBeUndefined()

    await Bun.write(join(dir, SPLIT_SEGMENT_CHECKPOINT_FILE), '{"fingerprint":"fingerprint-a","data":{"result":{}}}')
    expect(await readSplitSegmentCheckpoint(dir, 'fingerprint-a')).toBeUndefined()
    await Bun.write(join(dir, SPLIT_SEGMENT_CHECKPOINT_FILE), 'not json')
    expect(await readSplitSegmentCheckpoint(dir, 'fingerprint-a')).toBeUndefined()
    expect(await readSplitSegmentCheckpoint(join(dir, 'missing'), 'fingerprint-a')).toBeUndefined()
  })

  test('valid JSON checkpoints with malformed transcripts or required metadata are rejected', async () => {
    const dir = await tempDirs.make()
    const result = { text: 'saved', segments: [{ start: '00:00:00.000', end: '00:00:01.000', text: 'saved' }] }
    const metadata = { transcriptionService: 'cloudflare', transcriptionModel: TARGET.model, processingTime: 10, tokenCount: 1 }
    const invalidData = [
      { result: { ...result, segments: [null] }, metadata },
      { result: { ...result, segments: [{ start: '00:00:00.000', end: '00:00:01.000' }] }, metadata },
      { result: { segments: result.segments }, metadata },
      ...['transcriptionService', 'transcriptionModel', 'processingTime', 'tokenCount'].map(key => ({
        result, metadata: Object.fromEntries(Object.entries(metadata).filter(([field]) => field !== key))
      })),
      ...[
        { transcriptionService: 'unknown' },
        { transcriptionModel: '' },
        { processingTime: '10' },
        { processingTime: -1 },
        { tokenCount: null },
        { tokenCount: -1 }
      ].map(invalidMetadata => ({ result, metadata: { ...metadata, ...invalidMetadata } }))
    ]

    for (const data of invalidData) {
      await Bun.write(join(dir, SPLIT_SEGMENT_CHECKPOINT_FILE), JSON.stringify({ version: 1, fingerprint: 'saved', data }))
      expect(await readSplitSegmentCheckpoint(dir, 'saved')).toBeUndefined()
    }

    for (const field of ['processingTime', 'tokenCount']) {
      const overflowJson = JSON.stringify({ version: 1, fingerprint: 'saved', data: { result, metadata: { ...metadata, [field]: null } } })
        .replace(`"${field}":null`, `"${field}":1e400`)
      expect(JSON.parse(overflowJson).data.metadata[field]).toBe(Number.POSITIVE_INFINITY)
      await Bun.write(join(dir, SPLIT_SEGMENT_CHECKPOINT_FILE), overflowJson)
      expect(await readSplitSegmentCheckpoint(dir, 'saved')).toBeUndefined()
    }

    await Bun.write(join(dir, SPLIT_SEGMENT_CHECKPOINT_FILE), JSON.stringify({ version: 2, fingerprint: 'saved', data: { result, metadata } }))
    expect(await readSplitSegmentCheckpoint(dir, 'saved')).toBeUndefined()
  })

  test('a resumed split redispatches corrupt checkpoints and keeps the valid completed segment', async () => {
    const outputDir = await tempDirs.make()
    let initialRequests = 0
    installMockFetch(() => segmentResponse(`original ${++initialRequests}`))
    await runSplit(outputDir)
    expect(initialRequests).toBe(4)

    const segmentRuns = join(outputDir, 'split-attempts', 'pass_001', 'segment-runs')
    for (const segmentNumber of [1, 2, 3]) {
      const checkpointPath = join(segmentRuns, `segment_${String(segmentNumber).padStart(3, '0')}`, SPLIT_SEGMENT_CHECKPOINT_FILE)
      const checkpoint = await Bun.file(checkpointPath).json()
      if (segmentNumber === 1) checkpoint.data.result.segments = [null]
      if (segmentNumber === 2) delete checkpoint.data.metadata.processingTime
      if (segmentNumber === 3) checkpoint.data.metadata.tokenCount = 'invalid'
      await Bun.write(checkpointPath, JSON.stringify(checkpoint))
    }

    let repairRequests = 0
    installMockFetch(() => segmentResponse(`repaired ${++repairRequests}`))
    const repaired = await runSplit(outputDir)
    expect(repairRequests).toBe(3)
    expect(repaired.result.text).toBe('repaired 1 repaired 2 repaired 3 original 4')
    expect(Number.isFinite(repaired.metadata.processingTime)).toBe(true)
    expect(Number.isFinite(repaired.metadata.tokenCount)).toBe(true)

    let repeatRequests = 0
    installMockFetch(() => {
      repeatRequests += 1
      throw new Error('Repaired checkpoints should be reused')
    })
    expect((await runSplit(outputDir)).result.text).toBe(repaired.result.text)
    expect(repeatRequests).toBe(0)
  })

  test('a recovery pass clears the provider directory but keeps split checkpoints', async () => {
    const providerDir = await tempDirs.make()
    await mkdir(join(providerDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001'), { recursive: true })
    await Bun.write(join(providerDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', SPLIT_SEGMENT_CHECKPOINT_FILE), '{}')
    await Bun.write(join(providerDir, 'error.json'), '{}')
    await Bun.write(join(providerDir, 'raw-response.json'), '{}')
    await mkdir(join(providerDir, 'segments'), { recursive: true })

    await clearProviderDirForRecovery(providerDir)

    expect((await readdir(providerDir)).sort()).toEqual(['split-attempts'])
    expect(await Bun.file(join(providerDir, 'split-attempts', 'pass_001', 'segment-runs', 'segment_001', SPLIT_SEGMENT_CHECKPOINT_FILE)).exists()).toBe(true)
    await clearProviderDirForRecovery(join(providerDir, 'does-not-exist'))
  })
})
