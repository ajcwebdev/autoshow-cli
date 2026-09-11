import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { selectWhisperfileCaptionArgs } from '~/cli/commands/stt/local/whisperfile/transcribe'
import { extractWhisperfileWords } from '~/cli/commands/stt/local/whisperfile/parse-whisperfile-output'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { GladiaStatusResponseSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { parseHappyScribeTranscriptPayload } from '~/cli/commands/stt/diarization/happyscribe/parse-happyscribe-transcript'
import { parseCompatibleSttWords } from '~/cli/commands/stt/stt-shared/openai-compatible-single-speaker'
import { buildTogetherSttFormFields } from '~/cli/commands/stt/diarization-off-by-default/together/run-together-stt'
import { resolveCaptionWordCoverage } from '~/cli/commands/stt/workflows/captions/caption-word-coverage'
import { mergeTranscriptionEvidence } from '~/cli/commands/stt/stt-utils/stt-evidence'
import { parseStoredTranscriptionResult } from '~/cli/commands/stt/stt-utils/stt-result-artifacts'
import { buildTranscriptionCues, TRANSCRIPT_CUE_LIMITS } from '~/cli/commands/audio/music/lyrics-video/cue-builder'
import { saveNativeSubtitle } from '~/cli/commands/stt/workflows/captions/native-subtitles'
import { buildYoutubeCaptionTranscription } from '~/cli/commands/stt/direct-url/youtube-captions'
import { buildAssemblyAiTranscriptRequest } from '~/cli/commands/stt/diarization/assemblyai/run-assemblyai-stt'
import { buildSpeechmaticsTranscriptionConfig } from '~/cli/commands/stt/diarization/speechmatics/run-speechmatics-stt'
import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import type { TranscriptionResult } from '~/types'
import { word, partial } from './caption-evidence-fixtures'
import { setupCaptionContractLifecycle } from './caption-contract-lifecycle'

const { withTempDir } = setupCaptionContractLifecycle()

describe('caption evidence normalization contracts', () => {
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
      const disabled = buildTogetherSttFormFields(model, undefined, { enabled: false, speakerCount: 2 })
      expect(disabled).toMatchObject({ diarize: 'false' })
      expect(disabled).not.toHaveProperty('min_speakers')
      expect(disabled).not.toHaveProperty('max_speakers')
    }
  })

  test('caption spacing distinguishes elided words from contraction suffix tokens', () => {
    const text = "They're invited 'cause we like 'em."
    const result: TranscriptionResult = { text, segments: [{start:'00:00:00.000',end:'00:00:03.000',text}], evidence: {words: [
      word('They',0,.2), word("'re",.2,.3), word('invited',.3,.6), word("'cause",.6,.9), word('we',.9,1.1), word('like',1.1,1.3), word("'em.",1.3,1.5)
    ]} }
    expect(buildTranscriptionCues(result, TRANSCRIPT_CUE_LIMITS).cues.map(cue=>cue.text).join(' ')).toBe(text)
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
    const words = extractWhisperfileWords(json)
    expect(words.map(w => w.word)).toEqual(["Don't", 'stop.'])
    expect(words[0]).toMatchObject({ start: .125, end: .425 })
    expect(words[0]?.confidence).toBeCloseTo(.93)
    expect(extractWhisperfileWords(json, { maxEndSeconds: .55 })[1]).toMatchObject({ end: .55, repaired: true })
  })

  test('flags reach provider targets including explicit opt-out and optional Together diarization', () => {
    const options = buildOptsFromFlags({ 'assemblyai-stt': ['universal-3-5-pro'], 'together-stt': ['openai/whisper-large-v3'], diarization: false, 'native-subtitles': true })
    const targets = collectSttTargets(options)
    expect(targets).toHaveLength(2)
    expect(targets.every(target => target.diarizationOptions?.enabled === false && target.nativeSubtitles)).toBe(true)
    const together = collectSttTargets(buildOptsFromFlags({ 'together-stt': ['nvidia/parakeet-tdt-0.6b-v3'], diarization: true, 'speaker-count': '2' }))[0]
    expect(together?.diarizationOptions).toEqual({ enabled: true, speakerCount: 2 })
  })

  test('Gladia native subtitle strings survive response validation', () => {
    const response = validateData(GladiaStatusResponseSchema, { id: 'fixture', status: 'done', result: { transcription: { full_transcript: 'Hello', subtitles: [{ format: 'srt', subtitles: 'native srt' }, { format: 'vtt', subtitles: 'native vtt' }] } } }, 'fixture')
    expect(response.result?.transcription?.subtitles).toHaveLength(2)
  })

  test('local caption flags follow each installed engine capability', () => {
    expect(selectWhisperfileCaptionArgs('-sow --split-on-word -osrt -ovtt -olrc', true)).toEqual(['-sow', '-osrt', '-ovtt', '-olrc'])
    expect(selectWhisperfileCaptionArgs('-osrt -ovtt', true)).toEqual(['-osrt', '-ovtt'])
    expect(selectWhisperfileCaptionArgs('', true)).toEqual([])
    expect(selectWhisperfileCaptionArgs('-sow -osrt', false)).toEqual(['-sow'])
  })
})
