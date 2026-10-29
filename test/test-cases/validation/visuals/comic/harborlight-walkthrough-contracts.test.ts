import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { prepareHarborlightComic, publishHarborlightPanels, writeHarborlightBlockingPlan } from '~/tools/prepare-harborlight-comic'
import type { CanonicalComicItemMetadata, ScenePromptData, StructuredScriptData } from '~/types'
import { createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/visuals/comic/comic-utils/comic-dialogue-plan'
import { writeVoiceReferenceManifest } from '~/cli/commands/visuals/comic/comic-utils/voice-reference-snapshot'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { buildComicAudioPhase2SnapshotEntry } from './comic-audio-phase-fixture'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'

const dirs = createTempDirTracker('autoshow-harborlight-comic-')
afterAll(async () => await dirs.cleanup())

const workspace = async (retainedRoot?: string) => {
  if (retainedRoot && (!/^runtime\/examples\/[a-zA-Z0-9_-]+$/.test(retainedRoot))) throw new Error('Retained test artifacts must use a fresh runtime/examples/<name> directory')
  const temporary = await dirs.make(), root = retainedRoot ?? join(temporary, 'example'), run = join(root, 'run')
  await prepareHarborlightComic(root)
  if (retainedRoot) await Bun.write(join(root, 'README.md'), '# Controlled local comic contract artifacts\n\nThese outputs use the real CLI, original Harborlight inputs, mocked OpenAI text/image transport, a test-only voice snapshot, and synthetic 440 Hz tone responses. No provider was contacted or paid. Images are repeated original campsite drawings; audio is a tone, not spoken dialogue. This demonstrates source citations, manifest plumbing, full decoding, synchronization and H.264/AAC rendering, not art, speech, voice approval or perceptual quality. Original source/candidates and canonical copies are preserved.\n')
  const preload = join(temporary, 'transport.ts'), callsFile = join(temporary, 'calls.jsonl'), sceneFile = join(temporary, 'scene-response.json'), wav = join(temporary, 'synthetic-tone.wav')
  await Bun.write(wav, createSyntheticWavBytes({ durationSeconds: 0.35, amplitude: 0.2, frequencyHz: 440 }))
  // Independent official wire expectations (retrieved 2026-10-15):
  // https://developers.openai.com/api/docs/guides/text
  // https://developers.openai.com/api/docs/models/gpt-6.1-sol
  // https://developers.openai.com/api/reference/resources/images/methods/edit
  // https://developers.openai.com/api/reference/resources/images/methods/generate
  // https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
  // Raw Responses HTTP uses output[].content[].text; output_text is SDK convenience.
  await Bun.write(preload, `import { appendFileSync, readFileSync } from 'node:fs'
globalThis.fetch = async (input, init) => {
 const url = String(input)
 if (!process.env.AUTOSHOW_HARBORLIGHT_MOCK) throw new Error('Network forbidden in the local Harborlight walkthrough')
 const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
 const model = typeof body?.get === 'function' ? body.get('model') : body?.model
 appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify({ url, model, responseFormat: body?.response_format }) + String.fromCharCode(10))
 if (url === 'https://api.openai.com/v1/responses') {
  if (model !== 'gpt-6.1-sol' || body.text?.format?.type !== 'json_schema') throw new Error('Unexpected scene model or structured response contract')
  return Response.json({ id: 'resp_harborlight_test', object: 'response', status: 'completed', model, output: [{ id: 'msg_harborlight_test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: readFileSync(${JSON.stringify(sceneFile)}, 'utf8'), annotations: [] }] }], usage: { input_tokens: 200, output_tokens: 200, total_tokens: 400 } })
 }
 if (url === 'https://api.openai.com/v1/images/edits' || url === 'https://api.openai.com/v1/images/generations') {
  if (model !== 'gpt-image-2.5-flare') throw new Error('Unexpected comic image model')
  return Response.json({ created: 1792012800, data: [{ b64_json: readFileSync('input/examples/comic/harborlight/harborlight-camp.png').toString('base64') }], usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40 } })
 }
 if (url === 'https://api.openai.com/v1/audio/speech') {
  if (model !== 'gpt-4o-mini-tts-2025-12-15' || body.response_format !== 'wav' || !['alloy', 'onyx'].includes(body.voice) || !['Lantern ready?', 'Ready. I checked the wick.', 'Then let us mark the path home.', 'A light for whoever comes next.'].includes(body.input)) throw new Error('Unexpected speech model, format, voice or canonical spoken text')
  return new Response(readFileSync(${JSON.stringify(wav)}), { headers: { 'content-type': 'audio/wav' } })
 }
 throw new Error('Unexpected controlled transport: ' + url)
}
`)
  const script = join(root, '02-script/01-harborlight-camp.md')
  const flags = ['--characters-root', join(root, 'characters'), '--output-dir', run, '--config-path', join(root, 'empty-config.json'), '--json']
  const cli = async (args: string[], mock = false) => {
    const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'comic', ...args, ...flags], { env: childEnv({ set: { HOME: temporary, OPENAI_API_KEY: 'controlled-unusable-key', ...(mock ? { AUTOSHOW_HARBORLIGHT_MOCK: 'controlled-test-only' } : {}) } }), stdout: 'pipe', stderr: 'pipe', stdin: 'ignore', signal: AbortSignal.timeout(35_000) })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { code, stdout, stderr }
  }
  const success = async (args: string[], mock = false) => { const result = await cli(args, mock); expect(result, result.stderr).toMatchObject({ code: 0 }); return result }
  const calls = async (): Promise<string[]> => await Bun.file(callsFile).exists() ? (await Bun.file(callsFile).text()).trim().split('\n').map(line => JSON.parse(line).url) : []
  return { root, run, temporary, script, sceneFile, cli, success, calls }
}

const prepareLocalStages = async (w: Awaited<ReturnType<typeof workspace>>) => {
  await w.success(['draft-scenes', w.script, '--only', 'structure'])
  await w.success(['draft-scenes', w.script, '--only', 'prompt'])
  await writeHarborlightBlockingPlan(w.root)
  await w.success(['draft-scenes', w.script, '--only', 'blocking', '--blocking-plan', join(w.root, 'blocking-plan.json')])
  await w.success(['draft-scenes', w.script, '--only', 'blocking', '--rebind'])
  const bytes = await Bun.file(join(w.run, 'metadata/structured-script.json')).text()
  return { bytes, structured: JSON.parse(bytes) as StructuredScriptData }
}

const sceneResponse = (script: StructuredScriptData): ScenePromptData => {
  const groups: StructuredScriptData['sourceSegments'][] = []
  for (const segment of script.sourceSegments) {
    if (segment.type === 'panel-note') groups.push([])
    if (groups.length === 0) groups.push([])
    groups.at(-1)!.push(segment)
  }
  return { schemaVersion: 4, title: 'The Lantern Path', location: 'EXT. HARBORLIGHT CAMP - DUSK', panels: groups.map((segments, index) => ({ number: index + 1, description: 'Papa Bear stands left and Mira right beside the stone fire ring. The timber bench is behind them. The portable lantern is between them.', shotPlan: 'Wide two-shot from the southern approach using path-side-wide; both adult human faces and the bench remain visible.', characterKeys: ['papa-bear', 'mira'], speech: segments.filter(segment => segment.type === 'dialogue').map(segment => ({ speaker: { kind: 'character' as const, characterKey: segment.speakerKey!, offscreen: false }, line: segment.text })), sourceSegmentIds: segments.map(segment => segment.id), locationKey: 'harborlight-camp', designReferences: [], blocking: { stageStateId: 'lantern-path', cameraSetupId: 'path-side-wide', croppedOnStage: [], axisBreak: null } })) }
}

const selectedImageRunId = async (run: string): Promise<string> => ((await readManifest(run))!.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata).recovery!.image!.imageRunId!

test('original Harborlight inputs support real local parser, prompts, authored blocking import/rebind and bounded read-only quotes', async () => {
  const w = await workspace(), { bytes, structured } = await prepareLocalStages(w)
  expect(structured.characterKeys).toEqual(expect.arrayContaining(['papa-bear', 'mira']))
  expect(structured.sourceSegments.filter(segment => segment.type === 'panel-note')).toHaveLength(4)
  expect(structured.sourceSegments.filter(segment => segment.type === 'dialogue').map(segment => segment.text)).toEqual(['Lantern ready?', 'Ready. I checked the wick.', 'Then let us mark the path home.', 'A light for whoever comes next.'])
  expect(structured.sourceSegments.filter(segment => segment.type === 'dialogue').every(segment => segment.sourceSpans.length > 0)).toBe(true)
  const planPath = join(w.run, 'metadata/blocking-plan.json'), before = await Bun.file(planPath).text()
  const plan = JSON.parse(before)
  expect(plan.generatedBy.mode).toBe('import')
  expect(plan.stageStates[0].startsAt.sourceSegmentSha256).toMatch(/^[a-f0-9]{64}$/)
  for (const stage of ['blocking', 'scene']) {
    const result = await w.success(['draft-scenes', w.script, '--only', stage, '--provider', 'openai=gpt-6.1-sol', ...(stage === 'scene' ? ['--panel-count', '4'] : []), '--price'])
    expect(JSON.parse(result.stdout).data.price).toBe(true)
    const estimate = result.stderr.trim().split('\n').map(line => JSON.parse(line)).find(event => typeof event.metadata?.totalCost === 'number')
    expect(estimate.metadata.totalCost).toBeGreaterThan(0)
    expect(estimate.metadata.maximumCalls).toBe(2)
  }
  expect(await Bun.file(planPath).text()).toBe(before)
  expect(await Bun.file(join(w.run, 'metadata/structured-script.json')).text()).toBe(bytes)
  expect(await Bun.file(join(w.run, 'metadata/scene.json')).exists()).toBe(false)
  expect(await w.calls()).toEqual([])
  const badCount = await w.cli(['draft-scenes', w.script, '--only', 'scene', '--panel-count', '5', '--provider', 'openai=gpt-6.1-sol'])
  expect(badCount.code).not.toBe(0)
  expect(badCount.stdout + badCount.stderr).toContain('4 authored')
  expect(await w.calls()).toEqual([])
}, 30_000)

test('controlled hosted scene, sketch sheet and final panels feed real snapshots, canonical publication and local review without quality claims', async () => {
  const w = await workspace(), { structured } = await prepareLocalStages(w)
  await Bun.write(w.sceneFile, JSON.stringify(sceneResponse(structured)))
  await w.success(['draft-scenes', w.script, '--only', 'scene', '--panel-count', '4', '--provider', 'openai=gpt-6.1-sol'], true)
  await w.success(['draft-scenes', w.script, '--only', 'panel-prompts'])
  expect(await w.calls()).toHaveLength(1)
  expect(await Bun.file(join(w.run, 'metadata/panel-prompts/source-coverage.json')).json()).toMatchObject({ complete: true, totalSegments: 12, coveredSegments: 12, missingSegments: [], missingItems: [] })
  await w.success(['review', w.script, '--export-doc'])
  const review = await Bun.file(join(w.run, 'metadata/review/export-doc.md')).text()
  expect(review.match(/### Panel/g)).toHaveLength(4)
  await w.success(['review', w.script, '--notes', join(w.root, 'review-notes.md')])
  const noVoices = await w.cli(['generate-audio', w.script, '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price'])
  expect(noVoices.code).not.toBe(0)
  expect(await w.calls()).toHaveLength(1)
  await w.success(['generate-images', w.script, '--target', 'sketches', '--provider', 'openai=gpt-image-2.5-flare'], true)
  expect((await w.calls()).filter(url => url.includes('/images/'))).toHaveLength(1)
  const sketchRunId = await selectedImageRunId(w.run), sketchPath = join(w.run, `sketches/${sketchRunId}/panels-01-04.png`)
  expect(await Bun.file(sketchPath).exists()).toBe(true)
  const sketchBytes = new Uint8Array(await Bun.file(sketchPath).arrayBuffer())
  await expect(publishHarborlightPanels(w.root, sketchRunId)).rejects.toThrow('Select one completed single-model canonical individual-panel run')
  await w.success(['generate-images', w.script, '--target', 'images', '--provider', 'openai=gpt-image-2.5-flare', '--no-qa', '--max-repairs', '0'], true)
  expect((await w.calls()).filter(url => url.includes('/images/'))).toHaveLength(5)
  const imageRunId = await selectedImageRunId(w.run)
  expect(imageRunId).not.toBe(sketchRunId)
  const imageStates = (await readManifest(w.run))!.items[0]!.providers.filter(provider => provider.operation === 'comic-image')
  expect(imageStates).toHaveLength(1)
  expect(imageStates[0]).toMatchObject({ status: 'succeeded', model: 'gpt-image-2.5-flare', options: { target: 'images', panelsPerImage: 1 }, metadata: { runId: imageRunId } })
  await publishHarborlightPanels(w.root, imageRunId)
  expect(new Uint8Array(await Bun.file(sketchPath).arrayBuffer())).toEqual(sketchBytes)
  await w.success(['review', w.script, '--export-doc'])
  expect(await Bun.file(join(w.run, 'metadata/review/review-sheet.html')).text()).toContain('Papa Bear')
}, 45_000)

test('controlled synthetic dialogue supports decoded local audio and synchronized slideshow with missing/corrupt artifact rejection and reuse', async () => {
  const w = await workspace(process.env['AUTOSHOW_HARBORLIGHT_COMIC_ARTIFACT_ROOT']), { bytes, structured } = await prepareLocalStages(w)
  await Bun.write(w.sceneFile, JSON.stringify(sceneResponse(structured)))
  await w.success(['draft-scenes', w.script, '--only', 'scene', '--panel-count', '4', '--provider', 'openai=gpt-6.1-sol'], true)
  await w.success(['draft-scenes', w.script, '--only', 'panel-prompts'])
  await w.success(['generate-images', w.script, '--target', 'images', '--provider', 'openai=gpt-image-2.5-flare', '--no-qa', '--max-repairs', '0'], true)
  // Test-only approved snapshot: never copied to user fixtures or presented as a reviewed real voice.
  const structuredRef = createStructuredScriptArtifactRef(bytes), sceneRunIdentity = computeSceneRunIdentity(structured.sourceIdentity, structuredRef), createdAt = (await readManifest(w.run))!.createdAt
  const dialogue = createComicDialoguePlan({ structuredScript: structured, sourceIdentity: structured.sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt })
  const base = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialogue.dialoguePlanId, catalogHash: 'a'.repeat(64), briefSetHash: 'b'.repeat(64), createdAt, entries: [buildComicAudioPhase2SnapshotEntry('mira', 'alloy', 'openai'), buildComicAudioPhase2SnapshotEntry('papa-bear', 'onyx', 'openai')] }
  await writeVoiceReferenceManifest(w.run, validateVoiceReferenceManifest({ ...base, snapshotId: hashCanonicalTtsValue(base) }))
  const audioArgs = ['generate-audio', w.script, '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--mode', 'segmented']
  await w.success(audioArgs, true)
  expect((await w.calls()).filter(url => url.endsWith('/audio/speech'))).toHaveLength(4)
  const beforeCalls = await w.calls()
  await w.success([...audioArgs, '--price'])
  await w.success(audioArgs)
  expect(await w.calls()).toEqual(beforeCalls)
  const slide = ['generate-slideshow', w.script, '--audio-target', 'openai=gpt-4o-mini-tts-2025-12-15', '--fps', '24']
  const missing = await w.cli([...slide, '--price'])
  expect(missing.code).not.toBe(0)
  expect(missing.stdout + missing.stderr).toContain('Missing 4 canonical panel')
  const imageRunId = await selectedImageRunId(w.run), candidate = join(w.run, `panels/${imageRunId}/panel-04.png`)
  const candidateBytes = new Uint8Array(await Bun.file(candidate).arrayBuffer())
  await Bun.write(candidate, new Uint8Array([0, 1, 2, 3]))
  await expect(publishHarborlightPanels(w.root, imageRunId)).rejects.toThrow()
  expect(await Bun.file(join(w.run, 'panels/panel-01.png')).exists()).toBe(false)
  await Bun.write(candidate, candidateBytes)
  await publishHarborlightPanels(w.root, imageRunId)
  await expect(publishHarborlightPanels(w.root, imageRunId)).rejects.toThrow('Canonical panel already exists')
  const canonical = join(w.run, 'panels/panel-01.png'), panelBytes = new Uint8Array(await Bun.file(canonical).arrayBuffer())
  await Bun.write(canonical, new Uint8Array([0, 1, 2, 3]))
  const corruptPanel = await w.cli([...slide, '--price'])
  expect(corruptPanel.code).not.toBe(0)
  expect(corruptPanel.stdout + corruptPanel.stderr).toContain('valid PNG')
  await Bun.write(canonical, panelBytes)
  await w.success([...slide, '--price'])
  await w.success(slide)
  const video = join(w.run, 'presentation/final/slideshow.mp4'), audio = join(w.run, 'presentation/final/slideshow.wav')
  expect(Bun.file(video).size).toBeGreaterThan(1000)
  expect(Bun.file(audio).size).toBeGreaterThan(1000)
  const original = new Uint8Array(await Bun.file(video).arrayBuffer())
  await w.success(slide)
  expect(new Uint8Array(await Bun.file(video).arrayBuffer())).toEqual(original)
  const probe = Bun.spawn([getFfprobeBinary(), '-v', 'error', '-show_streams', '-of', 'json', video], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
  const streams = JSON.parse(await new Response(probe.stdout).text()).streams
  expect(await probe.exited).toBe(0)
  expect(streams).toEqual(expect.arrayContaining([expect.objectContaining({ codec_name: 'h264', width: 1536, height: 1024, r_frame_rate: '24/1' }), expect.objectContaining({ codec_name: 'aac', channels: 2 })]))
  const decode = Bun.spawn([getFfmpegBinary(), '-v', 'error', '-xerror', '-err_detect', 'explode', '-i', video, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
  const decodeErrors = await new Response(decode.stderr).text()
  expect({ code: await decode.exited, decodeErrors }).toEqual({ code: 0, decodeErrors: '' })
  const finals = await readdir(join(w.run, 'audio/final'))
  const finalWav = join(w.run, 'audio/final', finals.find(name => name.endsWith('.wav'))!)
  const finalBytes = new Uint8Array(await Bun.file(finalWav).arrayBuffer())
  await Bun.write(finalWav, new Uint8Array([0, 1, 2, 3]))
  const corruptAudio = await w.cli([...slide, '--price'])
  await Bun.write(finalWav, finalBytes)
  expect(corruptAudio.code).not.toBe(0)
  expect(corruptAudio.stdout + corruptAudio.stderr).toContain('artifact-graph')
  await w.success([...slide, '--price'])
  expect(await w.calls()).toEqual(beforeCalls)
}, 60_000)

test('preparation refuses existing workspaces and invalid CLI arguments before writing inputs', async () => {
  const w = await workspace(), original = await Bun.file(w.script).text()
  await expect(prepareHarborlightComic(w.root)).rejects.toThrow()
  expect(await Bun.file(w.script).text()).toBe(original)
  await expect(writeHarborlightBlockingPlan(w.root)).rejects.toThrow()
  const root = `runtime/examples/harborlight-invalid-${crypto.randomUUID()}`
  for (const args of [['--bogus', '--root', root], ['--root'], ['--plan', '--plan', '--root', root], ['--root', root, '--root', root]]) {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/prepare-harborlight-comic.ts', ...args], { env: childEnv({ set: { HOME: w.temporary } }), stdout: 'pipe', stderr: 'pipe' })
    expect(await child.exited).not.toBe(0)
    expect(await new Response(child.stderr).text()).toContain('Usage:')
  }
  expect(await Bun.file(join(root, 'empty-config.json')).exists()).toBe(false)
}, 10_000)

test('only the nine original comic source inputs are Git-eligible while private drawings, scripts and approvals stay ignored', async () => {
  const sources = ['README.md', 'review-notes.md', 'papa-bear.svg', 'papa-bear.png', 'mira.svg', 'mira.png', 'harborlight-camp.svg', 'harborlight-camp.png', '02-script/01-harborlight-camp.md'].map(path => `input/examples/comic/harborlight/${path}`)
  const privatePaths = ['private.png', 'private.svg', '02-script/02-private.md', 'characters/voice-registrations.json', 'audio/private.wav'].map(path => `input/examples/comic/harborlight/${path}`)
  for (const source of sources) expect(await Bun.file(source).exists()).toBe(true)
  const git = Bun.spawn(['git', 'check-ignore', '--no-index', '--stdin'], { env: childEnv(), stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  git.stdin.write([...sources, ...privatePaths].join('\n') + '\n'); git.stdin.end()
  const ignored = (await new Response(git.stdout).text()).trim().split('\n')
  expect(await git.exited).toBe(0)
  expect(ignored).toEqual(privatePaths)
})
