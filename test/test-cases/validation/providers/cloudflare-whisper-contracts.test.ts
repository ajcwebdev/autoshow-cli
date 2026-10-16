import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  buildCloudflareRunUrl,
  buildCloudflareWhisperRequest,
  runCloudflareStt
} from '~/cli/commands/stt/diarization-off-by-default/cloudflare/run-cloudflare-stt'
import { SUPPORTED_CLOUDFLARE_STT_MODELS, validateCloudflareSttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getSttEngineCapabilities } from '~/cli/commands/stt/stt-cli'
import { classifySttSplitLimitError } from '~/cli/commands/stt/run-stt/split-limits'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_GATEWAY_ID'],
  tempPrefix: 'autoshow-cloudflare-stt-',
  beforeEachExtra: () => {
    process.env['CLOUDFLARE_API_TOKEN'] = 'synthetic-token'
    process.env['CLOUDFLARE_ACCOUNT_ID'] = 'synthetic-account'
    delete process.env['CLOUDFLARE_AI_GATEWAY_ID']
  }
})

const TURBO = '@cf/openai/whisper-large-v3-turbo'
const WHISPER = '@cf/openai/whisper'
const TINY_EN = '@cf/openai/whisper-tiny-en'
const AUDIO_BYTES = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])

// Captured live on 2026-10-13 from the 1-audio benchmark clip and trimmed to the opening words.
// @cf/openai/whisper returns punctuated words and a VTT whose first cue has no start time and whose times
// omit hours, so segments have to come from the words. @cf/openai/whisper-large-v3-turbo returns lowercase,
// unpunctuated, space-prefixed segment text and words, plus Neuron usage.
const WHISPER_RESPONSE = {
  result: {
    text: 'James Berkins. Welcome to',
    word_count: 4,
    words: [
      { word: 'James', start: 0, end: 0.42 },
      { word: 'Berkins.', start: 0.42, end: 1.06 },
      { word: 'Welcome', start: 1.06, end: 1.26 },
      { word: 'to', start: 1.26, end: 1.4 }
    ],
    vtt: 'WEBVTT\n\n --> 01.500\nJames Berkins. Welcome to the\n\n01.500 --> 03.020\nshow. Thanks for having me.'
  },
  success: true,
  errors: [],
  messages: []
}

const TURBO_RESPONSE = {
  result: {
    transcription_info: { language: 'en', language_probability: 1, duration: 59.5853125, duration_after_vad: 59.5853125 },
    text: 'james perkins welcome me on i',
    word_count: 6,
    segments: [
      {
        start: 0,
        end: 4.68,
        text: ' james perkins welcome',
        word_count: 3,
        temperature: 0,
        avg_logprob: -0.0626358669737111,
        compression_ratio: 1.8404669260700388,
        no_speech_prob: 0,
        words: [
          { word: ' james', start: 0, end: 0.42 },
          { word: ' perkins', start: 0.42, end: 0.82 },
          { word: ' welcome', start: 0.82, end: 1.26 }
        ]
      },
      {
        start: 4.68,
        end: 9.28,
        text: ' me on i',
        word_count: 3,
        words: [
          { word: ' me', start: 4.68, end: 4.88 },
          { word: ' on', start: 4.88, end: 5.1 },
          { word: ' i', start: 5.1, end: 5.38 }
        ]
      }
    ],
    vtt: 'WEBVTT\n\n00:00.000 --> 00:00.420\n james\n\n00:00.420 --> 00:00.820\n perkins',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_tokens_details: { cached_tokens: 0 }, neurons: 46.307954759035376 }
  },
  success: true,
  errors: [],
  messages: []
}

// Captured live on 2026-10-13 from @cf/openai/whisper-tiny-en on the 1-audio clip and trimmed: segments carry null
// words and decoding fields, the timed words sit at the top level and start with an empty word, and usage reports
// the Neurons billed.
const TINY_EN_RESPONSE = {
  result: {
    text: ' James Perkins into the show.',
    word_count: 5,
    segments: [
      { start: 0, end: 5.12, text: ' James Perkins into the show.', temperature: null, avg_logprob: null, compression_ratio: null, no_speech_prob: null, words: null, word_count: null }
    ],
    words: [
      { word: '', start: 0, end: 0 },
      { word: 'James', start: 0.05446808510638298, end: 0.32680851063829786 },
      { word: 'Perkins', start: 0.3812765957446808, end: 0.7625531914893617 }
    ],
    vtt: 'WEBVTT\n\n00:00.000 --> 00:05.120\nJames Perkins into the show.',
    usage: { neurons: 0.5996916233441656 }
  },
  success: true,
  errors: [],
  messages: []
}

const writeAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const dir = await tempDirs.make()
  const audioPath = join(dir, 'synthetic.mp3')
  await Bun.write(audioPath, AUDIO_BYTES)
  return { audioPath, outputDir: dir }
}

describe('Cloudflare Workers AI Whisper STT contracts', () => {
  test('the selector exposes exactly the three documented Whisper models', () => {
    expect([...SUPPORTED_CLOUDFLARE_STT_MODELS]).toEqual([TURBO, WHISPER, TINY_EN])
    for (const model of SUPPORTED_CLOUDFLARE_STT_MODELS) expect(validateCloudflareSttModel(model)).toBe(model)
    // Short names, another provider's spelling, and Cloudflare's non-Whisper speech models are rejected.
    for (const rejected of ['whisper', 'openai/whisper-large-v3-turbo', '@cf/openai/whisper-large-v3', '@cf/deepgram/nova-3']) {
      expect(() => validateCloudflareSttModel(rejected)).toThrow('Invalid model')
    }
  })

  test('registry rates match the 2026-10-13 published prices and the measured beta rate', () => {
    const models = requireDefined(getModelRegistry().stt['cloudflare']?.models, 'Cloudflare STT models')
    expect(Object.keys(models)).toEqual([TURBO, WHISPER, TINY_EN])
    // $0.000513 and $0.000453 per audio minute.
    expect(computeSttCost('cloudflare', TURBO, 60)).toBeCloseTo(0.0513, 6)
    expect(computeSttCost('cloudflare', WHISPER, 60)).toBeCloseTo(0.0453, 6)
    for (const model of SUPPORTED_CLOUDFLARE_STT_MODELS) expect(models[model]?.pricingCheckedAt).toBe('2026-10-13')
    // The beta model has no published price; its rate comes from the usage.neurons a live response reported
    // (0.5997 Neurons for 59.585 s at $0.011 per 1,000 Neurons).
    expect(models[TINY_EN]?.pricingNotes).toContain('publishes no unit price')
    expect(computeSttCost('cloudflare', TINY_EN, 3600)).toBeCloseTo(0.0399, 6)
    expect(0.5997 / 59.585 * 3600 * 0.011 / 1000 * 100).toBeCloseTo(0.0399, 3)
    expect(resolveCheapestModelForFlag('cloudflare-stt')).toBe(TINY_EN)
  })

  test('capabilities report word timing without diarization', () => {
    for (const model of SUPPORTED_CLOUDFLARE_STT_MODELS) {
      expect(getSttEngineCapabilities('cloudflare', model)).toMatchObject({
        diarizationByDefault: false,
        diarizationKind: 'unavailable',
        supportsDiarizationToggle: false,
        supportsSpeakerCountHint: false,
        nativeWordTiming: 'available'
      })
    }
  })

  test('the provider selector routes media inputs to cloudflare targets', () => {
    const opts = buildOptsFromFlags({ 'cloudflare-stt': [TURBO, TINY_EN] })
    expect(opts.cloudflareSttModels).toEqual([TURBO, TINY_EN])
    expect(collectSttTargets(opts).map(target => `${target.service}:${target.model}`)).toEqual([`cloudflare:${TURBO}`, `cloudflare:${TINY_EN}`])
    expect(collectSttTargets(opts).every(target => target.local === false && target.diarizationOptions === undefined)).toBe(true)
  })

  test('the run URL keeps the model id literal and encodes only the account id', () => {
    expect(buildCloudflareRunUrl('https://api.cloudflare.com/client/v4/', 'acct/1', WHISPER))
      .toBe('https://api.cloudflare.com/client/v4/accounts/acct%2F1/ai/run/@cf/openai/whisper')
  })

  // Cloudflare's AI Gateway REST API documents the existing model-in-path endpoint plus
  // cf-aig-gateway-id for prepaid Workers AI. The gateway must separately use Unified billing.
  // https://developers.cloudflare.com/ai-gateway/usage/rest-api/ (retrieved 2026-10-15).
  test('all three models dispatch through an explicit gateway and reset to direct billing without changing audio encoding', async () => {
    for (const model of [TURBO, WHISPER, TINY_EN]) {
      const { audioPath, outputDir } = await writeAudioFixture()
      const calls = installMockFetch(() => jsonResponse(WHISPER_RESPONSE))
      for (const gateway of [undefined, '  prepaid-gateway  ', 'another-gateway', '', undefined]) {
        if (gateway === undefined) delete process.env['CLOUDFLARE_AI_GATEWAY_ID']
        else process.env['CLOUDFLARE_AI_GATEWAY_ID'] = gateway
        const { result } = await runCloudflareStt(audioPath, outputDir, { model, segmentOffsetMinutes: 0, audioDurationSeconds: 2 })
        const sent = calls.at(-1)!
        expect(sent.url).toBe(`https://api.cloudflare.com/client/v4/accounts/synthetic-account/ai/run/${model}`)
        expect(sent.headers.get('authorization')).toBe('Bearer synthetic-token')
        expect(sent.headers.get('cf-aig-gateway-id')).toBe(gateway?.trim() || null)
        expect(sent.headers.get('content-type')).toBe(model === TURBO ? 'application/json' : 'application/octet-stream')
        expect(result.text).toBe('James Berkins. Welcome to')
      }
      expect(calls).toHaveLength(5)
    }
  })

  test('invalid gateway IDs are rejected before credentials or provider dispatch', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    delete process.env['CLOUDFLARE_API_TOKEN']
    const calls = installMockFetch(() => { throw Error('Provider must not be called') })
    for (const gateway of ['a'.repeat(65), 'allowed\r\nx-extra: injected', 'invalid\0gateway']) {
      process.env['CLOUDFLARE_AI_GATEWAY_ID'] = gateway
      await expect(runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 0 })).rejects.toThrow('CLOUDFLARE_AI_GATEWAY_ID must be a gateway ID')
    }
    expect(calls).toHaveLength(0)
  })

  test('whisper and whisper-tiny-en send the audio bytes as the request body', async () => {
    for (const model of [WHISPER, TINY_EN]) {
      const { audioPath, outputDir } = await writeAudioFixture()
      let sentBytes: number[] = []
      const calls = installMockFetch(async (_call, _input, init) => {
        sentBytes = [...new Uint8Array(await new Response(init?.body).arrayBuffer())]
        return jsonResponse(WHISPER_RESPONSE)
      })
      const { result, metadata } = await runCloudflareStt(audioPath, outputDir, { model, segmentOffsetMinutes: 0, audioDurationSeconds: 2 })

      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe(`https://api.cloudflare.com/client/v4/accounts/synthetic-account/ai/run/${model}`)
      expect(calls[0]?.method).toBe('POST')
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer synthetic-token')
      expect(calls[0]?.headers.get('content-type')).toBe('application/octet-stream')
      expect(sentBytes).toEqual([...AUDIO_BYTES])

      expect(metadata).toMatchObject({ transcriptionService: 'cloudflare', transcriptionModel: model })
      expect(result.text).toBe('James Berkins. Welcome to')
      // This response has no segments and a malformed VTT, so segments are built from the timed words.
      expect(result.segments).toEqual([{ start: '00:00:00.000', end: '00:00:01.400', text: 'James Berkins. Welcome to' }])
      expect(result.evidence?.words?.map(word => word.text)).toEqual(['James', 'Berkins.', 'Welcome', 'to'])
    }
  })

  test('whisper-tiny-en keeps native segments and takes timing from top-level words when segment words are null', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse(TINY_EN_RESPONSE))
    const { result } = await runCloudflareStt(audioPath, outputDir, { model: TINY_EN, segmentOffsetMinutes: 0, audioDurationSeconds: 60 })

    expect(result.text).toBe('James Perkins into the show.')
    expect(result.segments).toEqual([{ start: '00:00:00.000', end: '00:00:05.120', text: 'James Perkins into the show.' }])
    // The empty first word is dropped.
    expect(result.evidence?.words?.map(word => word.text)).toEqual(['James', 'Perkins'])
  })

  test('whisper-large-v3-turbo sends base64 audio in a JSON body and keeps native segments', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse(TURBO_RESPONSE))
    const { result, metadata } = await runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 0, audioDurationSeconds: 60 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`https://api.cloudflare.com/client/v4/accounts/synthetic-account/ai/run/${TURBO}`)
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    // Only the required field is sent; task, language, and decoding thresholds stay at provider defaults.
    expect(calls[0]?.bodyJson).toEqual({ audio: Buffer.from(AUDIO_BYTES).toString('base64') })

    expect(metadata).toMatchObject({ transcriptionService: 'cloudflare', transcriptionModel: TURBO })
    expect(result.text).toBe('james perkins welcome me on i')
    // Native segments win over word grouping, and the leading spaces Cloudflare puts on segments and words are trimmed.
    expect(result.segments).toEqual([
      { start: '00:00:00.000', end: '00:00:04.680', text: 'james perkins welcome' },
      { start: '00:00:04.680', end: '00:00:09.280', text: 'me on i' }
    ])
    expect(result.evidence?.words?.map(word => word.text)).toEqual(['james', 'perkins', 'welcome', 'me', 'on', 'i'])
    expect(result.evidence?.words?.every(word => word.timingSource === 'native')).toBe(true)
  })

  test('the request builder picks the body encoding per model', async () => {
    const { audioPath } = await writeAudioFixture()
    expect((await buildCloudflareWhisperRequest(audioPath, TURBO)).contentType).toBe('application/json')
    expect((await buildCloudflareWhisperRequest(audioPath, WHISPER)).contentType).toBe('application/octet-stream')
    expect((await buildCloudflareWhisperRequest(audioPath, TINY_EN)).contentType).toBe('application/octet-stream')
  })

  test('the segment offset moves segments and word evidence', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse(TURBO_RESPONSE))
    const { result } = await runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 1, segmentNumber: 2, totalSegments: 2 })
    expect(result.segments[0]?.start).toBe('00:01:00.000')
    expect(result.segments[1]?.end).toBe('00:01:09.280')
    expect(result.evidence?.words?.[0]?.startSeconds).toBe(60)
  })

  test('a text-only result falls back to well-formed VTT cues, then to one whole-request segment', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse({ result: { text: 'Only text.', vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nOnly text.' }, success: true }))
    const withVtt = await runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 })
    expect(withVtt.result.segments).toEqual([{ start: '00:00:00.000', end: '00:00:01.000', text: 'Only text.' }])

    installMockFetch(() => jsonResponse({ result: { text: 'Only text.', vtt: WHISPER_RESPONSE.result.vtt.replace(/\n\n01\.500[\s\S]*$/, '') }, success: true }))
    const textOnly = await runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 })
    expect(textOnly.result.segments).toHaveLength(1)
    expect(textOnly.result.segments[0]?.text).toBe('Only text.')
    expect(textOnly.result.evidence?.words?.length ?? 0).toBe(0)
  })

  test('an oversized request reports the Cloudflare error code and is classified for an adaptive split', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse({ success: false, errors: [{ code: 3006, message: 'Request is too large' }], result: null }, { status: 413 }))
    const failure = await runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }).catch((error: unknown) => error)

    expect(calls).toHaveLength(1)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('Cloudflare transcription failed (413): 3006: Request is too large')
    expect(classifySttSplitLimitError({ service: 'cloudflare', model: WHISPER }, failure)).toEqual({ reason: 'attachment_cap' })
  })

  // Raw envelope captured live on 2026-10-13 from a timed-out @cf/openai/whisper segment request.
  const TIMEOUT_RESPONSE = { errors: [{ message: 'AiError: AiError: Request timeout (e270681e-eb57-4442-930f-ae9a09b67c15)', code: 3046 }], success: false, result: {}, messages: [] }

  test('a Workers AI request timeout is sent again and the retry is counted', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    let call = 0
    const calls = installMockFetch(() => {
      call += 1
      return call === 1 ? jsonResponse(TIMEOUT_RESPONSE, { status: 408 }) : jsonResponse(WHISPER_RESPONSE)
    })
    const { result, metadata } = await runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 })

    expect(calls).toHaveLength(2)
    expect(result.text).toBe('James Berkins. Welcome to')
    expect(metadata.timings).toMatchObject({ requestCount: 2, retryCount: 1 })
  })

  test('repeated request timeouts fail after three attempts', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse(TIMEOUT_RESPONSE, { status: 408 }))
    await expect(runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('Cloudflare transcription failed (408): 3046: AiError: AiError: Request timeout')
    expect(calls).toHaveLength(3)
  })

  test('a 408 without the Workers AI timeout code is not retried', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse({ success: false, errors: [{ code: 3008, message: 'Request was aborted' }], result: null }, { status: 408 }))
    await expect(runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('Cloudflare transcription failed (408): 3008: Request was aborted')
    expect(calls).toHaveLength(1)
  })

  test('a rejected model surfaces the provider error without a transcript', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse({ success: false, errors: [{ code: 5007, message: 'No such model @cf/openai/whisper or task' }], result: null }, { status: 400 }))
    await expect(runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('Cloudflare transcription failed (400): 5007: No such model @cf/openai/whisper or task')
    expect(calls).toHaveLength(1)
  })

  test('a 200 envelope without a result is an error, not an empty transcript', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse({ success: false, errors: [{ code: 3003, message: 'Request is missing headers or body' }], result: null }))
    await expect(runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('Cloudflare transcription failed: 3003: Request is missing headers or body')
  })

  const invalidSuccessResponses = [
    { name: 'missing result', response: { success: true } },
    { name: 'null result', response: { success: true, result: null } },
    { name: 'non-object result', response: { success: true, result: 'transcript' } },
    { name: 'missing text', response: { success: true, result: {} } },
    { name: 'null text', response: { success: true, result: { text: null } } },
    { name: 'non-string text', response: { success: true, result: { text: 42 } } },
    { name: 'malformed word timing', response: { success: true, result: { text: 'Hello.', words: [{ word: 'Hello.', start: '0', end: 1 }] } } }
  ]

  for (const { name, response } of invalidSuccessResponses) {
    test(`HTTP 200 with ${name} fails response validation without writing a transcript artifact`, async () => {
      const { audioPath, outputDir } = await writeAudioFixture()
      const calls = installMockFetch(() => jsonResponse(response))

      await expect(runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 0 }))
        .rejects.toThrow('Invalid data structure for Cloudflare Workers AI STT response')

      expect(calls).toHaveLength(1)
      expect(await Bun.file(join(outputDir, 'transcription.txt')).exists()).toBe(false)
    })
  }

  test('a 200 failure envelope with an empty result preserves the Cloudflare error and writes no transcript artifact', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse({ success: false, errors: [{ code: 3003, message: 'Request is missing headers or body' }], result: {} }))

    await expect(runCloudflareStt(audioPath, outputDir, { model: TURBO, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('Cloudflare transcription failed: 3003: Request is missing headers or body')

    expect(await Bun.file(join(outputDir, 'transcription.txt')).exists()).toBe(false)
  })

  test('an explicitly empty text result remains valid for silent audio on every model', async () => {
    for (const model of SUPPORTED_CLOUDFLARE_STT_MODELS) {
      const { audioPath, outputDir } = await writeAudioFixture()
      const calls = installMockFetch(() => jsonResponse({ success: true, result: { text: '', words: [], segments: [] } }))
      const { result, metadata } = await runCloudflareStt(audioPath, outputDir, { model, segmentOffsetMinutes: 0 })

      expect(calls).toHaveLength(1)
      expect(result.text).toBe('')
      expect(metadata.tokenCount).toBe(0)
      expect(await Bun.file(join(outputDir, 'transcription.txt')).text()).toBe('[00:00:00.000] ')
    }
  })

  test('both credentials are required before any request is sent', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse(WHISPER_RESPONSE))

    delete process.env['CLOUDFLARE_ACCOUNT_ID']
    await expect(runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('CLOUDFLARE_ACCOUNT_ID environment variable is required')

    process.env['CLOUDFLARE_ACCOUNT_ID'] = 'synthetic-account'
    delete process.env['CLOUDFLARE_API_TOKEN']
    await expect(runCloudflareStt(audioPath, outputDir, { model: WHISPER, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('CLOUDFLARE_API_TOKEN environment variable is required')

    expect(calls).toHaveLength(0)
  })
})
