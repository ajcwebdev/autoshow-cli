import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGrokStt } from '~/cli/commands/stt/diarization/stt-grok/run-grok-stt'
import { SUPPORTED_GROK_STT_MODELS, validateGrokSttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { getModelRegistry, getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['XAI_API_KEY'],
  tempPrefix: 'autoshow-grok-stt-',
  beforeEachExtra: () => {
    process.env['XAI_API_KEY'] = 'synthetic-xai-key'
  }
})

// xAI's REST STT reference documents POST https://api.x.ai/v1/stt with multipart fields, `model` defaulting to and
// listing only grok-voice-transcribe-2.0, option fields before `file` because later fields may be ignored, an integer
// `speaker` on words when diarize=true, and text/language/duration/words in every response
// (https://docs.x.ai/developers/model-capabilities/audio/speech-to-text, retrieved 2026-10-17). The release notes date
// 2.0 to 2026-09-17 and the end of 1.0 to 2026-10-02 (https://docs.x.ai/developers/release-notes).
const MODEL = 'grok-voice-transcribe-2.0'
const RETIRED = 'speech-to-text'

const DIARIZED_RESPONSE = {
  text: 'Welcome to the show. Thanks for having me.',
  language: 'en',
  duration: 2.4,
  words: [
    { text: 'Welcome', start: 0, end: 0.4, speaker: 0 },
    { text: 'show.', start: 0.4, end: 1.1, speaker: 0 },
    { text: 'Thanks', start: 1.5, end: 1.8, speaker: 1 },
    { text: 'me.', start: 1.8, end: 2.4, speaker: 1 }
  ]
}

const writeAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const dir = await tempDirs.make()
  const audioPath = join(dir, 'synthetic.mp3')
  await Bun.write(audioPath, new Uint8Array([0x49, 0x44, 0x33, 0x04]))
  return { audioPath, outputDir: dir }
}

describe('xAI Grok STT contracts', () => {
  test('the selector exposes only the explicit 2.0 model and it is the bare-provider and --all-stt choice', () => {
    expect([...SUPPORTED_GROK_STT_MODELS]).toEqual([MODEL])
    expect(validateGrokSttModel(MODEL)).toBe(MODEL)
    expect(resolveCheapestModelForFlag('grok-stt')).toBe(MODEL)
    expect(collectSttTargets(buildOptsFromFlags({ 'all-stt': true })).filter(target => target.service === 'grok').map(target => target.model)).toEqual([MODEL])
    const entry = requireDefined(getModelRegistry().stt['grok']?.models[MODEL], 'Grok STT registry entry')
    expect(entry).toMatchObject({ pricingSourceUrl: 'https://docs.x.ai/developers/pricing', pricingCheckedAt: '2026-10-17', pricingCurrency: 'USD', costPerHourCents: 10 })
    expect(entry.pricingTier).toContain('REST')
  })

  test('the retired speech-to-text selector names its successor and fails before any request', () => {
    const calls = installMockFetch(() => { throw Error('Provider must not be called') })
    const message = 'Model "speech-to-text" is retired for --provider/--stt grok[=model]. Use "grok-voice-transcribe-2.0" instead.'
    expect(() => validateGrokSttModel(RETIRED)).toThrow(message)
    expect(() => buildOptsFromFlags({ 'grok-stt': RETIRED })).toThrow(message)
    expect(() => validateGrokSttModel('grok-voice-transcribe-1.0')).toThrow(`Invalid model "grok-voice-transcribe-1.0" for --provider/--stt grok[=model]. Allowed values: ${MODEL}`)
    expect(calls).toHaveLength(0)
  })

  test('finished speech-to-text runs keep a historical rate while the active registry drops the name', () => {
    expect(getModelRegistry().stt['grok']?.models[RETIRED]).toBeUndefined()
    expect(getRetiredModelReplacement('stt', 'grok', RETIRED)).toBe(MODEL)
    // $0.10 per REST audio hour for both identities.
    expect(computeSttCost('grok', RETIRED, 3600)).toBeCloseTo(10, 6)
    expect(computeSttCost('grok', MODEL, 3600)).toBeCloseTo(10, 6)
  })

  test('dispatch pins the model first and keeps file last across default, override, and reset controls', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse(DIARIZED_RESPONSE))

    await runGrokStt(audioPath, outputDir, { model: MODEL, segmentOffsetMinutes: 0 })
    await runGrokStt(audioPath, outputDir, { model: MODEL, segmentOffsetMinutes: 0, diarizationOptions: { enabled: false }, grokSttVerbatim: true })
    await runGrokStt(audioPath, outputDir, { model: MODEL, segmentOffsetMinutes: 0, diarizationOptions: { enabled: true }, grokSttVerbatim: false })

    expect(calls).toHaveLength(3)
    for (const call of calls) {
      expect(call.url).toBe('https://api.x.ai/v1/stt')
      expect(call.method).toBe('POST')
      expect(call.headers.get('authorization')).toBe('Bearer synthetic-xai-key')
      const keys = [...call.form!.keys()]
      expect(keys[0]).toBe('model')
      expect(keys.at(-1)).toBe('file')
      expect(call.form?.get('model')).toBe(MODEL)
      expect(call.form?.get('language')).toBe('en')
    }
    expect(calls.map(call => [call.form?.get('format'), call.form?.get('filler_words'), call.form?.get('diarize')])).toEqual([
      ['true', null, 'true'],
      ['false', 'true', 'false'],
      ['true', null, 'true']
    ])
  })

  test('diarized words become speaker turns and native word evidence', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse(DIARIZED_RESPONSE))
    const { result, metadata } = await runGrokStt(audioPath, outputDir, { model: MODEL, segmentOffsetMinutes: 0 })

    expect(metadata).toMatchObject({ transcriptionService: 'grok', transcriptionModel: MODEL })
    expect(result.text).toBe('Welcome to the show. Thanks for having me.')
    expect(result.segments.map(segment => [segment.start, segment.end, segment.speaker])).toEqual([
      ['00:00:00.000', '00:00:01.100', 'speaker-0'],
      ['00:00:01.500', '00:00:02.400', 'speaker-1']
    ])
    expect(result.evidence?.words?.every(word => word.timingSource === 'native')).toBe(true)
  })

  for (const { name, response } of [
    { name: 'missing text', response: { language: 'en', words: [] } },
    { name: 'string word timing', response: { text: 'Hello.', words: [{ text: 'Hello.', start: '0', end: 1 }] } }
  ]) {
    test(`HTTP 200 with ${name} fails response validation without writing a transcript artifact`, async () => {
      const { audioPath, outputDir } = await writeAudioFixture()
      installMockFetch(() => jsonResponse(response))
      await expect(runGrokStt(audioPath, outputDir, { model: MODEL, segmentOffsetMinutes: 0 })).rejects.toThrow('Grok STT response')
      expect(await Bun.file(join(outputDir, 'transcription.txt')).exists()).toBe(false)
    })
  }
})
