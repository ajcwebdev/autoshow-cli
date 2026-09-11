import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runSpeechmaticsStt } from '~/cli/commands/stt/diarization/speechmatics/run-speechmatics-stt'
import { runMistralStt } from '~/cli/commands/stt/diarization/stt-mistral/run-mistral-stt'
import { createHappyScribeApiClient } from '~/cli/commands/stt/diarization/happyscribe/happyscribe-api'
import { runAssemblyAiTranscribe } from '~/cli/commands/stt/diarization/assemblyai/run-assemblyai-stt'
import { runDeepinfraTranscribe } from '~/cli/commands/stt/diarization-off-by-default/deepinfra/run-deepinfra-stt'
import { runDeepgramTranscribe } from '~/cli/commands/stt/diarization/stt-deepgram/run-deepgram-stt'
import { runGrokStt } from '~/cli/commands/stt/diarization/stt-grok/run-grok-stt'
import { runOpenAICompatibleSingleSpeakerStt } from '~/cli/commands/stt/stt-shared/openai-compatible-single-speaker'
import { installFetch, jsonResponse, setupCaptionContractLifecycle } from './caption-contract-lifecycle'

const { withTempDir } = setupCaptionContractLifecycle()

describe('caption native provider contracts', () => {
  for (const service of ['deepinfra'] as const) for (const model of ['whisper-large-v3', 'whisper-large-v3-turbo']) {
    test(service + '/' + model + ' captures words in the same request', async () => {
      const calls = installFetch(() => jsonResponse({ text: 'Hello', words: [{ word: 'Hello', start: .125, end: .875 }], segments: [{ start: .125, end: .875, text: 'Hello' }] }))
      await withTempDir(async dir => {
        const audio = join(dir, 'fixture.wav')
        await Bun.write(audio, 'fixture')
        const { result } = await runOpenAICompatibleSingleSpeakerStt(audio, dir, { service, providerLabel: service, apiKey: 'fixture', baseURL: 'https://fixture.invalid/v1', model: 'openai/' + model, segmentOffsetMinutes: 30 })
        expect(calls).toHaveLength(1)
        expect(calls[0]?.form?.getAll('timestamp_granularities[]')).toEqual(['word', 'segment'])
        expect(result.evidence?.words?.[0]).toMatchObject({ startSeconds: 1800.125, endSeconds: 1800.875 })
      })
    })
  }

  test('native AssemblyAI exports use the completed job and retain canonical words', async () => {
    const oldKey = process.env['ASSEMBLYAI_API_KEY']
    process.env['ASSEMBLYAI_API_KEY'] = 'fixture'
    const subtitle = '1\n00:00:00,125 --> 00:00:00,875\nHello\n'
    const calls = installFetch(call => {
      if (call.url.endsWith('/upload')) return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
      if (call.method === 'POST') return jsonResponse({ id: 'completed-id' })
      if (call.url.includes('/srt?')) return new Response(subtitle)
      if (call.url.includes('/vtt?')) return new Response('WEBVTT\n\n00:00:00.125 --> 00:00:00.875\nHello\n')
      return jsonResponse({ id: 'completed-id', status: 'completed', text: 'Hello', words: [{ text: 'Hello', start: 125, end: 875, confidence: .98 }] })
    })
    try {
      await withTempDir(async dir => {
        const audio = join(dir, 'fixture.wav')
        await Bun.write(audio, 'fixture')
        const { result } = await runAssemblyAiTranscribe(audio, dir, { model: 'universal-3-5-pro', segmentOffsetMinutes: 0, diarizationOptions: { enabled: false }, nativeSubtitles: true })
        expect(result.evidence?.words?.[0]).toMatchObject({ startSeconds: .125, endSeconds: .875 })
        expect(await Bun.file(join(dir, 'transcription.native.srt')).text()).toBe(subtitle)
        expect(calls.filter(call => call.method === 'POST' && !call.url.endsWith('/upload'))).toHaveLength(1)
        expect(calls.filter(call => /completed-id\/(srt|vtt)/.test(call.url))).toHaveLength(2)
      })
    } finally {
      if (oldKey === undefined) delete process.env['ASSEMBLYAI_API_KEY']
      else process.env['ASSEMBLYAI_API_KEY'] = oldKey
    }
  })

  test('native DeepInfra text response uses one request and does not enter the JSON parser', async () => {
    process.env['DEEPINFRA_API_KEY'] = 'fixture'
    const calls = installFetch(() => new Response('WEBVTT\n\n00:00:00.125 --> 00:00:00.875\nHello\n'))
    await withTempDir(async dir => {
      const audio = join(dir, 'fixture.wav')
      await Bun.write(audio, 'fixture')
      const { result } = await runDeepinfraTranscribe(audio, dir, { model: 'openai/whisper-large-v3', segmentOffsetMinutes: 30, nativeResponseFormat: 'vtt' })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.form?.get('response_format')).toBe('vtt')
      expect(result.segments[0]?.start).toBe('00:30:00.125')
      expect(result.evidence?.capabilities?.hasNativeWordTiming).toBe(false)
    })
  })

  test('Deepgram non-diarized words retain confidence and raw provider metadata', async () => {
    process.env['DEEPGRAM_API_KEY'] = 'fixture'
    const calls = installFetch(() => jsonResponse({
      metadata: { request_id: 'original-request' },
      results: { channels: [{ alternatives: [{ transcript: 'Hello', words: [{ word: 'Hello', start: .125, end: .875, confidence: .987 }] }] }], utterances: [{ start: .125, end: .875, transcript: 'Hello' }] }
    }))
    await withTempDir(async dir => {
      const audio = join(dir, 'fixture.wav')
      await Bun.write(audio, 'fixture')
      const { result } = await runDeepgramTranscribe(audio, dir, { model: 'nova-3', segmentOffsetMinutes: 0, diarizationOptions: { enabled: false } })
      expect(calls[0]?.url).toContain('diarize=false')
      expect(result.evidence?.words?.[0]).toMatchObject({ confidence: .987, startSeconds: .125 })
      expect(result.evidence?.rawResponse).toMatchObject({ metadata: { request_id: 'original-request' } })
    })
  })

  test('Grok verbatim disables formatting and preserves fillers with diarization off', async () => {
    process.env['XAI_API_KEY'] = 'fixture'
    const calls = installFetch(() => jsonResponse({ text: 'Um hello', words: [{ text: 'Um', start: .125, end: .3 }, { text: 'hello', start: .4, end: .9 }] }))
    await withTempDir(async dir => {
      const audio = join(dir, 'fixture.wav')
      await Bun.write(audio, 'fixture')
      await runGrokStt(audio, dir, { model: 'speech-to-text', segmentOffsetMinutes: 0, diarizationOptions: { enabled: false }, grokSttVerbatim: true })
      expect(calls[0]?.form?.get('format')).toBe('false')
      expect(calls[0]?.form?.get('filler_words')).toBe('true')
      expect(calls[0]?.form?.get('diarize')).toBe('false')
    })
  })

  test('Happy Scribe exports reuse the transcription ID and download subtitle text', async () => {
    const calls = installFetch(call => call.url.includes('/download')
      ? new Response('WEBVTT\n\n00:00:00.125 --> 00:00:00.875\nHello\n')
      : jsonResponse({ id: 'export-id', state: 'ready', download_link: 'https://fixture.invalid/download' }))
    const client = createHappyScribeApiClient({ apiKey: 'fixture', baseURL: 'https://fixture.invalid/api/v1' })
    for (const format of ['json', 'srt', 'vtt'] as const) {
      const exported = await client.createExport('existing-transcript', format)
      expect(exported.id).toBe('export-id')
    }
    expect(calls.map(call => JSON.parse(call.bodyText).export)).toEqual(['json', 'srt', 'vtt'].map(format => ({ format, transcription_ids: ['existing-transcript'] })))
    expect(await client.fetchDownloadPayload('https://fixture.invalid/download', 'text')).toContain('WEBVTT')
  })

  test('Speechmatics retrieves native SRT before deleting the completed job', async () => {
    const oldKey = process.env['SPEECHMATICS_API_KEY']
    process.env['SPEECHMATICS_API_KEY'] = 'fixture'
    const calls = installFetch(call => {
      if (call.method === 'DELETE') return new Response('', { status: 200 })
      if (call.method === 'POST') return jsonResponse({ id: 'existing-job' })
      if (call.url.endsWith('format=srt')) return new Response('1\n00:00:00,125 --> 00:00:00,875\nHello\n')
      if (call.url.endsWith('format=json-v2')) return jsonResponse({ results: [{ type: 'word', start_time: .125, end_time: .875, alternatives: [{ content: 'Hello', confidence: .97 }] }] })
      return jsonResponse({ job: { id: 'existing-job', status: 'done' } })
    })
    try {
      await withTempDir(async dir => {
        const audio = join(dir, 'fixture.wav')
        await Bun.write(audio, 'fixture')
        const { result } = await runSpeechmaticsStt(audio, dir, { model: 'melia-1', segmentOffsetMinutes: 0, nativeSubtitles: true, diarizationOptions: { enabled: false } })
        expect(result.evidence?.words?.[0]?.startSeconds).toBe(.125)
        expect(JSON.parse(String(calls[0]?.form?.get('config')))).toMatchObject({ transcription_config: { diarization: 'none' }, output_config: { srt_overrides: { max_lines: 2, max_line_length: 42 } } })
        const exportIndex = calls.findIndex(call => call.url.endsWith('format=srt'))
        expect(exportIndex).toBeGreaterThan(-1)
        expect(calls.findIndex(call => call.method === 'DELETE')).toBeGreaterThan(exportIndex)
      })
    } finally {
      if (oldKey === undefined) delete process.env['SPEECHMATICS_API_KEY']
      else process.env['SPEECHMATICS_API_KEY'] = oldKey
    }
  })

  test('Mistral current model captures fractional word chunks with diarization disabled', async () => {
    const oldKey = process.env['MISTRAL_API_KEY']
    process.env['MISTRAL_API_KEY'] = 'fixture'
    const calls = installFetch(() => jsonResponse({ text: 'Hello world', segments: [{ start: .125, end: .5, text: 'Hello' }, { start: .625, end: .875, text: 'world' }] }))
    try {
      await withTempDir(async dir => {
        const audio = join(dir, 'fixture.wav')
        await Bun.write(audio, 'fixture')
        const { result } = await runMistralStt(audio, dir, { model: 'voxtral-mini-2602', segmentOffsetMinutes: 30, diarizationOptions: { enabled: false } })
        expect(calls[0]?.form?.getAll('timestamp_granularities')).toEqual(['word'])
        expect(calls[0]?.form?.get('diarize')).toBe('false')
        expect(calls[0]?.form?.has('language')).toBe(false)
        expect(result.evidence?.words?.map(w => w.startSeconds)).toEqual([1800.125, 1800.625])
      })
    } finally {
      if (oldKey === undefined) delete process.env['MISTRAL_API_KEY']
      else process.env['MISTRAL_API_KEY'] = oldKey
    }
  })
})
