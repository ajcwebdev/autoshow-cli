import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/command-shared/pipeline-manifest'
import { completeSingleProviderStt } from '~/cli/commands/stt/process-stt/single-provider-completion'
import { toRequestedProvider } from '~/cli/commands/stt/stt-batch/stt-run-state'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { ASYNC_STT_PROGRESS_METADATA_KEY } from '~/cli/commands/stt/stt-provider-progress'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { SttSingleProviderCompletionContext } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ASSEMBLYAI_API_KEY'], tempPrefix: 'autoshow-single-stt-resume-', restoreBunSleep: true,
  beforeEachExtra: () => {
    process.env['ASSEMBLYAI_API_KEY'] = 'fixture'
    installMockFetch(() => { throw new Error('Unexpected unmocked provider request') })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const context = async (outputDir: string, flags: Record<string, unknown> = {}): Promise<SttSingleProviderCompletionContext> => {
  const options = buildOptsFromFlags({ 'assemblyai-stt': ['universal-3-5-pro'], diarization: false, ...flags })
  const audio = join(outputDir, 'source.wav')
  await Bun.write(audio, 'fixture audio')
  const metadata = { title: 'Resume fixture', duration: '1', channel: 'Local', description: '', url: 'input/resume-fixture.wav' }
  return {
    outputDir, requestedTargets: collectSttTargets(options), options, acquisitionTimeMs: 0, processStart: Date.now(),
    prepared: {
      metadata, step1Metadata: { ...metadata, slug: 'resume-fixture', audioFileName: 'source.wav', audioFileSize: 13, durationSeconds: 1 },
      durationSeconds: 1, executionArtifacts: { sourceMediaPath: audio }, outputArtifacts: { sourceMediaPath: audio }, timings: {}
    }
  }
}

const seed = async (run: SttSingleProviderCompletionContext, status: 'failed' | 'running' = 'failed'): Promise<void> => {
  const target = run.requestedTargets[0]!
  const requested = toRequestedProvider(target, run.options)
  await writeSingleManifestFixture(run.outputDir, 'extract', {
    step1: run.prepared.step1Metadata, completionStatus: 'incomplete', requestedProviders: [requested], missingProviders: [requested],
    providerStates: [{
      service: target.service, model: target.model, local: false, artifactDir: '.', status, attempts: 2,
      metadata: {
        retainedEvidence: 'keep me',
        [ASYNC_STT_PROGRESS_METADATA_KEY]: {
          whole: {
            transcriptionService: 'assemblyai', transcriptionModel: 'universal-3-5-pro', processingTime: 10, tokenCount: 0,
            runtime: { mode: 'fresh', stage: 'polling', remoteJobId: 'already-billed-job' }
          }
        }
      }
    }]
  }, { extractRoute: 'media' })
}

describe('single-provider STT resume dispatch', () => {
  for (const status of ['failed', 'running'] as const) {
    test(`mocked ${status} AssemblyAI recovery polls its retained job without upload or creation`, async () => {
      const dir = await tempDirs.make()
      const original = await context(dir)
      // Older manifests may omit the optional source duration.
      if (status === 'running') delete original.prepared.step1Metadata.durationSeconds
      await seed(original, status)
      // Native subtitle exports can be requested while recovering the same inference.
      const run = await context(dir, { 'native-subtitles': true })
      const calls = installMockFetch(call => {
        expect(call.method).toBe('GET')
        const path = new URL(call.url).pathname
        if (path === '/v2/transcript/already-billed-job') return jsonResponse({
          id: 'already-billed-job', status: 'completed', text: 'Hello.', utterances: null,
          words: [{ text: 'Hello.', start: 125, end: 875, confidence: .98, speaker: null }]
        })
        if (path === '/v2/transcript/already-billed-job/srt') return new Response('1\n00:00:00,125 --> 00:00:00,875\nHello.\n')
        if (path === '/v2/transcript/already-billed-job/vtt') return new Response('WEBVTT\n\n00:00:00.125 --> 00:00:00.875\nHello.\n')
        throw new Error(`Unexpected resumed request: ${call.method} ${call.url}`)
      })
      await expect(completeSingleProviderStt(run)).resolves.toBe(dir)
      expect(calls.map(call => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
        'GET /v2/transcript/already-billed-job', 'GET /v2/transcript/already-billed-job/srt', 'GET /v2/transcript/already-billed-job/vtt'
      ])
      const provider = await readSingleManifestProviderState(dir, { service: 'assemblyai', model: 'universal-3-5-pro', artifactDir: '.' })
      expect(provider).toMatchObject({ status: 'succeeded', attempts: 3, metadata: {
        retainedEvidence: 'keep me', runtime: { mode: 'resumed', remoteJobId: 'already-billed-job' },
        [ASYNC_STT_PROGRESS_METADATA_KEY]: { whole: { runtime: { mode: 'resumed', remoteJobId: 'already-billed-job' } } }
      } })
      expect(await Bun.file(join(dir, 'result.json')).json()).toMatchObject({
        text: 'Hello.', evidence: { words: [{ startSeconds: .125, endSeconds: .875, text: 'Hello.', timingSource: 'native' }] }
      })
    })
  }

  for (const changed of ['source', 'audio-size', 'duration', 'diarization', 'speaker-count', 'audio-profile', 'split'] as const) {
    test(`changed ${changed} rejects before dispatch and preserves the recoverable job`, async () => {
      const dir = await tempDirs.make()
      const run = await context(dir)
      await seed(run)
      const originalManifest = await Bun.file(join(dir, 'manifest.json')).text()
      if (changed === 'source') run.prepared.step1Metadata.url = 'input/other-source.wav'
      if (changed === 'audio-size') run.prepared.step1Metadata.audioFileSize += 1
      if (changed === 'duration') run.prepared.step1Metadata.durationSeconds = (run.prepared.step1Metadata.durationSeconds ?? 1) + 1
      if (changed === 'diarization') run.requestedTargets[0]!.diarizationOptions = { enabled: true }
      if (changed === 'speaker-count') run.requestedTargets[0]!.diarizationOptions = { enabled: false, speakerCount: 3 }
      if (changed === 'audio-profile') run.options.sttAudioProfile = 'lossless'
      if (changed === 'split') run.options.split = true
      const calls = installMockFetch(() => { throw new Error('Resume must reject before network dispatch') })
      await expect(completeSingleProviderStt(run)).rejects.toThrow('Cannot resume')
      expect(calls).toHaveLength(0)
      expect(await Bun.file(join(dir, 'manifest.json')).text()).toBe(originalManifest)
    })
  }

  for (const changedAudio of [false, true]) {
    test(`malformed provider output retains the job and ${changedAudio ? 'rejects replaced audio at the same path' : 'recovers with unchanged audio'}`, async () => {
      const dir = await tempDirs.make()
      const run = await context(dir)
      installMockFetch(call => {
        const path = new URL(call.url).pathname
        if (path === '/v2/upload' && call.method === 'POST') return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
        if (path === '/v2/transcript' && call.method === 'POST') return jsonResponse({ id: 'retained-job' })
        if (path === '/v2/transcript/retained-job' && call.method === 'GET') return jsonResponse({
          id: 'retained-job', status: 'completed', words: [{ text: 'Hello.', start: 125, end: 875, confidence: .98, speaker: 0 }]
        })
        throw new Error(`Unexpected initial request: ${call.method} ${call.url}`)
      })
      await expect(completeSingleProviderStt(run)).rejects.toThrow('words.0.speaker')
      const failed = await readSingleManifestProviderState(dir, { service: 'assemblyai', model: 'universal-3-5-pro', artifactDir: '.' })
      expect(failed).toMatchObject({ status: 'failed', attempts: 1, metadata: {
        sourceAudioSha256: new Bun.CryptoHasher('sha256').update('fixture audio').digest('hex'),
        [ASYNC_STT_PROGRESS_METADATA_KEY]: { whole: { runtime: { remoteJobId: 'retained-job' } } }
      } })
      expect(await Bun.file(join(dir, 'result.json')).exists()).toBe(false)
      const savedManifest = await Bun.file(join(dir, 'manifest.json')).text()
      if (changedAudio) await Bun.write(run.prepared.executionArtifacts.sourceMediaPath, 'fixture AUDIO')
      const calls = installMockFetch(call => {
        expect(call.method).toBe('GET')
        expect(new URL(call.url).pathname).toBe('/v2/transcript/retained-job')
        return jsonResponse({ id: 'retained-job', status: 'completed', text: 'Hello.', words: [{ text: 'Hello.', start: 125, end: 875, confidence: .98, speaker: null }] })
      })
      if (changedAudio) {
        await expect(completeSingleProviderStt(run)).rejects.toThrow('Cannot resume STT with a changed source')
        expect(calls).toHaveLength(0)
        expect(await Bun.file(join(dir, 'manifest.json')).text()).toBe(savedManifest)
      } else {
        expect(await completeSingleProviderStt(run)).toBe(dir)
        expect(calls).toHaveLength(1)
        expect(await readSingleManifestProviderState(dir, { service: 'assemblyai', model: 'universal-3-5-pro', artifactDir: '.' })).toMatchObject({
          status: 'succeeded', attempts: 2, metadata: { sourceAudioSha256: failed?.metadata['sourceAudioSha256'], runtime: { mode: 'resumed', remoteJobId: 'retained-job' } }
        })
      }
    })
  }

  test('fresh single-provider extraction still uploads and creates exactly one job', async () => {
    const dir = await tempDirs.make()
    const run = await context(dir)
    const calls = installMockFetch(call => {
      const path = new URL(call.url).pathname
      if (path === '/v2/upload' && call.method === 'POST') return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
      if (path === '/v2/transcript' && call.method === 'POST') return jsonResponse({ id: 'new-job' })
      if (path === '/v2/transcript/new-job' && call.method === 'GET') return jsonResponse({
        id: 'new-job', status: 'completed', text: 'Hello.', words: [{ text: 'Hello.', start: 125, end: 875, confidence: .98, speaker: null }]
      })
      throw new Error(`Unexpected fresh request: ${call.method} ${call.url}`)
    })
    await expect(completeSingleProviderStt(run)).resolves.toBe(dir)
    expect(calls.map(call => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /v2/upload', 'POST /v2/transcript', 'GET /v2/transcript/new-job'
    ])
    expect(await readSingleManifestProviderState(dir, { service: 'assemblyai', model: 'universal-3-5-pro', artifactDir: '.' })).toMatchObject({
      status: 'succeeded', attempts: 1, metadata: { runtime: { mode: 'fresh', remoteJobId: 'new-job' } }
    })
  })
})
