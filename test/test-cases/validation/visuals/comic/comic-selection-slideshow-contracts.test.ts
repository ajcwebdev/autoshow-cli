import { afterEach, expect, test } from 'bun:test'
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CanonicalComicItemMetadata, ComicPanelSelectionTransaction, CompactPresentation } from '~/types'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { createSoundscapePlan } from '~/cli/commands/audio/tts/soundscape/soundscape-planner'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { generateComicSlideshow } from '~/cli/commands/visuals/comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { reviewSheetCommand } from '~/cli/commands/visuals/comic/comic-commands/review/review-sheet-command'
import { auditComicSceneArtifactLineage } from '~/cli/commands/visuals/comic/comic-utils/comic-artifact-lineage-audit'
import { computeSceneRunIdentity, createComicSourceIdentity, createStructuredScriptArtifactRef } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan, writeComicDialoguePlan } from '~/cli/commands/visuals/comic/comic-utils/comic-dialogue-plan'
import { updateComicAudioManifest, writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import { createLocalSilentDialogueRun } from '~/cli/commands/visuals/comic/comic-utils/comic-soundscape-workflow'
import { publishFirstPanelSelection, recordImageRunCandidates } from '~/cli/commands/visuals/comic/comic-utils/panel-selection'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { generateSlideshowCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'
import { buildSelectionScene, buildSelectionStructuredScript, makeTestPng, SELECTION_SCENE_SLUG as slug, sha256Hex, writeRunCandidate } from './comic-panel-selection-fixtures'

const dirs = createTempDirTracker('autoshow-selection-slideshow-')
afterEach(async () => {
  resetPinnedRunDir()
  resetSceneRunContext()
  await dirs.cleanup()
})

const fixture = async () => {
  const root = await dirs.make()
  const sceneRunDir = join(root, 'workspace')
  const scriptPath = join(root, `${slug}.md`)
  configurePinnedRunDir(sceneRunDir)
  beginSceneRun(slug)
  await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
  const createdAt = '2026-11-20T00:00:00.000Z'
  const structuredScript = buildSelectionStructuredScript(1)
  const segment = structuredScript.sourceSegments[0]!
  await writeFile(scriptPath, segment.text)
  segment.sourceSpans = [{ kind: 'stage-direction', start: 0, end: segment.text.length, indexUnit: 'unicode-scalar-value', text: segment.text }]
  const sourceIdentity = await createComicSourceIdentity(scriptPath, segment.text)
  structuredScript.sourceIdentity = sourceIdentity
  structuredScript.sourceFile = sourceIdentity.canonicalPath
  const bytes = canonicalTtsJson(structuredScript)
  const structuredScriptRef = createStructuredScriptArtifactRef(bytes)
  await writeFile(join(sceneRunDir, structuredScriptRef.path), bytes)
  await writeFile(join(sceneRunDir, 'metadata/scene.json'), JSON.stringify(buildSelectionScene(1)))
  await writeInitialComicStructureManifest({ sceneRunDir, createdAt, sourceIdentity, structuredScript: structuredScriptRef })

  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredScriptRef)
  const inputs = { structuredScript, sourceIdentity, structuredScriptRef, sceneRunIdentity, createdAt }
  const dialoguePlan = createComicDialoguePlan(inputs)
  const dialoguePlanRef = await writeComicDialoguePlan(sceneRunDir, dialoguePlan)
  const silent = await createLocalSilentDialogueRun({ rootDir: sceneRunDir, plan: createSoundscapePlan({ ...inputs, dialoguePlan }) })
  const { reportedOutputPath: _reportedOutputPath, ...binding } = silent.binding
  await updateComicAudioManifest({
    sceneRunDir, sourceIdentity,
    audio: { sceneRunIdentity, structuredScript: structuredScriptRef, dialoguePlanId: dialoguePlan.dialoguePlanId, dialoguePlanRef, selectedAudioRuns: [binding] },
    stage: { requirement: 'required', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: silent.refs },
  })

  const publish = async (runId: string, seed: number) => {
    const png = makeTestPng({ width: 64, height: 64, seed })
    const candidatePath = await writeRunCandidate(sceneRunDir, runId, 1, png)
    await publishFirstPanelSelection({ sceneSlug: slug, runId, service: 'openai', model: 'gpt-image-2.6-flare', panelNumber: 1, candidatePath })
    return sha256Hex(png)
  }
  const command = generateSlideshowCommandDefinition
  const parsed = parseCommandInvocation([command.name, scriptPath, '--untimed-panel-ms', '200'], command, GLOBAL_FLAG_DEFINITIONS)
  const render = () => generateComicSlideshow({ ...parsed, command, store: {} }, scriptPath)
  const adopt = (run: string) => reviewSheetCommand({ sceneSlug: slug, scriptPath, run, use: true })
  const metadata = async () => (await readManifest(sceneRunDir))!.items[0]!.metadata['comic'] as unknown as CanonicalComicItemMetadata
  const archive = async () => await Bun.file(join(sceneRunDir, 'presentation/presentation.json')).json() as CompactPresentation
  return { root, sceneRunDir, publish, render, adopt, metadata, archive, createdAt }
}

test('review adoption invalidates a rendered slideshow on changed panel bytes and the next render binds the new art', async () => {
  const f = await fixture()
  const firstSha = await f.publish('first', 1)
  await f.publish('same', 1)
  const nextSha = await f.publish('replacement', 2)
  await f.render()
  const previous = await f.metadata()
  const originalRender = await f.archive()
  expect(originalRender.plan.inputs.panels[0]).toMatchObject({ path: 'panels/panel-01.png', sha256: firstSha })

  await f.adopt('same')
  await f.adopt('same')
  expect((await f.metadata()).presentation).toEqual(previous.presentation)
  expect((await f.metadata()).stages.presentation).toEqual(previous.stages.presentation)

  await f.adopt('replacement')
  const changed = await f.metadata()
  expect(changed.presentation).toEqual({})
  expect(changed.stages.presentation).toMatchObject({ status: 'incomplete', execution: { kind: 'local', state: 'missing' }, artifactRefs: [] })
  expect(changed.audio).toEqual(previous.audio)
  expect(changed.stages.audio).toEqual(previous.stages.audio)
  expect(await f.archive()).toEqual(originalRender)
  const video = Bun.file(join(f.sceneRunDir, originalRender.outputs.mp4.path))
  expect(sha256Hex(await video.bytes())).toBe(originalRender.outputs.mp4.sha256)
  expect((await auditComicSceneArtifactLineage(f.sceneRunDir)).errors).toEqual([])

  await f.render()
  const rendered = await f.archive()
  expect(rendered.presentationId).not.toBe(originalRender.presentationId)
  expect(rendered.plan.inputs.panels[0]?.sha256).toBe(nextSha)
  expect(rendered.outputs.mp4.sha256).not.toBe(originalRender.outputs.mp4.sha256)
  expect((await f.metadata()).presentation.selectedPresentationId).toBe(rendered.presentationId)
  expect((await f.metadata()).stages.presentation.status).toBe('full')
  expect((await auditComicSceneArtifactLineage(f.sceneRunDir)).errors).toEqual([])
}, 30_000)

test('changing local selections keeps a slideshow bound to imported copies from a sibling scene', async () => {
  const f = await fixture()
  await f.publish('first', 1)
  const sibling = join(f.root, slug)
  await mkdir(join(sibling, 'metadata'), { recursive: true })
  await mkdir(join(sibling, 'panels'))
  await copyFile(join(f.sceneRunDir, 'metadata/scene.json'), join(sibling, 'metadata/scene.json'))
  await rename(join(f.sceneRunDir, 'panels/panel-01.png'), join(sibling, 'panels/panel-01.png'))
  await f.render()
  const previous = await f.metadata()
  expect((await f.archive()).plan.inputs.panels[0]?.path).toContain('presentation/inputs/')
  await f.publish('local', 2)
  await f.publish('replacement', 3)
  await f.adopt('replacement')
  expect((await f.metadata()).presentation).toEqual(previous.presentation)
  expect((await f.metadata()).stages.presentation).toEqual(previous.stages.presentation)
  expect((await auditComicSceneArtifactLineage(f.sceneRunDir)).errors).toEqual([])
}, 30_000)

test('rollback after the manifest committed restores the rendered slideshow with its previous panel', async () => {
  const f = await fixture()
  const previousSha256 = await f.publish('first', 1)
  const nextSha256 = await f.publish('replacement', 2)
  await f.render()
  const previous = await f.metadata()
  const storeBefore = await Bun.file(join(f.sceneRunDir, 'metadata/panel-selections.json')).text()
  await f.adopt('replacement')
  expect((await f.metadata()).presentation).toEqual({})

  // Simulate interruption after the manifest update, just before deleting the adoption journal.
  const journal: ComicPanelSelectionTransaction = {
    schemaVersion: 2, startedAt: f.createdAt, storeBefore, refsBefore: [],
    changes: [{ panelNumber: 1, canonicalPath: 'panels/panel-01.png', previousSha256, nextSha256, preservedPath: `metadata/panel-selection-history/panel-01-${previousSha256}.png` }],
    presentationBefore: { stage: previous.stages.presentation, presentation: previous.presentation, audioHash: hashCanonicalTtsValue(previous.audio) },
  }
  await writeFile(join(f.sceneRunDir, 'metadata/panel-selection-transaction.json'), JSON.stringify(journal))
  await recordImageRunCandidates(slug, { runId: 'first', service: 'openai', model: 'gpt-image-2.6-flare', panels: [], createdAt: f.createdAt })
  expect(sha256Hex(await Bun.file(join(f.sceneRunDir, 'panels/panel-01.png')).bytes())).toBe(previousSha256)
  expect((await f.metadata()).presentation).toEqual(previous.presentation)
  expect((await f.metadata()).stages.presentation).toEqual(previous.stages.presentation)
  expect((await auditComicSceneArtifactLineage(f.sceneRunDir)).errors).toEqual([])
}, 30_000)
