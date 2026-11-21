import { afterEach, expect, test } from 'bun:test'
import { readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { createStructuredScriptArtifactRef } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { writeInitialComicStructureManifest } from '~/cli/commands/visuals/comic/comic-utils/comic-manifest'
import type { StructuredScriptData } from '~/types'
import { publishFirstPanelSelection, readPanelSelections, recordImageRunCandidates } from '~/cli/commands/visuals/comic/comic-utils/panel-selection'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { coerceAndValidateReview } from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import { reviewCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { asCtx, parseRoot } from '../../cli/cli-usage-errors/shared'
import { makeTestPng, readBytes, SELECTION_SCENE_SLUG, sha256Hex, snapshotSelectionState, writeRunCandidate, writeSelectionSceneInputs } from './comic-panel-selection-fixtures'

const roots: string[] = []
afterEach(async () => {
  resetSceneRunContext()
  configureCharactersRoot('input/characters')
  configureOutputRoot('./output')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const invoke = async (args: string[]) => {
  const parsed = parseRoot(['comic', ...args])
  return await captureLogEvents(async () => await parsed.command!.handler(asCtx(parsed)))
}

const fixture = async () => {
  const root = await makeTempDir('autoshow-review-command-')
  roots.push(root)
  const run = join(root, 'run')
  const scriptPath = join(root, `${SELECTION_SCENE_SLUG}.md`)
  await writeSelectionSceneInputs(run, 4, scriptPath)
  beginSceneRun(SELECTION_SCENE_SLUG, { outputDir: run })
  configureCharactersRoot(join(root, 'missing-characters'))
  return { root, run, scriptPath, reviewDir: join(run, 'metadata', 'review') }
}

const publishRun = async (run: string, runId: string, panels: number[], seedBase: number) => {
  const bytes = new Map<number, Buffer>()
  for (const panelNumber of panels) {
    const png = makeTestPng({ seed: seedBase + panelNumber })
    bytes.set(panelNumber, png)
    await publishFirstPanelSelection({ sceneSlug: SELECTION_SCENE_SLUG, runId, service: 'openai', model: 'gpt-image-2.6-flare', panelNumber, candidatePath: await writeRunCandidate(run, runId, panelNumber, png) })
  }
  return bytes
}

test('review parses preview, export and --run/--use/--panels, and rejects retired notes mode and incompatible flags', () => {
  const parse = (args: string[]) => coerceAndValidateReview(parseCommandInvocation(['comic review', ...args], reviewCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
  expect(parse(['script.md'])).toEqual({ showHelp: false, scriptPath: 'script.md' })
  expect(parse(['script.md', '--export-doc'])).toEqual({ showHelp: false, scriptPath: 'script.md', exportDoc: true })
  expect(parse(['script.md', '--run', 'run-b'])).toEqual({ showHelp: false, scriptPath: 'script.md', run: 'run-b' })
  expect(parse(['script.md', '--run', 'run-b', '--export-doc'])).toEqual({ showHelp: false, scriptPath: 'script.md', exportDoc: true, run: 'run-b' })
  expect(parse(['script.md', '--run', 'run-b', '--use'])).toEqual({ showHelp: false, scriptPath: 'script.md', run: 'run-b', use: true })
  expect(parse(['script.md', '--run', 'run-b', '--use', '--panels', '3'])).toEqual({ showHelp: false, scriptPath: 'script.md', run: 'run-b', use: true, panels: [3] })
  expect(() => parse([])).toThrow('Missing required parameter: script-path')
  expect(() => parse([' '])).toThrow('comic review requires <script-path>')
  expect(() => parse(['script.md', '--use'])).toThrow('--use requires --run <image-run-id>')
  expect(() => parse(['script.md', '--run', 'run-b', '--panels', '3'])).toThrow('--panels requires --run <image-run-id> --use')
  expect(() => parse(['script.md', '--run', ' '])).toThrow('--run requires an image run ID')
  expect(() => parse(['script.md', '--notes', 'notes.md'])).toThrow('Unexpected flag: --notes')
  expect(() => parse(['script.md', '--price'])).toThrow('Unexpected flag: --price')
})

test('review writes the sheet without a character catalog, and --export-doc leaves the sheet and selections unchanged', async () => {
  const { run, scriptPath, reviewDir } = await fixture()
  await publishRun(run, 'run-a', [1, 2, 3, 4], 0)
  const selection = await snapshotSelectionState(run)
  const canonical = await invoke(['review', scriptPath])
  const sheet = await Bun.file(join(reviewDir, 'review-sheet.html')).text()
  expect(sheet).toContain('Panel 1')
  expect(sheet).not.toContain('--notes')
  expect(await readdir(reviewDir)).toEqual(['review-sheet.html'])
  expect(canonical.events.some(event => event.message.includes('deprecated'))).toBe(false)
  expect(canonical.events.find(event => event.message === 'Comic review sheet complete')?.metadata).toEqual({ command: 'comic review', price: false, sceneSlug: SELECTION_SCENE_SLUG })
  await invoke(['review', scriptPath, '--export-doc'])
  expect(await Bun.file(join(reviewDir, 'review-sheet.html')).text()).toBe(sheet)
  expect((await readdir(reviewDir)).sort()).toEqual(['export-doc.md', 'review-sheet.html'])
  expect(await snapshotSelectionState(run)).toEqual(selection)
})

test('review --run <id> --use --panels 3 through the CLI adopts only panel 3 and reports the change', async () => {
  const { run, scriptPath } = await fixture()
  const runA = await publishRun(run, 'run-a', [1, 2, 3, 4], 0)
  const runB = await publishRun(run, 'run-b', [3], 50)
  const preview = await snapshotSelectionState(run)
  const previewed = await invoke(['review', scriptPath, '--run', 'run-b', '--export-doc'])
  expect(previewed.events.find(event => event.message === 'Comic review sheet complete')?.metadata).toEqual({ command: 'comic review', price: false, sceneSlug: SELECTION_SCENE_SLUG, run: 'run-b' })
  expect(await snapshotSelectionState(run)).toEqual(preview)

  const used = await invoke(['review', scriptPath, '--run', 'run-b', '--use', '--panels', '3'])
  expect(used.events.find(event => event.message === 'Comic review selection complete')?.metadata).toEqual({ command: 'comic review', price: false, sceneSlug: SELECTION_SCENE_SLUG, run: 'run-b', use: true })
  expect(used.events.some(event => event.message.startsWith('Panel 3 selected from run run-b'))).toBe(true)
  expect(await readBytes(join(run, 'panels', 'panel-03.png'))).toEqual(runB.get(3)!)
  for (const panelNumber of [1, 2, 4]) expect(await readBytes(join(run, 'panels', `panel-0${panelNumber}.png`))).toEqual(runA.get(panelNumber)!)
  expect((await readPanelSelections(SELECTION_SCENE_SLUG)).get(3)).toMatchObject({ runId: 'run-b', origin: 'review-use', sha256: sha256Hex(runB.get(3)!) })

  // A subset run without --panels is rejected through the CLI before any selection changes.
  const adopted = await snapshotSelectionState(run)
  await expect(invoke(['review', scriptPath, '--run', 'run-b', '--use'])).rejects.toThrow('subset run')
  expect(await snapshotSelectionState(run)).toEqual(adopted)
})

test('selection flags without a run fail before creating review artifacts', async () => {
  const { scriptPath, reviewDir } = await fixture()
  await expect(invoke(['review', scriptPath, '--run', 'run-b', '--panels', '3'])).rejects.toThrow('--panels requires --run <image-run-id> --use')
  await expect(invoke(['review', scriptPath, '--use'])).rejects.toThrow('--use requires --run')
  await expect(readdir(reviewDir)).rejects.toThrow()
})

test('review --run reports recorded candidate and page problems in its structured result', async () => {
  const { run, scriptPath, reviewDir } = await fixture()
  await publishRun(run, 'run-a', [1, 2], 0)
  const grid = 'pages/run-a/page-01-panels-01-02.png'
  await recordImageRunCandidates(SELECTION_SCENE_SLUG, {
    runId: 'run-a', service: 'openai', model: 'gpt-image-2.6-flare', panels: [], createdAt: new Date().toISOString(),
    pages: [{ pageNumber: 1, panelNumbers: [1, 2], candidatePath: grid, kind: 'local-grid' }],
  })
  await rm(join(run, 'panels/run-a/panel-01.png'))
  await writeRunCandidate(run, 'run-a', 2, makeTestPng({ seed: 22 }))
  const before = await snapshotSelectionState(run)
  const preview = await invoke(['review', scriptPath, '--run', 'run-a'])
  expect(preview.events.find(event => event.message === 'Comic review sheet complete')?.metadata).toMatchObject({
    candidateIssues: [{ panelNumber: 1, status: 'missing' }, { panelNumber: 2, status: 'changed' }],
    pageIssues: [{ pageNumber: 1, status: 'missing' }],
  })
  const sheet = await Bun.file(join(reviewDir, 'review-sheet.html')).text()
  expect(sheet).toContain('The recorded page file is missing.')
  expect(sheet).not.toContain(grid)
  expect(await snapshotSelectionState(run)).toEqual(before)
})

test('review refuses to adopt into another source workspace, including same-name scripts with identical bytes', async () => {
  const { run, scriptPath } = await fixture()
  const structured = await Bun.file(join(run, 'metadata', 'structured-script.json')).text()
  const { sourceIdentity } = JSON.parse(structured) as StructuredScriptData
  await writeInitialComicStructureManifest({
    sceneRunDir: run, createdAt: '2026-11-20T00:00:00.000Z', sourceIdentity, structuredScript: createStructuredScriptArtifactRef(structured),
  })
  await publishRun(run, 'run-a', [1], 0)
  await publishRun(run, 'run-b', [1], 50)
  const before = await snapshotSelectionState(run)
  const otherScript = join(run, `${SELECTION_SCENE_SLUG}.md`)
  await writeFile(otherScript, await readBytes(scriptPath))
  for (const source of [otherScript, scriptPath]) {
    if (source === scriptPath) await writeFile(scriptPath, 'Changed source bytes')
    await expect(invoke(['review', source, '--run', 'run-b', '--use', '--panels', '1'])).rejects.toThrow('does not belong')
    expect(await snapshotSelectionState(run)).toEqual(before)
  }
})
