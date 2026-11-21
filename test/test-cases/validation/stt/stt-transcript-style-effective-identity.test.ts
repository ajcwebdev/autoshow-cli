import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildSplitSegmentFingerprint } from '~/cli/commands/stt/run-stt/split-execution'
import { buildSttProviderSettings, readExistingSttRun, toRequestedProvider } from '~/cli/commands/stt/stt-batch/stt-run-state'
import { buildAssemblyAiTranscriptRequest } from '~/cli/commands/stt/diarization/assemblyai/run-assemblyai-stt'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { SttTarget } from '~/types'
import { providerSettingsLabel } from '../../../../.codex/skills/consensus/scripts/stt/transcript_lib'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

// Resume identity follows the effective request, not the flag spelling. Documented request contracts:
// - AssemblyAI-STT-3.7 takes `disfluencies` and `format_text`; the CLI pins disfluencies=false, format_text=true
//   when unset. https://www.assemblyai.com/docs/pre-recorded-audio/assemblyai-stt-3-7-migration-guide.md
// - xAI Grok multipart `format` and `filler_words`; the CLI always sends format (true unless --stt-verbatim) and
//   sends filler_words only when set. https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
// These are local identity contracts: no provider is called, so nothing here proves transcript correctness.
const ASSEMBLY_37 = 'assemblyai-stt-3-7'
const ASSEMBLY_35 = 'universal-3-5-pro'
const GROK = 'grok-voice-transcribe-2.0'

const tempDirs = createTempDirTracker('autoshow-stt-style-identity-')
afterEach(async () => { await tempDirs.cleanup() })
const targetFor = (flags: Record<string, unknown>): SttTarget => collectSttTargets(buildOptsFromFlags(flags))[0]!

const storedRun = async (target: SttTarget | Record<string, unknown>): Promise<string> => {
  const dir = await tempDirs.make()
  const requested = 'settings' in target ? target : toRequestedProvider(target as SttTarget)
  await writeSingleManifestFixture(dir, 'extract', {
    step1: { url: 'file:///tmp/audio.mp3' },
    completionStatus: 'incomplete',
    requestedProviders: [requested],
    missingProviders: [requested]
  }, { extractRoute: 'media' })
  return dir
}

// The split-checkpoint identity as written before --stt-filler-words/--stt-number-format existed.
const legacyFingerprint = async (target: SttTarget, path: string): Promise<string> => {
  const audioSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')
  return new Bun.CryptoHasher('sha256').update(JSON.stringify({
    version: 1, service: target.service, model: target.model, diarizationOptions: target.diarizationOptions ?? null,
    nativeSubtitles: null, nativeResponseFormat: null, grokSttVerbatim: target.grokSttVerbatim ?? null, supadataChunkSize: null,
    startSeconds: 0, durationSeconds: 1, audioSha256
  })).digest('hex')
}

describe('STT transcript-style resume identity uses effective per-model values', () => {
  test('AssemblyAI-STT-3.7: explicit flags equal to the pinned request resume an unset run, and vice versa', async () => {
    const plain = targetFor({ 'assemblyai-stt': ASSEMBLY_37 })
    const sameRequest = [
      targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'false' }),
      targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-number-format': 'written' }),
      targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'false', 'stt-number-format': 'written' })
    ]
    for (const target of sameRequest) {
      expect(JSON.stringify(buildAssemblyAiTranscriptRequest('u', ASSEMBLY_37, undefined, true, { fillerWords: target.sttFillerWords, numberFormat: target.sttNumberFormat })))
        .toBe(JSON.stringify(buildAssemblyAiTranscriptRequest('u', ASSEMBLY_37)))
      await expect(readExistingSttRun(await storedRun(plain), [target])).resolves.toBeDefined()
      await expect(readExistingSttRun(await storedRun(target), [plain])).resolves.toBeDefined()
    }
    for (const changed of [
      targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true' }),
      targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-number-format': 'spoken' })
    ]) {
      await expect(readExistingSttRun(await storedRun(plain), [changed])).rejects.toThrow(`Cannot resume assemblyai/${ASSEMBLY_37} with changed`)
    }
  })

  test('Grok: --stt-verbatim and the explicit filler-words/spoken pair are one request; other values still differ', async () => {
    const verbatim = targetFor({ 'grok-stt': GROK, 'stt-verbatim': 'true' })
    const explicitPair = targetFor({ 'grok-stt': GROK, 'stt-filler-words': 'true', 'stt-number-format': 'spoken' })
    const plain = targetFor({ 'grok-stt': GROK })
    const legacyVerbatimEntry = { service: 'grok', model: GROK, local: false, grokSttVerbatim: true, diarizationOptions: { enabled: true }, settings: toRequestedProvider(verbatim).settings }
    await expect(readExistingSttRun(await storedRun(legacyVerbatimEntry), [explicitPair])).resolves.toBeDefined()
    await expect(readExistingSttRun(await storedRun(explicitPair), [verbatim])).resolves.toBeDefined()
    await expect(readExistingSttRun(await storedRun(plain), [targetFor({ 'grok-stt': GROK, 'stt-number-format': 'written' })])).resolves.toBeDefined()
    // filler_words=false is sent while the unset request omits it, so these are different requests.
    await expect(readExistingSttRun(await storedRun(plain), [targetFor({ 'grok-stt': GROK, 'stt-filler-words': 'false' })])).rejects.toThrow('Cannot resume grok')
    await expect(readExistingSttRun(await storedRun(verbatim), [targetFor({ 'grok-stt': GROK, 'stt-filler-words': 'true' })])).rejects.toThrow('Cannot resume grok')
  })

  test('split checkpoints: equal effective requests share the fingerprint written before the explicit controls existed', async () => {
    const dir = await tempDirs.make()
    const path = join(dir, 'segment.wav')
    await Bun.write(path, 'fixture')
    const segment = { path, startSeconds: 0, durationSeconds: 1 }
    const plain37 = targetFor({ 'assemblyai-stt': ASSEMBLY_37 })
    const legacy37 = await legacyFingerprint(plain37, path)
    expect(await buildSplitSegmentFingerprint(plain37, segment)).toBe(legacy37)
    expect(await buildSplitSegmentFingerprint(targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'false', 'stt-number-format': 'written' }), segment)).toBe(legacy37)
    expect(await buildSplitSegmentFingerprint(targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true' }), segment)).not.toBe(legacy37)

    const verbatim = targetFor({ 'grok-stt': GROK, 'stt-verbatim': 'true' })
    const legacyVerbatim = await legacyFingerprint(verbatim, path)
    expect(await buildSplitSegmentFingerprint(verbatim, segment)).toBe(legacyVerbatim)
    expect(await buildSplitSegmentFingerprint(targetFor({ 'grok-stt': GROK, 'stt-filler-words': 'true', 'stt-number-format': 'spoken' }), segment)).toBe(legacyVerbatim)
    const plainGrok = targetFor({ 'grok-stt': GROK })
    expect(await buildSplitSegmentFingerprint(targetFor({ 'grok-stt': GROK, 'stt-number-format': 'written' }), segment)).toBe(await legacyFingerprint(plainGrok, path))
    expect(await buildSplitSegmentFingerprint(targetFor({ 'grok-stt': GROK, 'stt-filler-words': 'false' }), segment)).not.toBe(await legacyFingerprint(plainGrok, path))
  })

  test('settings record the pinned values under request.effectiveDefaults without labelling default runs', () => {
    const plain37 = buildSttProviderSettings(targetFor({ 'assemblyai-stt': ASSEMBLY_37 }))
    expect(plain37.request).toEqual({ model: ASSEMBLY_37, effectiveDefaults: { fillerWords: false, numberFormat: 'written' }, diarization: { enabled: true } })
    expect(providerSettingsLabel(plain37)).toBeNull()

    const fillers37 = buildSttProviderSettings(targetFor({ 'assemblyai-stt': ASSEMBLY_37, 'stt-filler-words': 'true' }))
    expect(fillers37.request).toMatchObject({ fillerWords: true, effectiveDefaults: { numberFormat: 'written' } })
    expect(providerSettingsLabel(fillers37)).toBe('fillerWords=true')

    const plainGrok = buildSttProviderSettings(targetFor({ 'grok-stt': GROK }))
    expect(plainGrok.request).toMatchObject({ effectiveDefaults: { numberFormat: 'written' } })
    expect(plainGrok.request['effectiveDefaults']).not.toHaveProperty('fillerWords')
    expect(providerSettingsLabel(plainGrok)).toBeNull()
    expect(buildSttProviderSettings(targetFor({ 'grok-stt': GROK, 'stt-verbatim': 'true' })).request).not.toHaveProperty('effectiveDefaults')

    // Other providers and models keep their settings records unchanged.
    expect(buildSttProviderSettings(targetFor({ 'assemblyai-stt': ASSEMBLY_35 })).request).toEqual({ model: ASSEMBLY_35, diarization: { enabled: true } })
    expect(buildSttProviderSettings(targetFor({ 'deepgram-stt': 'nova-3' })).request).toEqual({ model: 'nova-3', diarization: { enabled: true } })
  })
})
