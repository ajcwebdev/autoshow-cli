import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import { buildAssemblyAiTranscriptRequest, runAssemblyAiTranscribe } from '~/cli/commands/stt/diarization/assemblyai/run-assemblyai-stt'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ASSEMBLYAI_API_KEY'],
  tempPrefix: 'autoshow-assemblyai-rest-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    process.env['ASSEMBLYAI_API_KEY'] = 'fixture'
    installMockFetch(() => { throw new Error('Unexpected unmocked provider request') })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

describe('AssemblyAI REST contracts', () => {
  test('transcript request preserves one selected model and enables diarization', () => {
    expect(buildAssemblyAiTranscriptRequest(
      'https://cdn.assemblyai.com/upload/example',
      'universal-3-5-pro'
    )).toEqual({
      audio_url: 'https://cdn.assemblyai.com/upload/example',
      speech_models: ['universal-3-5-pro'],
      speaker_labels: true
    })
  })

  test('transcript request propagates the expected speaker count', () => {
    expect(buildAssemblyAiTranscriptRequest(
      'https://cdn.assemblyai.com/upload/example',
      'universal-3-5-pro',
      3
    )).toEqual({
      audio_url: 'https://cdn.assemblyai.com/upload/example',
      speech_models: ['universal-3-5-pro'],
      speaker_labels: true,
      speakers_expected: 3
    })
  })

  test('completed response retains nullable word speakers and rejects malformed labels and timing', () => {
    // AssemblyAI's independent REST type documents speaker:string|null when diarization is disabled:
    // https://assemblyai.github.io/assemblyai-node-sdk/types/TranscriptWord.html
    const word = { text: 'Hello', start: 125, end: 875, confidence: .98 }
    const response = { id: 'completed-id', status: 'completed', words: [word, { ...word, speaker: null }, { ...word, speaker: 'A' }] }
    const parsed = v.parse(AssemblyAiTranscriptResponseSchema, response)
    expect(parsed.words?.map(entry => entry.speaker)).toEqual([undefined, null, 'A'])
    for (const invalidWord of [{ ...word, speaker: 0 }, { ...word, start: '125' }]) {
      expect(v.safeParse(AssemblyAiTranscriptResponseSchema, { ...response, words: [invalidWord] }).success).toBe(false)
    }
  })

  for (const mode of ['default', 'disabled', 'enabled'] as const) {
    test(`mocked ${mode} diarization dispatch retains native timing and correct speaker omission`, async () => {
      const dir = await tempDirs.make()
      const audio = join(dir, 'fixture.wav')
      await Bun.write(audio, 'fixture')
      const enabled = mode !== 'disabled'
      const word = { text: 'Hello.', start: 125, end: 875, confidence: .98, speaker: enabled ? 'A' : null }
      const response = {
        id: 'completed-id', status: 'completed', text: 'Hello.', words: [word],
        utterances: enabled ? [{ ...word, words: [word] }] : null
      }
      const subtitle = '1\n00:00:00,125 --> 00:00:00,875\nHello.\n'
      const calls = installMockFetch(call => {
        const path = new URL(call.url).pathname
        if (path === '/v2/upload' && call.method === 'POST') return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
        if (path === '/v2/transcript' && call.method === 'POST') return jsonResponse({ id: 'completed-id' })
        if (path === '/v2/transcript/completed-id' && call.method === 'GET') return jsonResponse(response)
        if (path === '/v2/transcript/completed-id/srt' && call.method === 'GET') return new Response(subtitle)
        if (path === '/v2/transcript/completed-id/vtt' && call.method === 'GET') return new Response('WEBVTT\n\n00:00:00.125 --> 00:00:00.875\nHello.\n')
        throw new Error(`Unexpected AssemblyAI request: ${call.method} ${call.url}`)
      })
      const { result } = await runAssemblyAiTranscribe(audio, dir, {
        model: 'universal-3-5-pro', segmentOffsetMinutes: 30, nativeSubtitles: true,
        ...(mode === 'default' ? {} : { diarizationOptions: { enabled, speakerCount: 2 } })
      })
      const request = calls.find(call => new URL(call.url).pathname === '/v2/transcript')?.bodyJson
      expect(request).toEqual({
        audio_url: 'https://fixture.invalid/audio', speech_models: ['universal-3-5-pro'], speaker_labels: enabled,
        ...(mode === 'enabled' ? { speakers_expected: 2 } : {})
      })
      expect(result.evidence?.words).toEqual([{
        text: 'Hello.', normalized: 'hello.', startSeconds: 1800.125, endSeconds: 1800.875, confidence: .98, timingSource: 'native',
        ...(enabled ? { speaker: 'speaker-A' } : {})
      }])
      expect(result.evidence?.capabilities).toMatchObject({ hasNativeWordTiming: true, hasSpeakerLabels: enabled })
      expect(result.segments).toEqual([{
        start: '00:30:00.125', end: '00:30:00.875', text: 'Hello.', ...(enabled ? { speaker: 'speaker-A' } : {})
      }])
      expect(result.evidence?.rawResponse).toEqual(response)
      expect(await Bun.file(join(dir, 'transcription-provider-response.json')).json()).toEqual(response)
      expect(await Bun.file(join(dir, 'transcription.native.srt')).text()).toBe(subtitle)
      expect(await Bun.file(join(dir, 'transcription.txt')).text()).toBe(`[00:30:00.125] ${enabled ? '[speaker-A] ' : ''}Hello.`)
      expect(calls.map(call => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
        'POST /v2/upload', 'POST /v2/transcript', 'GET /v2/transcript/completed-id',
        'GET /v2/transcript/completed-id/srt', 'GET /v2/transcript/completed-id/vtt'
      ])
    })
  }
})
