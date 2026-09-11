import { afterEach, expect, test } from 'bun:test'
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CanonicalComicItemMetadata, CliCommandContext, GenerateImagesCommandOptions, ResumeTarget, ScenePromptData } from '~/types'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/visuals/comic/comic-utils/comic-dialogue-plan'
import { writeVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/voice-reference-snapshot'
import { writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { readManifest, updateManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { generateComicAudio } from '~/cli/commands/visuals/comic/comic-commands/generate-audio/generate-audio-command'
import { generateImagesCommand } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-images-command'
import { captureComicImageRecoveryInputs, comicImageRecoveryFlags, comicImageRecoveryHash } from '~/cli/commands/visuals/comic/comic-utils/comic-image-recovery'
import { recordComicRecoveryIntent } from '~/cli/commands/visuals/comic/comic-utils/comic-recovery-intent'
import { generateComicSlideshow, recordPendingComicSlideshow } from '~/cli/commands/visuals/comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { resolveCompatibleComicSceneRun } from '~/cli/commands/visuals/comic/comic-utils/compatible-scene-run'
import { generateAudioCommandDefinition, generateSlideshowCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { comicResumeHandler, planComicResume } from '~/cli/commands/setup-and-utilities/resume/resume-comic/comic-resume'
import { dispatchResume, normalizeResumeSelectorFlagsForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { createSyntheticWavBytes, redDotPng } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { captureProcessOutput } from '../../../test-utils/console-capture'
import { runCliInProcess } from '~/cli/create-cli'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { buildComicAudioPhase2SnapshotEntry, buildComicAudioPhase2Structured, COMIC_AUDIO_PHASE_2_CREATED_AT as createdAt } from '../visuals/comic/comic-audio-phase-fixture'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'AUTOSHOW_REQUIRED_IMAGE_MODEL'], tempPrefix: 'autoshow-comic-resume-' })
afterEach(() => { resetPinnedRunDir(); resetSceneRunContext(); configureCharactersRoot('input/characters'); resetLoggerForInvocation(false) })

const fixture = async () => {
  const root = await makeTempDir('autoshow-comic-resume-')
  const source = '# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
  const scriptPath = join(root, 'scene.md')
  const run = join(root, 'run')
  await mkdir(join(run, 'metadata'), { recursive: true })
  await writeFile(scriptPath, source)
  const sourceIdentity = await createComicSourceIdentity(scriptPath, source)
  const structured = buildComicAudioPhase2Structured(sourceIdentity, source)
  const bytes = `${canonicalTtsJson(structured)}\n`
  const structuredScript = createStructuredScriptArtifactRef(bytes)
  await writeFile(join(run, structuredScript.path), bytes)
  await writeInitialComicStructureManifest({ sceneRunDir: run, createdAt, sourceIdentity, structuredScript })
  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredScript)
  const dialogue = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredScript, sceneRunIdentity, createdAt })
  const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialogue.dialoguePlanId, catalogHash: 'a'.repeat(64), briefSetHash: 'b'.repeat(64), createdAt, entries: [buildComicAudioPhase2SnapshotEntry('navigator', 'onyx', 'openai'), buildComicAudioPhase2SnapshotEntry('pilot', 'alloy', 'openai')] }
  await writeVoiceReferenceManifest(run, validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) }))
  configureCharactersRoot(join(root, 'characters'))
  configurePinnedRunDir(run)
  const target: ResumeTarget = { kind: 'comic', scope: 'single', dir: run, manifestPath: join(run, 'manifest.json') }
  return { root, run, scriptPath, target, structured }
}

const context = (scriptPath: string, args: string[], slideshow = false): CliCommandContext => {
  const command = slideshow ? generateSlideshowCommandDefinition : generateAudioCommandDefinition
  const parsed = parseCommandInvocation([command.name, scriptPath, ...args], command, GLOBAL_FLAG_DEFINITIONS)
  return { argv: parsed.argv, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, command, store: {} }
}
const audioArgs = ['--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--mode', 'segmented']
const comic = async (run: string) => (await readManifest(run))!.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata
const hashes = async (run: string) => {
  const names = await readdir(run, { recursive: true, withFileTypes: true })
  const result: Record<string, string> = {}
  for (const item of names) if (item.isFile()) {
    const path = join(item.parentPath, item.name)
    result[path] = sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer()))
  }
  return result
}
const visuals = async (input: Awaited<ReturnType<typeof fixture>>) => {
  const scene: ScenePromptData = { schemaVersion: 4, title: 'Scene', location: 'Bridge', panels: input.structured.sourceSegments.map((segment, index) => ({ number: index + 1, description: 'Empty bridge.', shotPlan: 'Static wide shot.', characterKeys: [], speech: [{ speaker: { kind: 'character' as const, characterKey: segment.speakerKey as never, offscreen: true }, line: segment.text }], sourceSegmentIds: [segment.id], locationKey: 'bridge', designReferences: [] })) }
  await writeFile(join(input.run, 'metadata/scene.json'), JSON.stringify(scene))
  await mkdir(join(input.run, 'panels'), { recursive: true })
  for (const number of [1, 2]) {
    const child = Bun.spawn([getFfmpegBinary(), '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=30:d=0.04', '-frames:v', '1', '-y', join(input.run, `panels/panel-0${number}.png`)], { stdout: 'pipe', stderr: 'pipe' })
    expect(await child.exited).toBe(0)
  }
}
const mockSpeech = () => {
  process.env['OPENAI_API_KEY'] = 'fixture'
  return installMockFetch(call => {
    if (!call.url.includes('/audio/speech')) throw new Error(`Unexpected provider call: ${call.url}`)
    return new Response(createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.2, frequencyHz: 440 }), { status: 200, headers: { 'content-type': 'audio/wav' } })
  })
}

const imageInputs = async (f: Awaited<ReturnType<typeof fixture>>) => {
  const sha = sha256Bytes(redDotPng)
  const sheet = 'assets/location-references/location-snapshot/bridge.png'
  await mkdir(dirname(join(f.run, sheet)), { recursive: true })
  await writeFile(join(f.run, sheet), redDotPng)
  await writeFile(join(f.run, 'assets/character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt, characters: [] }))
  await writeFile(join(f.run, 'assets/location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'bridge', specification: 'An empty bridge.', sourceScripts: ['scene.md'], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: sheet, sha256: sha } }] }))
  const panels = f.structured.sourceSegments.map((segment, index) => ({ number: index + 1, description: 'Empty bridge.', shotPlan: 'Wide shot.', characterKeys: [], speech: [{ speaker: { kind: 'character', characterKey: segment.speakerKey, offscreen: true }, line: segment.text }], sourceSegmentIds: [segment.id], sourceSegments: [segment], locationKey: 'bridge', locationSnapshotId: 'location-snapshot', designReferences: [] }))
  await writeFile(join(f.run, 'metadata/scene.json'), JSON.stringify({ schemaVersion: 4, title: 'Scene', location: 'Bridge', panels: panels.map(({ sourceSegments: _sourceSegments, locationSnapshotId: _snapshot, ...panel }) => panel) }))
  for (const panel of panels) {
    const path = join(f.run, `metadata/panel-prompts/panel-0${panel.number}/prompt.md`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '```json\n' + JSON.stringify({ schemaVersion: 4, snapshotId: 'character-snapshot', title: 'Scene', location: 'Bridge', panels: [panel] }) + '\n```\n')
  }
}

for (const models of [['gemini-3.1-flash-lite-image'], ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image']] as const) {
  test(`image recovery binds the original output directory and reuses completed panels with ${models.length} models`, async () => {
    const f = await fixture()
    await imageInputs(f)
    process.env['GEMINI_API_KEY'] = 'fixture'
    delete process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
    let succeed = false
    let generated = 0
    const calls = installMockFetch(call => {
      if (!models.some(model => call.url.includes(`${model}:generateContent`))) throw new Error(`Unexpected provider call: ${call.url}`)
      if (generated === 1 && !succeed) return new Response('Fixture interruption', { status: 400 })
      generated++
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from(redDotPng).toString('base64') } }] } }] })
    })
    const failure = await generateImagesCommand({ scriptPath: f.scriptPath, sceneSlug: f.structured.sourceIdentity.scriptSlug, target: 'images', imageModels: [...models], panelsPerImage: 1, panels: 'all', qa: false, concurrency: 1, stopOnProviderError: true }).then(() => undefined, error => error)
    if (generated === 0) throw failure
    expect(failure).toBeInstanceOf(Error)
    expect(generated).toBe(1)
    const intent = (await comic(f.run)).recovery!.image!
    expect(intent.completed).toBe(false)
    const panelPath = join(f.run, 'panels', intent.imageRunId!, ...(models.length > 1 ? [models[0]] : []), 'panel-01.png')
    const retained = sha256Bytes(new Uint8Array(await Bun.file(panelPath).arrayBuffer()))
    const before = await hashes(f.run)
    const count = calls.length
    const plan = await planComicResume(f.target)
    expect(plan.stages[0]).toMatchObject({ action: 'resume', steps: models.map((model, index) => expect.objectContaining({ model, imageCount: index === 0 ? 1 : 2 })) })
    expect(plan.ready).toBe(true)
    expect(await hashes(f.run)).toEqual(before)
    expect(calls).toHaveLength(count)
    succeed = true
    await dispatchResume(f.run, {})
    expect(generated).toBe(2 * models.length)
    expect(calls).toHaveLength(count + 2 * models.length - 1)
    expect((await comic(f.run)).recovery?.image?.imageRunId).toBe(intent.imageRunId)
    expect(sha256Bytes(new Uint8Array(await Bun.file(panelPath).arrayBuffer()))).toBe(retained)
    expect(await Bun.file(join(dirname(panelPath), 'panel-02.png')).exists()).toBe(true)
    const completed = await hashes(f.run)
    await dispatchResume(f.run, {})
    expect(await hashes(f.run)).toEqual(completed)
    expect(calls).toHaveLength(count + 2 * models.length - 1)
    await writeFile(join(f.run, 'metadata/panel-prompts/panel-02/extra.md'), 'Changed prompt input')
    expect((await planComicResume(f.target)).stages[0]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('inputs were added') })
  }, 20_000)
}

test('comic resume leaves unrequested stages and complete runs byte-identical without provider calls', async () => {
  const f = await fixture()
  const calls = installMockFetch(() => { throw new Error('No provider work is allowed') })
  const before = await hashes(f.run)
  const plan = await planComicResume(f.target)
  expect(plan.ready).toBe(true)
  expect(plan.stages.map(stage => stage.action)).toEqual(['not-requested', 'not-requested', 'not-requested'])
  await dispatchResume(f.run, { price: true })
  await dispatchResume(f.run, {})
  expect(await hashes(f.run)).toEqual(before)
  expect(calls).toHaveLength(0)
})

for (const panelsPerImage of [1, 2]) {
  test(`image recovery prices unfinished QA on retained images with ${panelsPerImage} panels per image`, async () => {
    const f = await fixture()
    await imageInputs(f)
    delete process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
    const options: GenerateImagesCommandOptions = { scriptPath: f.scriptPath, sceneSlug: f.structured.sourceIdentity.scriptSlug, target: 'images', imageModels: ['gemini-3.1-flash-lite-image'], panelsPerImage, qa: true, maxRepairs: 0, recoveryRunId: 'retained' }
    await recordComicRecoveryIntent({ rootDir: f.run, sourceIdentity: f.structured.sourceIdentity, stage: 'image', flags: comicImageRecoveryFlags(options), inputs: await captureComicImageRecoveryInputs(f.run), imageRunId: options.recoveryRunId, planHash: comicImageRecoveryHash(options) })
    const files = panelsPerImage === 1 ? ['panels/retained/panel-01.png', 'panels/retained/panel-02.png'] : ['pages/retained/page-01-panels-01-02.png']
    for (const file of files) {
      await mkdir(dirname(join(f.run, file)), { recursive: true })
      await writeFile(join(f.run, file), redDotPng)
    }
    const calls = installMockFetch(() => { throw new Error('Pricing must not dispatch QA or images') })
    const before = await hashes(f.run)
    const plan = await planComicResume(f.target)
    expect(plan.ready).toBe(true)
    expect(plan.stages[0]!.steps.filter(step => step.step === 'image').map(step => step.imageCount)).toEqual([0])
    expect(plan.stages[0]!.steps.find(step => step.step === 'llm')?.totalCost).toBeGreaterThan(0)
    expect(await hashes(f.run)).toEqual(before)
    expect(calls).toHaveLength(0)
  })
}

test('recorded audio checkpoint resumes only the missing slot and completes its pending local slideshow', async () => {
  const f = await fixture()
  await visuals(f)
  const calls = mockSpeech()
  await generateComicAudio(context(f.scriptPath, [...audioArgs, '--max-generation-slots', '1', '--slideshow']), f.scriptPath)
  expect(calls).toHaveLength(1)
  expect((await comic(f.run)).recovery?.presentation?.completed).toBe(false)
  expect((await comic(f.run)).recovery?.audio?.flags['max-generation-slots']).toBeUndefined()
  const beforePrice = await hashes(f.run)
  const plan = await planComicResume(f.target)
  expect(plan.stages.map(stage => stage.action)).toEqual(['not-requested', 'resume', 'after-audio'])
  expect(plan.ready).toBe(true)
  expect(plan.estimate.totalEstimatedCost).toBeGreaterThan(0)
  expect(await hashes(f.run)).toEqual(beforePrice)
  expect(calls).toHaveLength(1)
  await dispatchResume(f.run, {})
  expect(calls).toHaveLength(2)
  expect((await comic(f.run)).stages.presentation.status).toBe('full')
  expect(await Bun.file(join(f.run, 'presentation/final/slideshow.mp4')).exists()).toBe(true)
  const completed = await hashes(f.run)
  await dispatchResume(f.run, { price: true })
  await dispatchResume(f.run, {})
  expect(calls).toHaveLength(2)
  expect(await hashes(f.run)).toEqual(completed)
  for (const [path, hash] of Object.entries(beforePrice).filter(([path]) => path.endsWith('.wav'))) expect(completed[path]).toBe(hash)
}, 20_000)

test('older incomplete intent and changed source are blockers, and provider overrides are rejected', async () => {
  const f = await fixture()
  await updateManifest(f.run, manifest => {
    const metadata = manifest.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata
    metadata.stages.audio = { requirement: 'required', status: 'incomplete', execution: { kind: 'local', state: 'missing' }, targetKeys: [], artifactRefs: [] }
    manifest.items[0]!.status = 'incomplete'
    return manifest
  })
  const before = await hashes(f.run)
  expect((await planComicResume(f.target)).stages[1]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('lacks exact audio recovery options') })
  await expect(comicResumeHandler.resume(f.target, {}, new Set())).rejects.toThrow('original choices')
  expect(() => normalizeResumeSelectorFlagsForTarget(f.target, { provider: ['openai'] }, new Set(['provider']), [])).toThrow('does not accept --provider')
  expect(await hashes(f.run)).toEqual(before)
  await writeFile(f.scriptPath, 'Changed source')
  await expect(planComicResume(f.target)).rejects.toThrow('exact source')
})

test('comic price uses one JSON result with explicit blocked readiness and does not initialize missing outputs', async () => {
  const f = await fixture()
  await updateManifest(f.run, manifest => {
    const metadata = manifest.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata
    metadata.stages.presentation = { requirement: 'optional', status: 'incomplete', execution: { kind: 'local', state: 'missing' }, targetKeys: [], artifactRefs: [] }
    return manifest
  })
  const before = await hashes(f.run)
  const output = await captureProcessOutput(() => runCliInProcess(['resume', f.run, '--price', '--json']))
  expect(output.result).toBe(0)
  const lines = output.stdout.trim().split('\n').map(line => JSON.parse(line))
  expect(lines).toHaveLength(1)
  expect(lines[0].data.comicPlans[0]).toMatchObject({ ready: false, stages: expect.arrayContaining([expect.objectContaining({ stage: 'presentation', action: 'blocked' })]) })
  expect(await hashes(f.run)).toEqual(before)
  configurePinnedRunDir(join(f.root, 'absent'))
  await expect(generateComicAudio(context(f.scriptPath, [...audioArgs, '--price']), f.scriptPath)).rejects.toThrow('read-only planning')
  expect(await Bun.file(join(f.root, 'absent/manifest.json')).exists()).toBe(false)
})

test('slideshow price validates missing visual inputs and writes nothing', async () => {
  const f = await fixture()
  const before = await hashes(f.run)
  await expect(generateComicSlideshow(context(f.scriptPath, ['--price'], true), f.scriptPath)).rejects.toThrow('visual preflight')
  expect(await hashes(f.run)).toEqual(before)
})

test('presentation-only recovery stays local and rejects stale completed dependencies even without new intent', async () => {
  const f = await fixture()
  await visuals(f)
  const calls = mockSpeech()
  await generateComicAudio(context(f.scriptPath, audioArgs), f.scriptPath)
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath: f.scriptPath, outputDir: f.run, readOnly: true })
  await recordPendingComicSlideshow(context(f.scriptPath, [], true), compatible, (await comic(f.run)).recovery!.audio!.planHash)
  const count = calls.length
  const before = await hashes(f.run)
  const plan = await planComicResume(f.target)
  expect(plan.stages.map(stage => stage.action)).toEqual(['not-requested', 'reuse', 'resume'])
  expect(plan.estimate.totalEstimatedCost).toBe(0)
  expect(await hashes(f.run)).toEqual(before)
  await dispatchResume(f.run, {})
  expect(calls).toHaveLength(count)
  await updateManifest(f.run, manifest => {
    delete (manifest.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata).recovery!.presentation
    return manifest
  })
  const scenePath = join(f.run, 'metadata/scene.json')
  const scene = await Bun.file(scenePath).json()
  scene.panels[0].description = 'A changed reviewed scene.'
  await writeFile(scenePath, JSON.stringify(scene))
  const stale = await hashes(f.run)
  expect((await planComicResume(f.target)).stages[2]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('dependencies changed') })
  await expect(comicResumeHandler.resume(f.target, {}, new Set())).rejects.toThrow('dependencies changed')
  expect(await hashes(f.run)).toEqual(stale)
  expect(calls).toHaveLength(count)
}, 20_000)

test('missing retained voice evidence blocks recovery before new synthesis', async () => {
  const f = await fixture()
  const calls = mockSpeech()
  await generateComicAudio(context(f.scriptPath, [...audioArgs, '--max-generation-slots', '1']), f.scriptPath)
  const voicePath = (await comic(f.run)).audio.snapshotRef!.path
  await rename(join(f.run, voicePath), join(f.root, 'retained-voice-evidence.json'))
  const before = await hashes(f.run)
  await expect(planComicResume(f.target)).rejects.toThrow()
  expect(calls).toHaveLength(1)
  expect(await hashes(f.run)).toEqual(before)
})

test('ambiguous audio admission requires the existing explicit redispatch control', async () => {
  const f = await fixture()
  process.env['OPENAI_API_KEY'] = 'fixture'
  let repaired = false
  let attempted = 0
  const calls = installMockFetch(call => {
    if (!call.url.includes('/audio/speech')) throw new Error(`Unexpected provider call: ${call.url}`)
    attempted++
    const bytes = attempted === 1 || repaired ? createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.2, frequencyHz: 440 }) : new Uint8Array([0, 1, 2])
    return new Response(bytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
  })
  await expect(generateComicAudio(context(f.scriptPath, [...audioArgs, '--tts-chunk-concurrency', '1']), f.scriptPath)).rejects.toThrow()
  const before = await hashes(f.run)
  const count = calls.length
  expect((await planComicResume(f.target)).stages[1]).toMatchObject({ action: 'blocked', detail: expect.stringContaining('ambiguous') })
  await expect(comicResumeHandler.resume(f.target, {}, new Set())).rejects.toThrow('ambiguous')
  expect(calls).toHaveLength(count)
  expect(await hashes(f.run)).toEqual(before)
  expect((await planComicResume(f.target, true)).ready).toBe(true)
  expect(await hashes(f.run)).toEqual(before)
  repaired = true
  await dispatchResume(f.run, { 'allow-ambiguous-redispatch': true })
  expect(calls).toHaveLength(count + 1)
  expect((await comic(f.run)).recovery?.audio?.completed).toBe(true)
  expect((await comic(f.run)).recovery?.audio?.flags['allow-ambiguous-redispatch']).toBeUndefined()
}, 20_000)
