import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SonioxTranscriptResponse, TranscriptionEvidenceWord, TranscriptionResult } from '~/types'
import { getSttEngineCapabilities, resolveDiarizationOptions } from '~/cli/commands/stt/stt-cli'
import { normalizeSonioxTranscript } from '~/cli/commands/stt/diarization/soniox/parse-soniox-transcript'
import { formatEditorCaptions, resolveCaptionFormats } from '~/cli/commands/stt/workflows/captions/caption-editor-formats'
import { evaluateWordTiming } from '~/cli/commands/stt/workflows/timing/stt-word-metrics'
import { alignCtcWords } from '~/cli/commands/stt/workflows/timing/ctc-word-alignment'
import { reconcileSttSpeakers } from '~/cli/commands/stt/workflows/timing/reconcile-stt-speakers'
import { parseStoredTranscriptionResult } from '~/cli/commands/stt/stt-utils/stt-result-artifacts'
import { dtwWordEvidence } from '~/cli/commands/stt/workflows/timing/calibrate-whisper-timing'
import { tokenizeAlignmentWords } from '~/cli/commands/stt/workflows/timing/run-local-forced-alignment'
import { mergeSttChannelResults } from '~/cli/commands/stt/workflows/timing/stt-channel-workflows'
import { parseCompatibleSttWords } from '~/cli/commands/stt/stt-shared/openai-compatible-single-speaker'
import { resolveCaptionWordCoverage } from '~/cli/commands/stt/workflows/captions/caption-word-coverage'

const word = (text: string, startSeconds: number, endSeconds: number, speaker?: string): TranscriptionEvidenceWord => ({ text, normalized: text.toLowerCase(), startSeconds, endSeconds, timingSource: 'native', ...(speaker ? { speaker } : {}) })
const soniox = (tokens: Array<{ text: string; start_ms?: number; end_ms?: number; speaker?: string; language?: string; confidence?: number }>) => normalizeSonioxTranscript({ id: 'fixture', text: tokens.map(token => token.text).join(''), tokens } as SonioxTranscriptResponse, 60)
const withDirectory = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-caption-followup-'))
  try { await run(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}
const cli = async (args: string[], home: string) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', 'src/cli/create-cli.ts', 'extract', ...args, '--json'], { env: { PATH: process.env['PATH'] ?? '', HOME: home }, stdout: 'pipe', stderr: 'pipe' })
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { out, err, code }
}

describe('caption audit follow-ups', () => {
  test('model capability status distinguishes Together models and Mistral timing modes', () => {
    expect(getSttEngineCapabilities('together', 'openai/whisper-large-v3').diarizationValidation).toBe('documented')
    expect(getSttEngineCapabilities('together', 'nvidia/parakeet-tdt-0.6b-v3').diarizationValidation).toBe('live-tested')
    expect(getSttEngineCapabilities('mistral', 'voxtral-mini-2602').nativeWordTiming).toBe('without-diarization')
    expect(getSttEngineCapabilities('happyscribe', 'auto').supportsDiarizationToggle).toBe(false)
    expect(resolveDiarizationOptions({ diarization: false, diarizationSpeakerCount: 2 }, 'together', 'nvidia/parakeet-tdt-0.6b-v3')).toEqual({ enabled: false })
    expect(getSttEngineCapabilities('gemini-stt').diarizationKind).toBe('generated')
  })

  test('Parakeet response shape retains speaker words and exposes zero-length native intervals for caption fallback', () => {
    // Reduced anonymous fixture matching the observed 2026-09-10 live shape.
    const top = [
      { id: 0, word: 'Hello', start: .16, end: .32, speaker_id: 'SPEAKER_01' },
      { id: 1, word: 'to', start: 1.44, end: 1.44, speaker_id: 'SPEAKER_01' },
      { id: 2, word: 'you.', start: 1.6, end: 1.84, speaker_id: 'SPEAKER_01' },
      { id: 3, word: 'Thanks.', start: 2.16, end: 2.32, speaker_id: 'SPEAKER_00' }
    ]
    const raw = { text: 'Hello to you. Thanks.', words: top, speaker_segments: [
      { speaker_id: 'SPEAKER_01', words: top.slice(0, 3) },
      { speaker_id: 'SPEAKER_00', words: [{ ...top[3]!, id: 0 }] }
    ] }
    const words = parseCompatibleSttWords(raw, 0)
    const result: TranscriptionResult = { text: raw.text, segments: [
      { start: '00:00:00.160', end: '00:00:01.840', text: 'Hello to you.', speaker: 'SPEAKER_01' },
      { start: '00:00:02.160', end: '00:00:02.320', text: 'Thanks.', speaker: 'SPEAKER_00' }
    ], evidence: { words, rawResponse: raw } }
    expect(words).toHaveLength(4)
    expect(words[1]).toMatchObject({ startSeconds: 1.44, endSeconds: 1.44, speaker: 'SPEAKER_01', timingSource: 'native' })
    const coverage = resolveCaptionWordCoverage(result)
    expect(coverage).toMatchObject({ inferredWords: 1, invalidWords: 1, uncoveredText: false })
    expect(coverage.words.map(word => word.text).join(' ')).toBe(raw.text)
    expect(coverage.words[1]).toMatchObject({ speaker: 'SPEAKER_01', timingSource: 'interpolated' })
    expect(coverage.words[3]?.speaker).toBe('SPEAKER_00')
    expect(words[1]?.endSeconds).toBe(1.44)
  })

  test('Soniox keeps contractions, standalone punctuation, overlapping token ends, and confidence', () => {
    const result = soniox([
      { text: ' Don', start_ms: 100, end_ms: 450, confidence: .9 },
      { text: "'", start_ms: 300, end_ms: 310 },
      { text: 't', start_ms: 310, end_ms: 420, confidence: .8 },
      { text: ' stop', start_ms: 600, end_ms: 900 },
      { text: '.', start_ms: 890, end_ms: 900 }
    ])
    expect(result.evidence?.words?.map(word => word.text)).toEqual(["Don't", 'stop.'])
    expect(result.evidence?.words?.[0]).toMatchObject({ startSeconds: 60.1, endSeconds: 60.45, confidence: .8, timingSource: 'token_derived' })
  })

  test('Soniox splits Chinese words only where native tokens permit a boundary', () => {
    const result = soniox([
      { text: '你', start_ms: 0, end_ms: 100, language: 'zh' },
      { text: '好', start_ms: 100, end_ms: 200, language: 'zh' },
      { text: '世界', start_ms: 250, end_ms: 500, language: 'zh' },
      { text: '。', start_ms: 490, end_ms: 500, language: 'zh' }
    ])
    expect(result.evidence?.words?.map(word => word.text)).toEqual(['你好', '世界。'])
    expect(result.evidence?.words?.[1]).toMatchObject({ startSeconds: 60.25, endSeconds: 60.5 })
    expect(soniox([{ text: '你好世界', start_ms: 0, end_ms: 500, language: 'zh' }]).evidence?.words).toHaveLength(1)
  })

  test('Soniox keeps language and speaker boundaries without joining independent fragments', () => {
    const result = soniox([
      { text: 'bonjour', start_ms: 0, end_ms: 200, language: 'fr', speaker: '1' },
      { text: 'hello', start_ms: 200, end_ms: 400, language: 'en', speaker: '1' },
      { text: 'again', start_ms: 400, end_ms: 600, language: 'en', speaker: '2' }
    ])
    expect(result.evidence?.words?.map(word => word.text)).toEqual(['bonjour', 'hello', 'again'])
    expect(result.evidence?.rawResponse).toMatchObject({ tokens: [{ language: 'fr' }, { language: 'en' }, { speaker: '2' }] })
  })

  test('Soniox handles Japanese and Thai boundaries and keeps opening quotation marks', () => {
    for (const [language, texts, expected] of [
      ['ja', ['こん', 'にち', 'は', '世界'], ['こんにちは', '世界']],
      ['th', ['สวัส', 'ดี', 'โลก'], ['สวัสดี', 'โลก']],
      ['en', ['“', 'Hello', '”', ' there'], ['“Hello”', 'there']]
    ] as const) {
      expect(soniox(texts.map((text, index) => ({ text, start_ms: index * 100, end_ms: (index + 1) * 100, language }))).evidence?.words?.map(word => word.text)).toEqual([...expected])
    }
  })

  test('Soniox missing lexical token timing is marked repaired', () => {
    expect(soniox([{ text: ' hel', start_ms: 0, end_ms: 100 }, { text: 'lo' }]).evidence?.words?.[0]).toMatchObject({ text: 'hello', timingSource: 'repaired' })
  })

  test('editor formats retain Unicode and line breaks without treating text as markup', () => {
    const cues = [{ index: 0, start: 61.125, end: 62.875, text: 'Hello & <world>\n你好' }]
    expect(resolveCaptionFormats('all')).toEqual(['srt', 'vtt', 'ass', 'ttml', 'lrc'])
    expect(formatEditorCaptions('ttml', cues)).toContain('begin="00:01:01.125" end="00:01:02.875">Hello &amp; &lt;world&gt;<br/>你好')
    expect(formatEditorCaptions('ass', cues)).toContain('Dialogue: 0,0:01:01.13,0:01:02.88,Default,,0,0,0,,Hello & <world>\\N你好')
    expect(formatEditorCaptions('lrc', cues)).toBe('[01:01.13]Hello & <world> 你好\n')
    expect(formatEditorCaptions('srt', [{ ...cues[0]!, text: "Don't change apostrophes." }])).toContain("Don't change apostrophes.")
    expect(() => formatEditorCaptions('ass', [{ ...cues[0]!, text: '{\\pos(0,0)}' }])).toThrow('cannot safely preserve')
  })

  test('metrics retain omissions and repetitions and separate start, end, and speaker error', () => {
    const expected = [word('yes', 0, .2, 'A'), word('yes', 1, 1.2, 'A'), word('missing', 2, 2.2, 'B'), word('end', 61, 61.2, 'B')]
    const actual = [word('yes', .05, .25, 'A'), word('yes', 1.1, 1.3, 'wrong'), word('end', 61.3, 61.5, 'B')]
    const report = evaluateWordTiming(expected, actual)
    expect(report.referenceCoverage).toBe(.75)
    expect(report.unmatchedReferenceIndices).toEqual([2])
    expect(report.startAbsoluteError.medianMs).toBeCloseTo(100)
    expect(report.withinTolerance.map(band => band.fraction)).toEqual([1 / 3, 2 / 3, 2 / 3])
    expect(report.speakerAttribution.accuracy).toBeCloseTo(2 / 3)
    expect(report.driftByMinute[1]?.meanStartErrorMs).toBeCloseTo(300)
    expect(() => evaluateWordTiming(expected, [word('yes', 0, 0)])).toThrow('invalid word boundaries')
    expect(evaluateWordTiming([word('hello', 0, 1)], [word('goodbye', 0, 1)])).toMatchObject({ matchedWords: 0, startAbsoluteError: { medianMs: null } })
  })

  test('CTC forces repeated labels through a blank and preserves word separators', () => {
    const high = (id: number) => [0, 1, 2, 3].map(token => Math.log(token === id ? .97 : .01))
    const aligned = alignCtcWords([0, 1, 0, 1, 3, 2, 0].map(high), [{ text: 'oo', tokens: [1, 1] }, { text: 'a', tokens: [2] }], 0, .02, 3)
    expect(aligned[0]).toMatchObject({ text: 'oo', startSeconds: .02, endSeconds: .08 })
    expect(aligned[1]).toMatchObject({ text: 'a', startSeconds: .1, endSeconds: .12 })
    expect(() => alignCtcWords([high(1), high(1)], [{ text: 'oo', tokens: [1, 1] }], 0, .02)).toThrow('too few acoustic frames')
    expect(() => alignCtcWords([[NaN, 0]], [{ text: 'a', tokens: [1] }], 0, .02)).toThrow('finite log probabilities')
  })

  test('alignment attaches standalone display punctuation without inventing acoustic labels', () => {
    expect(tokenizeAlignmentWords('— Hello , world !')).toEqual(['— Hello ,', 'world !'])
    expect(() => tokenizeAlignmentWords('— ...')).toThrow('punctuation alone')
  })

  test('reviewed speaker reconciliation changes normalized labels and retains raw evidence', () => {
    const raw = { speaker: '0' }
    const result: TranscriptionResult = { text: 'hello again', segments: [{ start: '00:00:00.000', end: '00:00:02.000', text: 'hello again', speaker: 'chunk-1/0' }], evidence: { words: [word('hello', 0, .5, 'chunk-1/0'), word('again', 1, 2, 'chunk-2/0')], rawResponse: raw } }
    const changed = reconcileSttSpeakers(result, { 'chunk-1/0': 'Host', 'chunk-2/0': 'Guest' })
    expect(changed.evidence?.words?.map(word => word.speaker)).toEqual(['Host', 'Guest'])
    expect(changed.evidence?.rawResponse).toBe(raw)
    expect(result.segments[0]?.speaker).toBe('chunk-1/0')
    expect(() => reconcileSttSpeakers(result, { 'missing/0': 'Host' })).toThrow('unknown label')
  })

  test('aligned timing survives storage without becoming native or interpolated', () => {
    const result = parseStoredTranscriptionResult({ text: 'hello', segments: [], evidence: { timingQuality: 'aligned', words: [{ ...word('hello', 0, 1), timingSource: 'aligned' }] } })
    expect(result?.evidence?.timingQuality).toBe('aligned')
    expect(result?.evidence?.words?.[0]?.timingSource).toBe('aligned')
  })

  test('DTW reconstruction marks derived boundaries and rejects absent or reversed centers', () => {
    const raw = { transcription: [{ offsets: { to: 900 }, tokens: [{ text: ' Hello', t_dtw: 20 }, { text: ' world', t_dtw: 60 }] }] }
    expect(dtwWordEvidence(raw)).toEqual([{ ...word('Hello', .19, .4), timingSource: 'repaired' }, { ...word('world', .4, .9), timingSource: 'repaired' }])
    expect(() => dtwWordEvidence({ transcription: [] })).toThrow('no usable DTW')
    expect(() => dtwWordEvidence({ transcription: [{ offsets: { to: 900 }, tokens: [{ text: ' Hello', t_dtw: 60 }, { text: ' world', t_dtw: 20 }] }] })).toThrow('non-monotonic')
  })

  test('actual local CLI writes comparison and all formats, rejects overwrite and provider flags', async () => withDirectory(async dir => {
    const input = join(dir, 'result.json')
    await writeFile(input, JSON.stringify({ text: 'Hello world', segments: [{ start: '00:00:00.000', end: '00:00:02.000', text: 'Hello world' }], evidence: { words: [word('Hello', 0, .8), word('world', 1, 2)], timingQuality: 'native_word' }, referenceProvenance: { kind: 'synthetic-contract' } }))
    const compared = await cli([input, '--timing-reference', input, '--output-dir', join(dir, 'metrics')], dir)
    expect(compared).toMatchObject({ code: 0 })
    const report = await Bun.file(join(dir, 'metrics/timing-comparison.json')).json()
    expect(report).toMatchObject({ matchedWords: 2, referenceProvenance: { kind: 'synthetic-contract' } })
    expect(JSON.parse(compared.out).type).toBe('result')
    const output = join(dir, 'captions')
    expect(await cli([input, '--captions', '--caption-format', 'all', '--output-dir', output], dir)).toMatchObject({ code: 0 })
    for (const format of resolveCaptionFormats('all')) expect(await Bun.file(join(output, `captions.${format}`)).exists()).toBe(true)
    expect((await cli([input, '--captions', '--caption-format', 'all', '--output-dir', output], dir)).code).not.toBe(0)
    expect((await cli([input, '--timing-reference', input, '--provider', 'together'], dir)).code).not.toBe(0)
  }))

  test('actual channel workflow verifies extracted samples, applies offsets once, and reconciles reviewed labels', async () => withDirectory(async dir => {
    const audio = join(dir, 'stereo.wav')
    const generate = Bun.spawn(['runtime/bin/ffmpeg', '-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'aevalsrc=0.125*sin(2*PI*330*t)|0.25*sin(2*PI*660*t):s=16000:d=1.25', '-c:a', 'pcm_s16le', audio], { stdout: 'pipe', stderr: 'pipe' })
    const generatedError = await new Response(generate.stderr).text()
    expect({ code: await generate.exited, generatedError }).toMatchObject({ code: 0 })
    const channelsOutput = join(dir, 'channels')
    const split = await cli([audio, '--split-channels', '--output-dir', channelsOutput], dir)
    expect(split).toMatchObject({ code: 0 })
    const channels = await Bun.file(join(channelsOutput, 'channels.json')).json()
    expect(channels.channels).toHaveLength(2)
    expect(channels.channels[0].decodedSha256).not.toBe(channels.channels[1].decodedSha256)
    const packetPath = join(channelsOutput, 'channel-results.json')
    const packet = await Bun.file(packetPath).json()
    for (const [index, entry] of packet.channels.entries()) {
      const resultPath = join(dir, `channel-${index}.json`)
      const text = index === 0 ? 'Hello' : 'again'
      await writeFile(resultPath, JSON.stringify({ text, segments: [{ start: '00:00:00.100', end: index === 0 ? '00:00:00.800' : '00:00:00.200', text }], evidence: { words: [word(text, .1, index === 0 ? .8 : .2)], timingQuality: 'native_word' } }))
      entry.result = resultPath; entry.offsetSeconds = index * .4
    }
    await writeFile(packetPath, JSON.stringify(packet))
    const mergedOutput = join(dir, 'merged')
    expect(await cli([packetPath, '--merge-channel-results', '--output-dir', mergedOutput], dir)).toMatchObject({ code: 0 })
    const resultPath = join(mergedOutput, 'result.json')
    const merged = await Bun.file(resultPath).json()
    expect(merged.evidence.words[1]).toMatchObject({ startSeconds: .5, speaker: 'stream-0-channel-2' })
    expect(merged.evidence.words[0].endSeconds).toBe(.8)
    expect(merged.evidence.words[0].endSeconds).toBeGreaterThan(merged.evidence.words[1].startSeconds)
    const original = await Bun.file(packet.channels[0].result).json()
    await writeFile(packet.channels[0].result, JSON.stringify({ ...original, text: 'Hello omitted speech' }))
    await expect(mergeSttChannelResults(packetPath)).rejects.toThrow('complete transcript text')
    await writeFile(packet.channels[0].result, JSON.stringify(original))
    const mapOutput = join(dir, 'map')
    expect(await cli([resultPath, '--speaker-map-template', '--output-dir', mapOutput], dir)).toMatchObject({ code: 0 })
    const mapPath = join(mapOutput, 'speaker-map.json'), map = await Bun.file(mapPath).json()
    map.reason = 'Fixture channels contain known separate speakers.'
    map.speakers = { 'stream-0-channel-1': 'Host', 'stream-0-channel-2': 'Guest' }
    await writeFile(mapPath, JSON.stringify(map))
    const final = join(dir, 'reconciled')
    expect(await cli([resultPath, '--speaker-map', mapPath, '--output-dir', final], dir)).toMatchObject({ code: 0 })
    expect((await Bun.file(join(final, 'result.json')).json()).evidence.words.map((word: TranscriptionEvidenceWord) => word.speaker)).toEqual(['Host', 'Guest'])
    map.sourceSha256 = 'wrong-source'
    await writeFile(mapPath, JSON.stringify(map))
    expect((await cli([resultPath, '--speaker-map', mapPath, '--output-dir', join(dir, 'rejected')], dir)).code).not.toBe(0)
  }))

  test('forced alignment rejects mismatched or overlapping transcript spans before starting its backend', async () => withDirectory(async dir => {
    const audio = join(dir, 'audio.wav'), transcript = join(dir, 'result.json')
    await writeFile(audio, 'fixture')
    await writeFile(transcript, JSON.stringify({ text: 'one two', segments: [{ start: '00:00:00.000', end: '00:00:02.000', text: 'one' }, { start: '00:00:01.000', end: '00:00:03.000', text: 'two' }] }))
    const result = await cli([audio, '--align-transcript', transcript, '--alignment-model', dir, '--alignment-python', 'must-never-be-invoked', '--output-dir', join(dir, 'align')], dir)
    expect(result.code).not.toBe(0)
    expect(result.out + result.err).toContain('overlapping speech')
    expect(await Bun.file(join(dir, 'align/alignment-work/clips.json')).exists()).toBe(false)
  }))
})
