import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CliCommandContext, StructuredScriptData } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { mixAudioToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { generateComicAudio } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { writeVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/voice-reference-snapshot'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { COMIC_AUDIO_PHASE_2_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_2_HASH_A as HASH_A, COMIC_AUDIO_PHASE_2_HASH_B as HASH_B, buildComicAudioPhase2SnapshotEntry as snapshotEntry, buildComicAudioPhase2Structured as buildStructured } from './comic-audio-phase-fixture'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'HUME_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-2-' })

describe('comic audio phase 2 contracts', () => {
  test('soundscape-only command uses a canonical local silence clock without selecting TTS', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-test-key'
    const calls = installMockFetch(() => new Response(createMockWavBytes(), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const root = await makeTempDir('autoshow-comic-audio-soundscape-only-')
    const sourcePath = join(root, 'soundscape-only.md')
    const sceneRunDir = join(root, 'run')
    const prompt = `airlock closes ${crypto.randomUUID()}`
    const sourceText = `A silent bridge.\n${prompt}\n`
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const promptStart = [...sourceText.slice(0, sourceText.indexOf(prompt))].length
    const structured: StructuredScriptData = {
      schemaVersion: 5, scriptSlug: sourceIdentity.scriptSlug, sourceFile: sourceIdentity.canonicalPath, sourceIdentity,
      document: { heading: 'Episode', title: 'Episode', metadata: [] },
      scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' }, soundscape: { cues: [{ cueId: hashCanonicalTtsValue({ prompt, promptStart }), kind: 'action-sfx', prompt, required: true, anchor: { kind: 'scene-clock', positionMs: 0 }, sourceSpan: { kind: 'sound-effect', start: promptStart, end: promptStart + [...prompt].length, indexUnit: 'unicode-scalar-value', text: prompt }, durationSeconds: 1 }], ambientBeds: [] } },
      characterKeys: [], beats: [],
      sourceSegments: [{ id: 'beat-0001', type: 'direction', text: 'A silent bridge.', sourceSpans: [{ kind: 'stage-direction', start: 0, end: 16, indexUnit: 'unicode-scalar-value', text: 'A silent bridge.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } }],
    }
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const sfxValue = 'elevenlabs=eleven_text_to_sound_v2'
    const context = {
      argv: [], flags: { 'sfx-provider': sfxValue }, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: { doubleDash: [], explicitFlags: new Set(['sfx-provider']), flagOccurrences: [{ name: 'sfx-provider', raw: '--sfx-provider', value: sfxValue, known: true }], flagOccurrenceIndices: [0], unknown: {}, positionals: [] },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try { await generateComicAudio(context, sourcePath) } finally { resetPinnedRunDir() }
    const manifest = await readManifest(sceneRunDir)
    const comic = manifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string } }, audio: { selectedAudioRuns?: unknown[], selectedSoundscapeRuns?: Array<{ masterRef: { path: string } }> } }
    expect(manifest?.items[0]?.providers.map(provider => provider.operation)).toEqual(['sound-effect-generation'])
    expect(comic.stages.audio.status).toBe('full')
    expect(comic.audio.selectedAudioRuns).toHaveLength(1)
    expect(comic.audio.selectedSoundscapeRuns).toHaveLength(1)
    expect(await Bun.file(join(sceneRunDir, comic.audio.selectedSoundscapeRuns?.[0]?.masterRef.path as string)).exists()).toBe(true)
    expect(calls).toHaveLength(1)
  }, 20_000)

  test('mocked segmented command crosses the shared barrier and publishes canonical comic audio', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    let requestOrdinal = 0
    const calls = installMockFetch(() => new Response(createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.2, frequencyHz: 220 + requestOrdinal++ * 55 }), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const root = await makeTempDir('autoshow-comic-audio-command-')
    const sourcePath = join(root, 'scene.md')
    const sceneRunDir = join(root, 'run')
    const sourceText = '# Episode\n\n## Scene\n\n**PILOT**\nReady? (beat) Go.\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const structured = buildStructured(sourceIdentity, sourceText)
    const firstSpokenStart = [...sourceText.slice(0, sourceText.indexOf('Ready?'))].length
    const timingStart = [...sourceText.slice(0, sourceText.indexOf('(beat)'))].length
    const secondSpokenStart = [...sourceText.slice(0, sourceText.indexOf('Go.'))].length
    structured.sourceSegments[0] = {
      ...structured.sourceSegments[0]!,
      text: 'Ready? Go.',
      sourceSpans: [
        { kind: 'spoken-text', start: firstSpokenStart, end: firstSpokenStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' },
        { kind: 'timing', start: timingStart, end: timingStart + 6, indexUnit: 'unicode-scalar-value', text: '(beat)' },
        { kind: 'spoken-text', start: secondSpokenStart, end: secondSpokenStart + 3, indexUnit: 'unicode-scalar-value', text: 'Go.' },
      ]
    }
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'onyx', 'openai'), snapshotEntry('pilot', 'alloy', 'openai')]
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const snapshot = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
    await writeVoiceReferenceManifest(sceneRunDir, snapshot)
    const providerValue = 'openai=gpt-4o-mini-tts-2025-12-15'
    const context = {
      argv: [], flags: { provider: [providerValue], mode: 'segmented' }, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: {
        doubleDash: [], explicitFlags: new Set(['provider', 'mode']),
        flagOccurrences: [{ name: 'provider', raw: '--provider', value: providerValue, known: true }, { name: 'mode', raw: '--mode', value: 'segmented', known: true }],
        flagOccurrenceIndices: [0, 1], unknown: {}, positionals: [],
      },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try {
      await generateComicAudio(context, sourcePath)
    } finally {
      resetPinnedRunDir()
    }
    const manifest = await readManifest(sceneRunDir)
    const provider = manifest?.items[0]?.providers[0]
    const comic = manifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string } }, audio: { selectedAudioRuns?: unknown[], finalOutputRefs?: Array<{ path: string, sha256: string }> } }
    expect(calls.map(call => call.bodyJson?.['voice']).sort()).toEqual(['alloy', 'alloy', 'onyx'])
    expect(calls.filter(call => call.bodyJson?.['voice'] === 'alloy').map(call => call.bodyJson?.['input'])).toEqual(['Ready?', 'Go.'])
    expect(provider).toEqual(expect.objectContaining({ operation: 'comic-audio', status: 'succeeded' }))
    expect(provider?.result?.['comicAudio']).toEqual(expect.objectContaining({ selectedSuccess: expect.any(Object) }))
    expect(comic.stages.audio.status).toBe('full')
    expect(comic.audio.selectedAudioRuns).toHaveLength(1)
    expect(comic.audio.finalOutputRefs).toHaveLength(1)
    expect(await Bun.file(join(sceneRunDir, comic.audio.finalOutputRefs?.[0]?.path as string)).exists()).toBe(true)

    const firstFinal = comic.audio.finalOutputRefs?.[0]
    const replacementContext = {
      argv: [], flags: { provider: [providerValue], mode: 'segmented', 'tts-speed': '1.1' }, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: {
        doubleDash: [], explicitFlags: new Set(['provider', 'mode', 'tts-speed']),
        flagOccurrences: [{ name: 'provider', raw: '--provider', value: providerValue, known: true }, { name: 'mode', raw: '--mode', value: 'segmented', known: true }, { name: 'tts-speed', raw: '--tts-speed', value: '1.1', known: true }],
        flagOccurrenceIndices: [0, 1, 2], unknown: {}, positionals: [],
      },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try {
      await generateComicAudio(replacementContext, sourcePath)
    } finally {
      resetPinnedRunDir()
    }
    const replacedManifest = await readManifest(sceneRunDir)
    const replacedProvider = replacedManifest?.items[0]?.providers[0]
    const replacedComic = replacedManifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string } }, audio: { selectedAudioRuns?: unknown[], finalOutputRefs?: Array<{ path: string, sha256: string }> } }
    const replacementFinal = replacedComic.audio.finalOutputRefs?.[0]
    expect(calls).toHaveLength(6)
    expect(replacedProvider?.status).toBe('succeeded')
    expect(replacedProvider?.result?.['comicAudio']).toEqual(expect.objectContaining({ renderHistory: expect.arrayContaining([expect.any(Object), expect.any(Object)]), selectedSuccess: expect.any(Object) }))
    expect(replacedComic.stages.audio.status).toBe('full')
    expect(replacedComic.audio.selectedAudioRuns).toHaveLength(1)
    expect(replacementFinal?.path).toBe(firstFinal?.path)
    expect(replacementFinal?.sha256).not.toBe(firstFinal?.sha256)
  }, 20_000)

  test('mocked comic command publishes a canonical soundscape master after both provider barriers', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-test-key'
    const calls = installMockFetch(() => new Response(createMockWavBytes(), { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': 'fixture-request' } }))
    const root = await makeTempDir('autoshow-comic-soundscape-command-')
    const sourcePath = join(root, 'scene.md')
    const sceneRunDir = join(root, 'run')
    const prompt = `hatch slams ${crypto.randomUUID()}`
    const sourceText = `# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n\n**SFX:**\n\n${prompt}\n`
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const structured = buildStructured(sourceIdentity, sourceText)
    const effectStart = [...sourceText.slice(0, sourceText.indexOf(prompt))].length
    structured.scene.soundscape.cues = [{
      cueId: hashCanonicalTtsValue({ sourceIdentity: sourceIdentity.identityHash, effectStart, prompt }), kind: 'action-sfx', prompt, required: true,
      anchor: { kind: 'scene-clock', positionMs: 0 }, sourceSpan: { kind: 'sound-effect', start: effectStart, end: effectStart + [...prompt].length, indexUnit: 'unicode-scalar-value', text: prompt }, durationSeconds: 1,
    }]
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'onyx', 'openai'), snapshotEntry('pilot', 'alloy', 'openai')]
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    await writeVoiceReferenceManifest(sceneRunDir, validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) }))
    const providerValue = 'openai=gpt-4o-mini-tts-2025-12-15'
    const sfxValue = 'elevenlabs=eleven_text_to_sound_v2'
    const context = {
      argv: [], flags: { provider: [providerValue], mode: 'segmented', 'sfx-provider': sfxValue }, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: {
        doubleDash: [], explicitFlags: new Set(['provider', 'mode', 'sfx-provider']),
        flagOccurrences: [{ name: 'provider', raw: '--provider', value: providerValue, known: true }, { name: 'mode', raw: '--mode', value: 'segmented', known: true }, { name: 'sfx-provider', raw: '--sfx-provider', value: sfxValue, known: true }],
        flagOccurrenceIndices: [0, 1, 2], unknown: {}, positionals: [],
      },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try { await generateComicAudio(context, sourcePath) } finally { resetPinnedRunDir() }
    const manifest = await readManifest(sceneRunDir)
    const comic = manifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string, targetKeys: string[] } }, audio: { selectedSoundscapeRuns?: Array<{ masterRef: { path: string, sha256: string } }>, finalOutputRefs?: Array<{ path: string, sha256: string }> } }
    expect(manifest?.items[0]?.providers.map(provider => provider.operation).sort()).toEqual(['comic-audio', 'sound-effect-generation'])
    expect(comic.stages.audio).toMatchObject({ status: 'full', targetKeys: expect.arrayContaining([canonicalTargetKey('sound-effect-generation', 'elevenlabs', 'eleven_text_to_sound_v2', 'hosted-api')]) })
    expect(comic.audio.selectedSoundscapeRuns).toHaveLength(1)
    expect(comic.audio.finalOutputRefs?.some(ref => ref.sha256 === comic.audio.selectedSoundscapeRuns?.[0]?.masterRef.sha256)).toBe(true)
    expect(calls.filter(call => call.url.includes('/v1/sound-generation'))).toHaveLength(1)
  }, 20_000)

  test('aggregate snapshots reject duplicate target/profile/subject authority', () => {
    const first = snapshotEntry('pilot', 'Kore')
    const second = snapshotEntry('pilot', 'Puck')
    const entries = [first, second].sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
    const base = { schemaVersion: 1 as const, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    expect(() => validateVoiceReferenceManifest({ ...base, snapshotId: hashCanonicalTtsValue(base) })).toThrow(/duplicate provider\/model\/profile\/subject bindings/)
  })

  test('local overlap mixing uses the longest child and honors the selected mastering profile', async () => {
    const root = await makeTempDir('autoshow-comic-overlap-mix-')
    const first = join(root, 'first.wav')
    const second = join(root, 'second.wav')
    const output = join(root, 'mixed.wav')
    await writeFile(first, createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.2, frequencyHz: 330 }))
    await writeFile(second, createSyntheticWavBytes({ durationSeconds: 0.4, amplitude: 0.2, frequencyHz: 440 }))
    await mixAudioToWav([first, second], output, 'comic-contract', { schemaVersion: 1, sampleRate: 48000, channels: 2, codec: 'pcm_s24le', container: 'wav' })
    const bytes = await readFile(output)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let cursor = 12
    let channels = 0
    let sampleRate = 0
    let bitsPerSample = 0
    let dataBytes = 0
    while (cursor + 8 <= bytes.byteLength) {
      const chunk = bytes.subarray(cursor, cursor + 4).toString('ascii')
      const size = view.getUint32(cursor + 4, true)
      if (chunk === 'fmt ') {
        channels = view.getUint16(cursor + 10, true)
        sampleRate = view.getUint32(cursor + 12, true)
        bitsPerSample = view.getUint16(cursor + 22, true)
      }
      if (chunk === 'data') dataBytes = size
      cursor += 8 + size + (size % 2)
    }
    const durationSeconds = dataBytes / (sampleRate * channels * (bitsPerSample / 8))
    expect({ channels, sampleRate, bitsPerSample }).toEqual({ channels: 2, sampleRate: 48000, bitsPerSample: 24 })
    expect(durationSeconds).toBeGreaterThan(0.38)
    expect(durationSeconds).toBeLessThan(0.42)
  })
})
