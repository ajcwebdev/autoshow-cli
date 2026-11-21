import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { dispatchStt } from '~/cli/commands/stt/run-stt/dispatch'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { buildSplitSegmentFingerprint } from '~/cli/commands/stt/run-stt/split-execution'
import { parseStoredRequestedTargets, readExistingSttRun, toRequestedProvider } from '~/cli/commands/stt/stt-batch/stt-run-state'
import { buildAssemblyAiTranscriptRequest } from '~/cli/commands/stt/diarization/assemblyai/run-assemblyai-stt'
import { buildSttEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/stt-estimates'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { transcriptionFlags } from '~/cli/flags/shared-flags'
import type { SttTarget } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

// Independently documented request contracts:
// - AssemblyAI: AssemblyAI-STT-3.7 accepts `disfluencies` (true keeps fillers, repetitions and false starts) and
//   `format_text` (true formats numbers/punctuation/casing); disfluencies is not documented for Universal-3.5 Pro.
//   https://www.assemblyai.com/docs/pre-recorded-audio/assemblyai-stt-3-7-migration-guide.md
// - xAI Grok: POST https://api.x.ai/v1/stt multipart with `format` (number/currency formatting) and `filler_words`.
//   https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
// Mocks prove only that accepted controls reach the transport request; they prove neither spoken/text correctness
// nor perceptual quality of the provider transcript.
const ASSEMBLY_37 = 'assemblyai-stt-3-7'
const ASSEMBLY_35 = 'universal-3-5-pro'
const GROK = 'grok-voice-transcribe-2.0'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ASSEMBLYAI_API_KEY', 'XAI_API_KEY'],
  tempPrefix: 'autoshow-stt-style-controls-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    process.env['ASSEMBLYAI_API_KEY'] = 'fixture'
    process.env['XAI_API_KEY'] = 'fixture'
    installMockFetch(() => { throw new Error('Unexpected unmocked provider request') })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const targetsFor = (flags: Record<string, unknown>): SttTarget[] => collectSttTargets(buildOptsFromFlags(flags))

const writeAudio = async (): Promise<{ audio: string, dir: string }> => {
  const dir = await tempDirs.make()
  const audio = join(dir, 'fixture.wav')
  await Bun.write(audio, 'fixture')
  return { audio, dir }
}

const assemblyRequestThroughDispatch = async (flags: Record<string, unknown>): Promise<unknown> => {
  const [target] = targetsFor(flags)
  const { audio, dir } = await writeAudio()
  const word = { text: 'Hello.', start: 0, end: 500, confidence: .9, speaker: 'A' }
  const calls = installMockFetch(call => {
    const path = new URL(call.url).pathname
    if (path === '/v2/upload') return jsonResponse({ upload_url: 'https://fixture.invalid/audio' })
    if (path === '/v2/transcript' && call.method === 'POST') return jsonResponse({ id: 'job' })
    if (path === '/v2/transcript/job') return jsonResponse({ id: 'job', status: 'completed', text: 'Hello.', words: [word], utterances: [{ ...word, words: [word] }] })
    throw new Error(`Unexpected AssemblyAI request: ${call.method} ${call.url}`)
  })
  await dispatchStt(target!, audio, dir, 0, {})
  return calls.find(call => new URL(call.url).pathname === '/v2/transcript')?.bodyJson
}

const grokFormThroughDispatch = async (flags: Record<string, unknown>): Promise<Array<string | null>> => {
  const [target] = targetsFor(flags)
  const { audio, dir } = await writeAudio()
  const calls = installMockFetch(() => jsonResponse({ text: 'Hello.', language: 'en', duration: 1, words: [{ text: 'Hello.', start: 0, end: 0.5, speaker: 0 }] }))
  await dispatchStt(target!, audio, dir, 0, {})
  expect(calls).toHaveLength(1)
  const keys = [...calls[0]!.form!.keys()]
  expect(keys[0]).toBe('model')
  expect(keys.at(-1)).toBe('file')
  return [calls[0]!.form!.get('format') as string | null, calls[0]!.form!.get('filler_words') as string | null]
}

describe('provider-general STT filler-word and number-format controls', () => {
  test('transport: AssemblyAI-STT-3.7 default request is unchanged and both controls override it through dispatch', async () => {
    const base = { audio_url: 'https://fixture.invalid/audio', speech_models: [ASSEMBLY_37], speaker_labels: true }
    expect(await assemblyRequestThroughDispatch({ 'assemblyai-stt': ASSEMBLY_37 }))
      .toEqual({ ...base, disfluencies: false, format_text: true })
    expect(await assemblyRequestThroughDispatch({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true' }))
      .toEqual({ ...base, disfluencies: true, format_text: true })
    expect(await assemblyRequestThroughDispatch({ 'assemblyai-stt': ASSEMBLY_37, 'stt-number-format': 'spoken' }))
      .toEqual({ ...base, disfluencies: false, format_text: false })
    expect(await assemblyRequestThroughDispatch({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': ['assemblyai=false'], 'stt-number-format': ['assemblyai=written'] }))
      .toEqual({ ...base, disfluencies: false, format_text: true })
  })

  test('transport: Universal-3.5 Pro request stays byte-identical without the controls', () => {
    expect(JSON.stringify(buildAssemblyAiTranscriptRequest('u', ASSEMBLY_35))).toBe(JSON.stringify({ audio_url: 'u', speech_models: [ASSEMBLY_35], speaker_labels: true }))
    expect(() => buildAssemblyAiTranscriptRequest('u', ASSEMBLY_35, undefined, true, { fillerWords: true })).toThrow(/does not apply to assemblyai\/universal-3-5-pro/)
  })

  test('transport: Grok default, verbatim shorthand, explicit override and consistent combinations reach the multipart request', async () => {
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK })).toEqual(['true', null])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-verbatim': 'true' })).toEqual(['false', 'true'])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-filler-words': 'true' })).toEqual(['true', 'true'])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-filler-words': 'false' })).toEqual(['true', 'false'])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-number-format': 'spoken' })).toEqual(['false', null])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-verbatim': 'true', 'stt-filler-words': 'true', 'stt-number-format': 'spoken' })).toEqual(['false', 'true'])
    expect(await grokFormThroughDispatch({ 'grok-stt': GROK, 'stt-verbatim': 'false', 'stt-filler-words': 'false', 'stt-number-format': 'written' })).toEqual(['true', 'false'])
  })

  test('rejection before dispatch: unsupported model, unsupported provider, invalid values and contradictory verbatim', async () => {
    const calls = installMockFetch(() => { throw new Error('Provider must not be called') })
    for (const [flags, message] of [
      [{ 'assemblyai-stt': ASSEMBLY_35, 'stt-filler-words': 'true' }, '--stt-filler-words does not apply to assemblyai/universal-3-5-pro; supported models: assemblyai-stt-3-7.'],
      [{ 'assemblyai-stt': ASSEMBLY_35, 'stt-number-format': 'spoken' }, '--stt-number-format does not apply to assemblyai/universal-3-5-pro; supported models: assemblyai-stt-3-7.'],
      [{ 'deepgram-stt': 'nova-3', 'stt-filler-words': 'true' }, '--stt-filler-words does not apply to deepgram STT.'],
      [{ 'gladia-stt': true, 'stt-number-format': 'spoken' }, '--stt-number-format does not apply to gladia STT.'],
      [{ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'maybe' }, '--stt-filler-words for assemblyai: expected true or false.'],
      [{ 'assemblyai-stt': ASSEMBLY_37, 'stt-number-format': 'digits' }, '--stt-number-format for assemblyai: allowed values are written, spoken.'],
      [{ 'grok-stt': GROK, 'stt-verbatim': 'true', 'stt-filler-words': 'false' }, '--stt-verbatim for grok keeps filler words and spoken numbers; it cannot be combined with --stt-filler-words false.'],
      [{ 'grok-stt': GROK, 'stt-verbatim': 'true', 'stt-number-format': 'written' }, '--stt-verbatim for grok keeps filler words and spoken numbers; it cannot be combined with --stt-number-format written.'],
      [{ 'assemblyai-stt': ASSEMBLY_37, 'stt-verbatim': 'true' }, '--stt-verbatim does not apply to assemblyai STT.']
    ] as const) {
      expect(() => targetsFor(flags)).toThrow(message)
    }
    // Pricing builds targets first, so the model gate also precedes duration probing and credential lookup.
    delete process.env['ASSEMBLYAI_API_KEY']
    await expect(buildSttEstimates('missing-input.mp3', buildOptsFromFlags({ 'assemblyai-stt': ASSEMBLY_35, 'stt-filler-words': 'true' }) as never))
      .rejects.toThrow('does not apply to assemblyai/universal-3-5-pro')
    expect(calls).toHaveLength(0)
  })

  test('multiple providers take provider=value and keep values per provider', () => {
    const targets = targetsFor({ 'assemblyai-stt': ASSEMBLY_37, 'grok-stt': GROK, 'stt-filler-words': ['assemblyai=true', 'grok=false'], 'stt-number-format': ['grok=spoken'] })
    expect(Object.fromEntries(targets.map(target => [target.service, [target.sttFillerWords, target.sttNumberFormat]]))).toEqual({
      grok: [false, 'spoken'],
      assemblyai: [true, undefined]
    })
    expect(() => targetsFor({ 'assemblyai-stt': ASSEMBLY_37, 'grok-stt': GROK, 'stt-filler-words': 'true' })).toThrow('--stt-filler-words requires provider=value when multiple STT providers are selected.')
  })

  test('help lists the flags with accepted values and supported providers/models', () => {
    expect(transcriptionFlags['stt-filler-words'].description).toContain('grok/assemblyai (assemblyai-stt-3-7) only')
    expect(transcriptionFlags['stt-filler-words'].description).toContain('Accepted values: true|false.')
    expect(transcriptionFlags['stt-number-format'].description).toContain('grok/assemblyai (assemblyai-stt-3-7) only')
    expect(transcriptionFlags['stt-number-format'].description).toContain('Accepted values: written|spoken.')
    for (const flag of ['stt-filler-words', 'stt-number-format'] as const) {
      expect(transcriptionFlags[flag].description).toContain('A provider=value applies to every selected model of that provider')
    }
    expect(transcriptionFlags['stt-verbatim'].description).toContain('Grok shorthand for --stt-filler-words true plus --stt-number-format spoken; for AssemblyAI use those two flags instead')
    expect(transcriptionFlags['stt-verbatim'].description).toContain(': grok only.')
    expect(transcriptionFlags['stt-language'].description).not.toContain('every selected model')
  })

  test('manifest records, parses and refuses a resume with changed values; split fingerprints change; old manifests load unchanged', async () => {
    const [target] = targetsFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true', 'stt-number-format': 'spoken' })
    expect(target).toMatchObject({ service: 'assemblyai', model: ASSEMBLY_37, sttFillerWords: true, sttNumberFormat: 'spoken' })
    const requested = toRequestedProvider(target!)
    expect(requested.settings?.request).toMatchObject({ model: ASSEMBLY_37, fillerWords: true, numberFormat: 'spoken' })
    expect(parseStoredRequestedTargets({ requestedProviders: [requested] })).toEqual([target!])

    const [plain] = targetsFor({ 'assemblyai-stt': ASSEMBLY_37 })
    expect(toRequestedProvider(plain!).settings?.request).not.toHaveProperty('fillerWords')
    expect(toRequestedProvider(plain!).settings?.request).not.toHaveProperty('numberFormat')
    const oldManifestTarget = { service: 'grok', model: GROK, local: false, grokSttVerbatim: true, diarizationOptions: { enabled: true } }
    expect(parseStoredRequestedTargets({ requestedProviders: [oldManifestTarget] })).toEqual([oldManifestTarget as SttTarget])

    const { audio, dir } = await writeAudio()
    const segment = { path: audio, startSeconds: 0, durationSeconds: 1 }
    expect(await buildSplitSegmentFingerprint(target!, segment)).not.toBe(await buildSplitSegmentFingerprint(plain!, segment))
    expect(await buildSplitSegmentFingerprint({ ...plain! }, segment)).toBe(await buildSplitSegmentFingerprint(plain!, segment))

    await writeSingleManifestFixture(dir, 'extract', {
      step1: { url: 'file:///tmp/audio.mp3' },
      completionStatus: 'incomplete',
      requestedProviders: [requested],
      missingProviders: [requested]
    }, { extractRoute: 'media' })
    await expect(readExistingSttRun(dir, [plain!])).rejects.toThrow(`Cannot resume assemblyai/${ASSEMBLY_37} with changed diarization, response-format, filler-word or number-format settings.`)
    const [changedFormat] = targetsFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true', 'stt-number-format': 'written' })
    await expect(readExistingSttRun(dir, [changedFormat!])).rejects.toThrow('Cannot resume')
    await expect(readExistingSttRun(dir, [target!])).resolves.toBeDefined()

    const oldDir = await tempDirs.make()
    await writeSingleManifestFixture(oldDir, 'extract', {
      step1: { url: 'file:///tmp/audio.mp3' },
      completionStatus: 'incomplete',
      requestedProviders: [oldManifestTarget],
      missingProviders: [oldManifestTarget]
    }, { extractRoute: 'media' })
    const [verbatimTarget] = targetsFor({ 'grok-stt': GROK, 'stt-verbatim': 'true' })
    await expect(readExistingSttRun(oldDir, [verbatimTarget!])).resolves.toBeDefined()
  })
})
