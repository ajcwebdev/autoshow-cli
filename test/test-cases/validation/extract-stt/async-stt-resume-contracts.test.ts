import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runHappyScribeStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/run-happyscribe-stt'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/run-soniox-stt'
import { writeSttProviderCheckpoint } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'

const tempDirs: string[] = []
let previousFetch: typeof fetch
let previousSleep: typeof Bun.sleep
let previousHappyScribeApiKey: string | undefined
let previousSonioxApiKey: string | undefined

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })

const makeTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const restoreEnv = (key: 'HAPPYSCRIBE_API_KEY' | 'SONIOX_API_KEY', value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(() => {
  previousFetch = globalThis.fetch
  previousSleep = Bun.sleep
  previousHappyScribeApiKey = process.env['HAPPYSCRIBE_API_KEY']
  previousSonioxApiKey = process.env['SONIOX_API_KEY']
  delete process.env['HAPPYSCRIBE_API_KEY']
  delete process.env['SONIOX_API_KEY']
  globalThis.fetch = (async () => {
    throw new Error('Unexpected unmocked provider request')
  }) as unknown as typeof fetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
})

afterEach(async () => {
  globalThis.fetch = previousFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
  restoreEnv('HAPPYSCRIBE_API_KEY', previousHappyScribeApiKey)
  restoreEnv('SONIOX_API_KEY', previousSonioxApiKey)
  await Promise.all(tempDirs.splice(0).map(async (dir) => await rm(dir, { recursive: true, force: true })))
})

describe('async STT resume contracts', () => {
  test('Happy Scribe keeps the paid order resumable when export retrieval fails', async () => {
    const outputDir = await makeTempDir('autoshow-happyscribe-export-resume-')
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-happyscribe-key'

    let orderCreates = 0
    let exportCreates = 0
    let downloadAttempts = 0
    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'

      if (url.pathname.endsWith('/organizations')) {
        return jsonResponse({ organizations: [{ id: 'organization-1', currency: 'usd' }] })
      }
      if (url.pathname.endsWith('/uploads/new')) {
        return jsonResponse({ signedUrl: 'https://upload.mock/audio' })
      }
      if (url.hostname === 'upload.mock' && method === 'PUT') {
        return new Response(null, { status: 200 })
      }
      if (url.pathname.endsWith('/orders') && method === 'POST') {
        orderCreates += 1
        return jsonResponse({ id: 'order-1', state: 'submitted' })
      }
      if (url.pathname.endsWith('/orders/order-1')) {
        return jsonResponse({
          id: 'order-1',
          state: 'fulfilled',
          transcriptions: [{ uuid: 'transcription-1', state: 'automatic_done' }]
        })
      }
      if (url.pathname.endsWith('/transcriptions/transcription-1')) {
        return jsonResponse({ id: 'transcription-1', state: 'automatic_done' })
      }
      if (url.pathname.endsWith('/exports') && method === 'POST') {
        exportCreates += 1
        return jsonResponse({ id: `export-${exportCreates}`, state: 'pending' })
      }
      if (url.pathname.endsWith(`/exports/export-${exportCreates}`)) {
        return jsonResponse({
          id: `export-${exportCreates}`,
          state: 'ready',
          download_link: `https://download.mock/export-${exportCreates}`
        })
      }
      if (url.hostname === 'download.mock') {
        downloadAttempts += 1
        if (downloadAttempts <= 2) {
          return jsonResponse({ error: 'export temporarily unavailable' }, 503)
        }
        return jsonResponse({
          transcript: 'hello from resumed export',
          segments: [{ text: 'hello from resumed export', start_seconds: 0, end_seconds: 1 }]
        })
      }

      throw new Error(`Unexpected Happy Scribe request: ${method} ${url.toString()}`)
    }) as typeof fetch

    await expect(runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0
    })).rejects.toThrow('Happy Scribe transcript download failed')

    const failedCheckpoint = await Bun.file(join(outputDir, 'checkpoint.json')).json() as {
      metadata: { runtime: Record<string, unknown> }
    }
    expect(failedCheckpoint.metadata.runtime).toMatchObject({
      stage: 'polling',
      remoteJobId: 'order-1'
    })

    const resumed = await runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0
    })

    expect(resumed.result.text).toBe('hello from resumed export')
    expect(resumed.metadata.runtime).toMatchObject({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'order-1'
    })
    expect(orderCreates).toBe(1)
    expect(exportCreates).toBe(2)
  })

  test('Soniox retains remote resources while a polling checkpoint remains retryable', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-poll-resume-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    await writeSttProviderCheckpoint(outputDir, 'soniox', 'stt-async-v5', {
      transcriptionService: 'soniox',
      transcriptionModel: 'stt-async-v5',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls: Array<{ method: string, pathname: string }> = []
    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      calls.push({ method, pathname: url.pathname })
      return jsonResponse({ id: 'transcription-1', status: 'processing' })
    }) as typeof fetch

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0
    })).rejects.toThrow('is still pending after 5 resume status checks')

    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(5)
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)
    const checkpoint = await Bun.file(join(outputDir, 'checkpoint.json')).json() as {
      metadata: { runtime: Record<string, unknown> }
    }
    expect(checkpoint.metadata.runtime).toMatchObject({
      stage: 'polling',
      remoteJobId: 'transcription-1',
      remoteAssetId: 'file-1'
    })
  })

  test('Soniox deletes remote resources after a terminal provider failure', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-terminal-cleanup-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    await writeSttProviderCheckpoint(outputDir, 'soniox', 'stt-async-v5', {
      transcriptionService: 'soniox',
      transcriptionModel: 'stt-async-v5',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls: Array<{ method: string, pathname: string }> = []
    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      calls.push({ method, pathname: url.pathname })
      if (method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return jsonResponse({
        id: 'transcription-1',
        status: 'error',
        error_message: 'provider rejected the audio'
      })
    }) as typeof fetch

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0
    })).rejects.toThrow('Soniox transcription failed: provider rejected the audio')

    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.pathname).sort()).toEqual([
      '/v1/files/file-1',
      '/v1/transcriptions/transcription-1'
    ])
  })
})
