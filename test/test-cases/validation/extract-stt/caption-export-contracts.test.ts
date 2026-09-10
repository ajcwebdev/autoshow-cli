import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runSpeechmaticsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'
import { runMistralStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/run-mistral-stt'
import { createHappyScribeApiClient } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe-api'
import { runAssemblyAiTranscribe } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { runDeepinfraTranscribe } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deepinfra/run-deepinfra-stt'
import { runDeepgramTranscribe } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-deepgram/run-deepgram-stt'
import { runGrokStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-grok/run-grok-stt'
import { selectWhisperCaptionArgs } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/run-whispercpp-core'
import { extractWhisperWords } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/parse-whisper-output'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { GladiaStatusResponseSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { parseHappyScribeTranscriptPayload } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/parse-happyscribe-transcript'
import { parseCompatibleSttWords, runOpenAICompatibleSingleSpeakerStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/openai-compatible-single-speaker'
import { buildTogetherSttFormFields } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/together/run-together-stt'
import { resolveCaptionWordCoverage } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/caption-word-coverage'
import { mergeTranscriptionEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { parseStoredTranscriptionResult } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import { buildTranscriptionCues, TRANSCRIPT_CUE_LIMITS } from '~/cli/commands/process-steps/step-7-music/lyrics-video/cue-builder'
import { runCaptionExport } from '~/cli/commands/process-steps/step-2-extract/run-caption-export'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { saveNativeSubtitle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/native-subtitles'
import { buildYoutubeCaptionTranscription } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import { buildAssemblyAiTranscriptRequest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { buildSpeechmaticsTranscriptionConfig } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'
import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from '../providers/openai-rest-contracts/shared'
import type { TranscriptionResult } from '~/types'

installOpenAIRestContractHooks()
const word = (text: string, start: number, end: number, speaker?: string) => ({ text, normalized: text.toLowerCase(), startSeconds: start, endSeconds: end, timingSource: 'native' as const, ...(speaker ? { speaker } : {}) })
const partial: TranscriptionResult = {
  text: 'Hello world. Goodbye.',
  segments: [
    { start: '00:00:00.125', end: '00:00:01.500', text: 'Hello world.', speaker: 'A' },
    { start: '00:00:02.125', end: '00:00:03.750', text: 'Goodbye.', speaker: 'B' }
  ],
  evidence: { words: [word('Hello', .125, .5, 'A'), word('world.', .75, 1.5, 'A')], timingQuality: 'native_word' }
}

describe('caption evidence and export', () => {
  test('Happy Scribe retains all paragraph words and inherited speakers', () => {
    const result = parseHappyScribeTranscriptPayload([
      { speaker: 'A', data_start: .125, data_end: 1.5, text: 'Hello world.', words: [{ text: 'Hello', data_start: .125, data_end: .5 }, { text: 'world.', data_start: .75, data_end: 1.5 }] },
      { speaker: 'B', data_start: 2.125, data_end: 3.75, text: 'Goodbye.', words: [{ text: 'Goodbye.', data_start: 2.125, data_end: 3.75 }] }
    ], { offsetSeconds: 1800 })
    expect(result.evidence?.words?.map(w => w.text)).toEqual(['Hello', 'world.', 'Goodbye.'])
    expect(result.evidence?.words?.at(-1)).toMatchObject({ speaker: 'B', startSeconds: 1802.125 })
    expect(buildTranscriptionCues(result, TRANSCRIPT_CUE_LIMITS).cues.map(c => c.text).join(' ')).toBe('Hello world. Goodbye.')
  })

  test('partial evidence falls back only for missing text without changing native evidence', () => {
    const coverage = resolveCaptionWordCoverage(partial)
    expect(coverage.inferredWords).toBe(1)
    expect(coverage.words[0]).toEqual(partial.evidence!.words![0])
    expect(coverage.words.at(-1)).toMatchObject({ text: 'Goodbye.', speaker: 'B', startSeconds: 2.125, timingSource: 'interpolated' })
    expect(partial.evidence?.words).toHaveLength(2)
    expect(buildTranscriptionCues(partial, TRANSCRIPT_CUE_LIMITS).cues.map(c => c.text).join(' ')).toBe(partial.text)
  })

  test('mixed chunk quality and raw provenance survive serialization', () => {
    const evidence = mergeTranscriptionEvidence([partial.evidence, { timingQuality: 'generated', rawResponse: { original: 'chunk two' } }])
    const parsed = parseStoredTranscriptionResult(JSON.parse(JSON.stringify({ ...partial, evidence })))
    expect(parsed?.evidence?.timingQuality).toBe('mixed')
    expect(parsed?.evidence?.chunkEvidence?.[1]?.rawResponse).toEqual({ original: 'chunk two' })
    expect(mergeTranscriptionEvidence([partial.evidence, undefined])?.timingQuality).toBe('mixed')
  })

  test('invalid and duplicate boundaries do not silently lose covered text', () => {
    const result = { ...partial, evidence: { words: [...partial.evidence!.words!, partial.evidence!.words![0]!, word('bad', NaN, 4)] } }
    const coverage = resolveCaptionWordCoverage(result)
    expect(coverage.invalidWords).toBe(1)
    expect(coverage.words).toHaveLength(3)
    expect(coverage.uncoveredText).toBe(false)
  })

  test('Together nested and top-level words preserve coverage and speaker identity once', () => {
    const words = parseCompatibleSttWords({
      words: [{ word: 'Hello', start: .125, end: .5 }, { word: 'world', start: .6, end: 1 }],
      speaker_segments: [{ speaker_id: 2, words: [{ text: 'Hello', start: .125, end: .5 }] }]
    }, 1800)
    expect(words).toHaveLength(2)
    expect(words[0]).toMatchObject({ speaker: 'speaker-2', startSeconds: 1800.125 })
    for (const model of ['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3']) {
      expect(buildTogetherSttFormFields(model, undefined, { enabled: true, speakerCount: 2 })).toMatchObject({ diarize: 'true', min_speakers: '2', max_speakers: '2' })
    }
  })

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

  test('caption spacing distinguishes elided words from contraction suffix tokens', () => {
    const text = "They're invited 'cause we like 'em."
    const result: TranscriptionResult = { text, segments: [{start:'00:00:00.000',end:'00:00:03.000',text}], evidence: {words: [
      word('They',0,.2), word("'re",.2,.3), word('invited',.3,.6), word("'cause",.6,.9), word('we',.9,1.1), word('like',1.1,1.3), word("'em.",1.3,1.5)
    ]} }
    expect(buildTranscriptionCues(result, TRANSCRIPT_CUE_LIMITS).cues.map(cue=>cue.text).join(' ')).toBe(text)
  })

  test('offline word export needs no audio or provider and refuses to overwrite', async () => {
    installFetch(() => { throw new Error('Export must be offline') })
    await withTempDir(async dir => {
      const source = join(dir, 'result.json'), output = join(dir, 'captions')
      await Bun.write(source, JSON.stringify(partial))
      configurePinnedRunDir(output)
      try {
        await runCaptionExport(source, { 'caption-mode': 'word' })
        expect(await Bun.file(join(output, 'captions.srt')).text()).toContain('00:00:00,125 --> 00:00:00,500')
        expect(await Bun.file(join(output, 'captions.vtt')).text()).toContain('[B] Goodbye.')
        expect((await Bun.file(join(output, 'captions.json')).json()).inferredWords).toBe(1)
        await expect(runCaptionExport(source, {})).rejects.toThrow()
      } finally { resetPinnedRunDir() }
    })
  })

  test('failed native export retains canonical result', async () => {
    await withTempDir(async dir => {
      const source = join(dir, 'result.json')
      await Bun.write(source, JSON.stringify(partial))
      await saveNativeSubtitle(join(dir, 'transcription'), 'srt', async () => { throw new Error('Export unavailable') })
      expect(await Bun.file(source).json()).toEqual(partial)
      expect(await Bun.file(join(dir, 'transcription.native.srt.error.json')).exists()).toBe(true)
    })
  })

  test('diarization off uses valid provider requests and correct billing', () => {
    expect(buildAssemblyAiTranscriptRequest('url', 'universal-3-5-pro', 2, false)).toMatchObject({ speaker_labels: false })
    expect(buildAssemblyAiTranscriptRequest('url', 'universal-3-5-pro', 2, false)).not.toHaveProperty('speakers_expected')
    expect(buildSpeechmaticsTranscriptionConfig('melia-1', false)).toMatchObject({ transcription_config: { diarization: 'none' } })
    expect(computeBilledSttCost('assemblyai', 'universal-3-5-pro', 3600, { enabled: false }).cost).toBe(21)
    expect(computeBilledSttCost('deepgram', 'nova-3', 3600, { enabled: false }).cost).toBe(25.8)
  })

  test('YouTube inline spans and voice tags survive while later repeated speech is retained', () => {
    const result = buildYoutubeCaptionTranscription('WEBVTT\n\n00:00:01.125 --> 00:00:03.750\n<v Host>Hello <00:00:02.250>world.</v>\n\n00:00:05.000 --> 00:00:06.000\n<v Host>Hello world.</v>\n', { kind: 'auto', language: 'en', track: { ext: 'vtt', url: 'https://fixture.invalid/captions.vtt' } })
    expect(result?.segments[0]).toMatchObject({ start: '00:00:01.125', end: '00:00:02.250', speaker: 'Host', text: 'Hello' })
    expect(result?.text).toBe('Hello world. Hello world.')
    expect(result?.evidence?.capabilities?.hasNativeWordTiming).toBe(false)
  })
  test('local token normalization preserves contractions, confidence and repaired provenance', () => {
    const texts = [' Don', "'", 't', ' stop', '.']
    const json = JSON.stringify({ transcription: texts.map((text, i) => ({
      text, timestamps: { from: '00:00:00.' + String(125 + i * 100), to: '00:00:00.' + String(225 + i * 100) },
      offsets: { from: 125 + i * 100, to: 225 + i * 100 }, tokens: [{ p: .95 - i * .01 }]
    })) })
    const words = extractWhisperWords(json)
    expect(words.map(w => w.word)).toEqual(["Don't", 'stop.'])
    expect(words[0]).toMatchObject({ start: .125, end: .425 })
    expect(words[0]?.confidence).toBeCloseTo(.93)
    expect(extractWhisperWords(json, { maxEndSeconds: .55 })[1]).toMatchObject({ end: .55, repaired: true })
  })

  test('flags reach provider targets including explicit opt-out and optional Together diarization', () => {
    const options = buildOptsFromFlags({ 'assemblyai-stt': ['universal-3-5-pro'], 'together-stt': ['openai/whisper-large-v3'], diarization: false, 'native-subtitles': true })
    const targets = collectSttTargets(options)
    expect(targets).toHaveLength(2)
    expect(targets.every(target => target.diarizationOptions?.enabled === false && target.nativeSubtitles)).toBe(true)
    const together = collectSttTargets(buildOptsFromFlags({ 'together-stt': ['nvidia/parakeet-tdt-0.6b-v3'], diarization: true, 'speaker-count': '2' }))[0]
    expect(together?.diarizationOptions).toEqual({ enabled: true, speakerCount: 2 })
  })

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

  test('Gladia native subtitle strings survive response validation', () => {
    const response = validateData(GladiaStatusResponseSchema, { id: 'fixture', status: 'done', result: { transcription: { full_transcript: 'Hello', subtitles: [{ format: 'srt', subtitles: 'native srt' }, { format: 'vtt', subtitles: 'native vtt' }] } } }, 'fixture')
    expect(response.result?.transcription?.subtitles).toHaveLength(2)
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

  test('actual caption CLI exports without credentials, audio, or model setup', async () => {
    await withTempDir(async dir => {
      const source = join(dir, 'result.json'), output = join(dir, 'export')
      await Bun.write(source, JSON.stringify(partial))
      const child = Bun.spawn([process.execPath, '--no-env-file', 'src/cli/create-cli.ts', 'extract', source, '--captions', '--json', '--caption-mode', 'word', '--no-caption-speakers', '--output-dir', output], {
        stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '' }
      })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ code, stderr, stdout }).toMatchObject({ code: 0 })
      expect(JSON.parse(stdout)).toMatchObject({ type: 'result', status: 'success', data: { outputDir: output } })
      const vtt = await Bun.file(join(output, 'captions.vtt')).text()
      expect(vtt).toContain('Goodbye.')
      expect(vtt).not.toContain('[B]')
    })
  })


  test('actual media CLI transcribes audio/video once and exports captions alongside saved evidence', async () => {
    await withTempDir(async dir => {
      const preload = join(dir, 'mock-provider.ts')
      const calls = join(dir, 'calls.txt')
      const config = join(dir, 'config.json')
      await Bun.write(config, '{}')
      await Bun.write(preload, `
        import { appendFileSync } from 'node:fs'
        globalThis.fetch = async (input, init) => {
          const url = String(input)
          if (!url.includes('api.deepinfra.com/v1/audio/transcriptions')) throw new Error('Network blocked by caption contract test: ' + url)
          appendFileSync(${JSON.stringify(calls)}, 'transcribe\\n')
          if (init.body instanceof FormData) {
            const file = init.body.get('file')
            if (!(file instanceof File)) throw new Error('Missing uploaded file')
          }
          return Response.json({ text: 'Hello world.', segments: [{ start: 0.125, end: 0.875, text: 'Hello world.' }], words: [{ word: 'Hello', start: 0.125, end: 0.5 }, { word: 'world.', start: 0.625, end: 0.875 }] })
        }
      `)
      for (const scenario of ['wav', 'mp4', 'multi']) {
        const extension = scenario === 'multi' ? 'wav' : scenario
        const source = join(dir, scenario + '.' + extension), output = join(dir, scenario)
        const generate = Bun.spawn(['runtime/bin/ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', ...(extension === 'mp4' ? ['-f', 'lavfi', '-i', 'color=c=black:s=32x32', '-c:v', 'mpeg4', '-c:a', 'aac'] : []), '-t', '1', source], { stdout: 'pipe', stderr: 'pipe' })
        const generatedError = await new Response(generate.stderr).text()
        expect({ code: await generate.exited, generatedError }).toMatchObject({ code: 0 })
        const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--provider', 'deepinfra=openai/whisper-large-v3', ...(scenario === 'multi' ? ['--provider', 'deepinfra=openai/whisper-large-v3-turbo'] : []), '--captions', ...(scenario === 'mp4' ? ['--embed-captions', '--caption-container', 'both', '--stt-audio-profile', 'lossless'] : []), '--json', '--caption-mode', 'word', '--no-caption-speakers', '--config-path', config, '--output-dir', output], {
          stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: dir, DEEPINFRA_API_KEY: 'fixture-no-network' }
        })
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
        expect({ code, stderr, stdout }).toMatchObject({ code: 0 })
        expect(JSON.parse(stdout)).toMatchObject({ type: 'result', status: 'success', data: { outputDir: output } })
        const files = JSON.parse(stdout).data.files as Record<string, string>
        if (scenario === 'mp4') {
          expect(Object.values(files).filter(path => /captioned\.(mp4|mkv)$/.test(path))).toHaveLength(2)
          expect(await Bun.file(join(output, 'source-timeline.json')).json()).toMatchObject({ profile: 'lossless', decodedSamplesMatch: true, sampleFormat: 'float32', sampleRate: 16000 })
          expect(Object.values(files).some(path => path.endsWith('.wav'))).toBe(true)
          const embedding = await Bun.file(join(output, 'caption-embedding.json')).json()
          expect(embedding.verification.mp4.subtitleCuesMatch).toBe(true)
          expect(embedding.verification.mkv.streams).toHaveLength(2)
        }
        const subtitles = Object.values(files).filter(path => path.endsWith('captions.vtt'))
        expect(subtitles).toHaveLength(scenario === 'multi' ? 2 : 1)
        for (const subtitle of subtitles) {
          expect(await Bun.file(subtitle).text()).toContain('00:00:00.125 --> 00:00:00.500')
          expect(await Bun.file(subtitle.replace('captions.vtt', 'captions.srt')).exists()).toBe(true)
          expect((await Bun.file(subtitle.replace('captions.vtt', 'result.json')).json()).evidence.words).toHaveLength(2)
        }
        if (scenario === 'wav') {
          for (const extra of [['--price'], ['--caption-line-width', '0']]) {
            const validation = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--provider', 'deepinfra', '--captions', '--json', '--config-path', config, ...extra], {
              stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: dir, DEEPINFRA_API_KEY: 'fixture-no-network' }
            })
            const [validationOut, validationErr, validationCode] = await Promise.all([new Response(validation.stdout).text(), new Response(validation.stderr).text(), validation.exited])
            if (extra[0] === '--price') expect({ validationCode, validationOut, validationErr }).toMatchObject({ validationCode: 0 })
            else expect(validationCode).not.toBe(0)
            expect((await Bun.file(calls).text()).trim().split('\n')).toHaveLength(1)
          }
        }
      }
      expect((await Bun.file(calls).text()).trim().split('\n')).toHaveLength(4)
    })
  }, 30_000)

  test('local caption flags follow each installed engine capability', () => {
    expect(selectWhisperCaptionArgs('-sow --split-on-word -osrt -ovtt -olrc', true)).toEqual(['-sow', '-osrt', '-ovtt', '-olrc'])
    expect(selectWhisperCaptionArgs('-osrt -ovtt', true)).toEqual(['-osrt', '-ovtt'])
    expect(selectWhisperCaptionArgs('', true)).toEqual([])
    expect(selectWhisperCaptionArgs('-sow -osrt', false)).toEqual(['-sow'])
  })

})
