import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { applyTtsPronunciationLexicon, loadTtsPronunciationLexicon, parseTtsPronunciationLexicon } from '~/cli/commands/audio/tts/tts-utils/tts-pronunciation-lexicon'
import { inspectTtsText } from '~/cli/commands/audio/tts/tts-targets/tts-text-preflight'
import { prepareTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import type { MockFetchCall, TtsOptions, TtsProvider } from '~/types'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'],
  tempPrefix: 'autoshow-tts-text-controls-'
})

const PROVIDER_FLAGS: Record<'openai' | 'elevenlabs', Record<string, string>> = {
  openai: { 'openai-tts': 'gpt-4o-mini-tts-2025-12-15' },
  elevenlabs: { 'elevenlabs-tts': 'eleven_v3' },
}

const optionsFor = (provider: keyof typeof PROVIDER_FLAGS, flags: Record<string, unknown> = {}, extra: Partial<TtsOptions> = {}): TtsOptions => ({
  ...buildOptsFromFlags({ ...PROVIDER_FLAGS[provider], ...flags }),
  ...resolveTtsDeliveryOptions({}),
  ...extra,
})

const targetFor = (options: TtsOptions, provider: TtsProvider) =>
  requireDefined(collectTtsTargets(options).find((candidate) => candidate.service === provider), `${provider} TTS target`)

const installProviderAudio = () => installMockFetch(() => new Response(
  createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.5, frequencyHz: 440, amplitude: 0.4 }),
  { status: 200, headers: { 'content-type': 'audio/wav' } }
))

const setKeys = (): void => {
  process.env['OPENAI_API_KEY'] = 'openai-test-key'
  process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-test-key'
}

const spokenText = (call: MockFetchCall): string => {
  const body = call.bodyJson ?? {}
  const utterances = body['utterances'] as Array<{ text?: string }> | undefined
  return String(body['input'] ?? body['text'] ?? utterances?.[0]?.text ?? '')
}

const LEXICON = parseTtsPronunciationLexicon(JSON.stringify([
  { match: 'Claughton', alias: 'Cloffton' },
  { match: 'UN', alias: 'United Nations' },
  { match: 'dr.', alias: 'Doctor', caseSensitive: false, wordBoundary: false },
]), 'lexicon.json')

describe('TTS pronunciation lexicon', () => {
  test('rules apply in one pass with word boundaries, case rules, and no rescanning of aliases', () => {
    const result = applyTtsPronunciationLexicon('Dr. Claughton told the UN that UNESCO and Claughtons differ.', LEXICON)
    expect(result.text).toBe('Doctor Cloffton told the United Nations that UNESCO and Claughtons differ.')
    expect(result.replacements).toBe(3)
    expect(applyTtsPronunciationLexicon('unchanged', undefined)).toEqual({ text: 'unchanged', replacements: 0 })
  })

  test('the earliest rule wins when two rules match at the same position', () => {
    const lexicon = parseTtsPronunciationLexicon(JSON.stringify([{ match: 'New York', alias: 'Noo York' }, { match: 'New', alias: 'Nyoo' }]), 'l.json')
    expect(applyTtsPronunciationLexicon('New York is New.', lexicon).text).toBe('Noo York is Nyoo.')
  })

  test('the lexicon hash changes with its rules and is stable for equal rules', () => {
    const same = parseTtsPronunciationLexicon(JSON.stringify([{ match: 'Claughton', alias: 'Cloffton' }, { match: 'UN', alias: 'United Nations' }, { match: 'dr.', alias: 'Doctor', caseSensitive: false, wordBoundary: false }]), 'other.json')
    expect(same.lexiconSha256).toBe(LEXICON.lexiconSha256)
    expect(parseTtsPronunciationLexicon('[{"match":"UN","alias":"U N"}]', 'x.json').lexiconSha256).not.toBe(LEXICON.lexiconSha256)
  })

  test('malformed lexicon files are rejected with the offending rule named', async () => {
    expect(() => parseTtsPronunciationLexicon('{', 'bad.json')).toThrow('is not valid JSON')
    expect(() => parseTtsPronunciationLexicon('[]', 'bad.json')).toThrow('non-empty JSON array')
    expect(() => parseTtsPronunciationLexicon('[{"match":"a"}]', 'bad.json')).toThrow('rule 1 requires a non-empty "alias"')
    expect(() => parseTtsPronunciationLexicon('[{"match":"a","alias":"b","phoneme":"x"}]', 'bad.json')).toThrow('unsupported key "phoneme"')
    expect(() => parseTtsPronunciationLexicon('[{"match":"a","alias":"b"},{"match":"a","alias":"c"}]', 'bad.json')).toThrow('more than once')
    await expect(loadTtsPronunciationLexicon('/nonexistent/lexicon.json')).rejects.toThrow('was not found')
  })

  for (const provider of ['openai', 'elevenlabs'] as const) {
    test(`transport: ${provider} receives lexicon-substituted text and billing counts the substituted characters`, async () => {
      setKeys()
      const calls = installProviderAudio()
      const dir = await tempDirs.make()
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, 'Claughton addressed the UN.')
      const options = optionsFor(provider, {}, { ttsPronunciationLexicon: LEXICON })
      const prepared = await prepareTtsInput(inputPath, options, new Date(0).toISOString())
      expect(prepared.text).toBe('Cloffton addressed the United Nations.')
      expect(prepared.pronunciationReplacements).toBe(2)
      expect(prepared.ttsCharacterCount).toBe(prepared.text.length)
      await mkdir(join(dir, 'run'))
      await runTtsForTargets(prepared.text, join(dir, 'run'), options, [targetFor(options, provider)], { sourceIdentity: prepared.sourceIdentity, dialoguePlan: prepared.dialoguePlan })
      expect(calls.map(spokenText)).toEqual(['Cloffton addressed the United Nations.'])
    }, 30_000)
  }
})

describe('TTS text preflight', () => {
  test('speech markup is an error only where the provider documents it as unsupported', () => {
    const findings = inspectTtsText('Wait. <break time="1.5s" /> Go.', [{ service: 'elevenlabs', model: 'eleven_v3' }, { service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }])
    expect(findings.map((finding) => [finding.target, finding.kind, finding.severity])).toEqual([
      ['elevenlabs/eleven_v3', 'speech-markup', 'error'],
      ['openai/gpt-4o-mini-tts-2025-12-15', 'speech-markup', 'warning'],
    ])
  })

  test('short delivery tags pass and long bracketed prose is flagged for every provider', () => {
    expect(inspectTtsText('[whispers] Quiet now. [long pause] Done.', [{ service: 'elevenlabs', model: 'eleven_v3' }])).toEqual([])
    const findings = inspectTtsText('[as if sharing a private secret with a close friend] Hello.', [{ service: 'elevenlabs', model: 'eleven_v3' }, { service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }])
    expect(findings.map((finding) => [finding.target, finding.kind, finding.severity])).toEqual([
      ['elevenlabs/eleven_v3', 'long-inline-tag', 'warning'],
      ['openai/gpt-4o-mini-tts-2025-12-15', 'long-inline-tag', 'warning'],
    ])
  })

  test('angle brackets that are not speech markup are left alone', () => {
    expect(inspectTtsText('If a < b and b > c, then <strong> is HTML, not SSML.', [{ service: 'elevenlabs', model: 'eleven_v3' }])).toEqual([])
  })

  test('transport: eleven_v3 rejects SSML before any provider request, and the switch restores dispatch', async () => {
    setKeys()
    const calls = installProviderAudio()
    const text = 'Hold on. <break time="1.5s" /> Alright.'
    const options = optionsFor('elevenlabs')
    await expect(runTtsForTargets(text, await tempDirs.make(), options, [targetFor(options, 'elevenlabs')])).rejects.toThrow('does not support SSML-style speech markup')
    expect(calls).toHaveLength(0)

    const disabled = optionsFor('elevenlabs', {}, { ttsTextPreflight: false })
    await runTtsForTargets(text, await tempDirs.make(), disabled, [targetFor(disabled, 'elevenlabs')])
    expect(calls.map(spokenText)).toEqual([text])
  }, 30_000)

  test('transport: a provider with unverified markup support still dispatches the text verbatim', async () => {
    setKeys()
    const calls = installProviderAudio()
    const text = 'Hold on. <break time="1.5s" /> Alright.'
    const options = optionsFor('openai')
    await runTtsForTargets(text, await tempDirs.make(), options, [targetFor(options, 'openai')])
    expect(calls.map(spokenText)).toEqual([text])
  }, 30_000)
})

describe('TTS response format control', () => {
  test('transport: ElevenLabs default output format is unchanged and an override reaches the query string', async () => {
    setKeys()
    const calls = installProviderAudio()
    const defaults = optionsFor('elevenlabs')
    await runTtsForTargets('Default format.', await tempDirs.make(), defaults, [targetFor(defaults, 'elevenlabs')])
    expect(new URL(requireDefined(calls[0], 'default request').url).searchParams.get('output_format')).toBe('mp3_44100_128')
    expect(requireDefined(calls[0], 'default request').bodyJson).toEqual({ text: 'Default format.', model_id: 'eleven_v3' })

    const lossless = optionsFor('elevenlabs', { 'tts-response-format': 'wav_44100' })
    await runTtsForTargets('Lossless format.', await tempDirs.make(), lossless, [targetFor(lossless, 'elevenlabs')])
    expect(new URL(requireDefined(calls[1], 'override request').url).searchParams.get('output_format')).toBe('wav_44100')
    expect(requireDefined(calls[1], 'override request').headers.get('accept')).toBe('audio/wav')
  }, 30_000)

  test('unsupported response formats and providers are rejected during option resolution', () => {
    setKeys()
    expect(() => buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-response-format': 'pcm_8000' })).toThrow('tts-response-format')
    expect(() => buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15', 'tts-response-format': 'wav' })).toThrow('tts-response-format')
  })
})

describe('TTS text preflight provider support', () => {
  test('providers documented to accept timed SSML breaks produce no markup finding', () => {
    const text = 'Wait. <break time="1s" /> Go.'
    for (const target of [{ service: 'inworld', model: 'realtime-tts-2' }] as const) {
      expect(inspectTtsText(text, [target])).toEqual([])
    }
  })
})
