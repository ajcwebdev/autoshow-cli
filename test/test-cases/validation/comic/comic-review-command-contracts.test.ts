import { afterEach, expect, test } from 'bun:test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { coerceAndValidateReview } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { reviewCommandDefinition, reviewNotesCommandDefinition, reviewSheetCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { asCtx, parseRoot } from '../cli/cli-usage-errors/shared'
import { BLOCKING_FIXTURE_SCENE_SLUG, buildBlockingFixtureScene, buildBlockingFixtureStructuredScript, writeBlockingFixtureInputRoot } from './fixtures/blocking/blocking-plan-fixture'

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
  await mkdir(join(run, 'metadata'), { recursive: true })
  const scriptPath = join(root, `${BLOCKING_FIXTURE_SCENE_SLUG}.md`)
  const script = buildBlockingFixtureStructuredScript()
  await writeFile(scriptPath, script.sourceSegments.map(segment => segment.text).join('\n\n'))
  await writeFile(join(run, 'metadata', 'structured-script.json'), JSON.stringify(script))
  await writeFile(join(run, 'metadata', 'scene.json'), JSON.stringify(buildBlockingFixtureScene()))
  beginSceneRun(BLOCKING_FIXTURE_SCENE_SLUG, { outputDir: run })
  configureCharactersRoot(join(root, 'missing-characters'))
  return { root, run, scriptPath, reviewDir: join(run, 'metadata', 'review') }
}

test('review parses both modes and rejects blank notes, missing input, and incompatible flags', () => {
  const parse = (args: string[]) => coerceAndValidateReview(parseCommandInvocation(['comic review', ...args], reviewCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
  expect(parse(['script.md'])).toEqual({ showHelp: false, scriptPath: 'script.md' })
  expect(parse(['script.md', '--export-doc'])).toEqual({ showHelp: false, scriptPath: 'script.md', exportDoc: true })
  expect(parse(['script.md', '--notes', 'notes.md'])).toEqual({ showHelp: false, scriptPath: 'script.md', notes: 'notes.md' })
  expect(() => parse([])).toThrow('Missing required parameter: script-path')
  expect(() => parse([' ', '--notes', 'notes.md'])).toThrow('comic review requires <script-path>')
  expect(() => parse(['script.md', '--notes', ' '])).toThrow('comic review requires --notes <path>')
  expect(() => parse(['script.md', '--notes', 'notes.md', '--export-doc'])).toThrow('cannot be combined')
  expect(() => parse(['script.md', '--price'])).toThrow('Unexpected flag: --price')
  expect(() => parseCommandInvocation(['comic review-sheet', 'script.md', '--notes', 'notes.md'], reviewSheetCommandDefinition, GLOBAL_FLAG_DEFINITIONS)).toThrow('Unexpected flag: --notes')
  expect(() => parseCommandInvocation(['comic review-notes', 'script.md', '--export-doc'], reviewNotesCommandDefinition, GLOBAL_FLAG_DEFINITIONS)).toThrow('Unexpected flag: --export-doc')
})

test('review writes the sheet without a character catalog and preserves the deprecated sheet output', async () => {
  const { scriptPath, reviewDir } = await fixture()
  const canonical = await invoke(['review', scriptPath])
  const sheet = await Bun.file(join(reviewDir, 'review-sheet.html')).text()
  expect(sheet).toContain('Panel 1')
  expect(sheet).toContain('comic review &lt;script-path&gt; --notes &lt;path&gt;')
  expect(await readdir(reviewDir)).toEqual(['review-sheet.html'])
  expect(canonical.events.some(event => event.message.includes('deprecated'))).toBe(false)
  expect(canonical.events.find(event => event.message === 'Comic review sheet complete')?.metadata).toEqual({ command: 'comic review', price: false, sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG })
  const legacy = await invoke(['review-sheet', scriptPath, '--export-doc'])
  expect(await Bun.file(join(reviewDir, 'review-sheet.html')).text()).toBe(sheet)
  expect(await Bun.file(join(reviewDir, 'export-doc.md')).exists()).toBe(true)
  expect(legacy.events.some(event => event.message.includes('review-sheet is deprecated'))).toBe(true)
  expect(legacy.events.find(event => event.message === 'Comic review sheet complete')?.metadata).toEqual({ command: 'comic review-sheet', price: false, sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG })
  await invoke(['review', scriptPath, '--export-doc'])
  expect(await Bun.file(join(reviewDir, 'review-sheet.html')).text()).toBe(sheet)
})

test('notes mode requires its catalog, preserves source artifacts, and never regenerates the sheet', async () => {
  const { root, run, scriptPath, reviewDir } = await fixture()
  const notesPath = join(root, 'notes.md')
  await writeFile(notesPath, '### Panel 1\n\nUse a closer camera framing.\n\n### Panel 99\n\nMove the camera.\n')
  const sourceFiles = [scriptPath, join(run, 'metadata', 'scene.json'), join(run, 'metadata', 'structured-script.json')]
  const before = await Promise.all(sourceFiles.map(path => Bun.file(path).text()))
  await expect(invoke(['review', scriptPath, '--notes', notesPath])).rejects.toThrow('characters-reference.json')
  const { charactersRoot } = await writeBlockingFixtureInputRoot(join(root, 'input'))
  configureCharactersRoot(charactersRoot)
  const canonical = await invoke(['review', scriptPath, '--notes', notesPath])
  expect(canonical.events.find(event => event.message === 'Comic review notes complete')?.metadata).toEqual({ command: 'comic review', price: false, sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG })
  const reports = await readdir(reviewDir)
  expect(reports).toHaveLength(1)
  expect(reports[0]).toMatch(/^review-notes-.+\.md$/)
  const report = await Bun.file(join(reviewDir, reports[0]!)).text()
  expect(report).toContain('**CAMERA:**')
  expect(report).toContain('Unmatched notes')
  expect(await Promise.all(sourceFiles.map(path => Bun.file(path).text()))).toEqual(before)
  const legacy = await invoke(['review-notes', scriptPath, '--notes', notesPath])
  expect(legacy.events.some(event => event.message.includes('review-notes is deprecated'))).toBe(true)
  expect(legacy.events.find(event => event.message === 'Comic review notes complete')?.metadata).toEqual({ command: 'comic review-notes', price: false, sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG })
  expect(await Bun.file(join(reviewDir, 'review-sheet.html')).exists()).toBe(false)
})

test('mixed review modes fail before creating review artifacts or loading a catalog', async () => {
  const { scriptPath, reviewDir } = await fixture()
  await expect(invoke(['review', scriptPath, '--notes', 'missing.md', '--export-doc'])).rejects.toThrow('cannot be combined')
  expect(await Bun.file(join(reviewDir, 'review-sheet.html')).exists()).toBe(false)
  await expect(readdir(reviewDir)).rejects.toThrow()
})
