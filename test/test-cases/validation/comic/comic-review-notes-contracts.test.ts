import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { classifyReviewNote, parseReviewNotesMarkdown, reviewNotesCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/review/review-notes-command'
import { getReviewNotesPath } from '~/cli/commands/process-steps/step-8-comic/comic-commands/review/review-paths'
import { coerceAndValidateReviewNotes } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { buildStructuredStaging, locateStagingDirectives } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/staging-directives'
import { reviewNotesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import type { ExpandedScriptBlock } from '~/types'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { BLOCKING_FIXTURE_SCENE_SLUG, buildBlockingFixtureScene, buildBlockingFixtureStructuredScript, createBlockingFixtureCatalogStub } from './fixtures/blocking/blocking-plan-fixture'

const temporaryDirectories: string[] = []
const script = buildBlockingFixtureStructuredScript()

const SCRIPT_MARKDOWN = [
  '# Episode 2',
  '',
  '## SCENE 1: "Mandatory Meeting"',
  '',
  '**INT. CARGO BAY - MORNING**',
  '',
  'The crew gathers in the cargo bay. Peaches stands at the centered far main hatch with Seamus beside her. Gulp, Geebee, Duco, Paddy, Chat, Bishop, and the Ironhands wait among the crates while deck crew mill about the right catwalk.',
  '',
  '**PEACHES**',
  '',
  'Mandatory meeting. Nobody leaves.',
  '',
].join('\n')

const NOTES_MARKDOWN = [
  '# Episode 2 review notes',
  '',
  '### Panel 1',
  '',
  'Gulp is standing on the wrong side of the crates; he should be at his mark left of the grav lift.',
  '',
  '### Panel 2',
  '',
  'The camera crossed the line here: Peaches jumps from screen-left to screen-right between panels.',
  '',
  '### Panel 3',
  '',
  'Pull the framing in to a tighter medium shot; the wide angle wastes the foreground.',
  '',
  '### Panel 4',
  '',
  'Duco is wearing the wrong coverall in this panel.',
  '',
  '### Panel 5',
  '',
  'Too few extras in the crowd behind the desk.',
  '',
  '### Panel 9',
  '',
  'This panel does not exist in the reviewed scene.',
  '',
  '### Panel 6',
  '',
].join('\n')

afterEach(async () => {
  resetSceneRunContext()
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const prepare = async () => {
  const workspace = await makeTempDir('autoshow-review-notes-')
  temporaryDirectories.push(workspace)
  const slug = BLOCKING_FIXTURE_SCENE_SLUG
  beginSceneRun(slug, { outputDir: workspace })
  await mkdir(join(workspace, 'metadata'), { recursive: true })
  await writeFile(getStructuredScriptPath(slug), `${JSON.stringify(script, null, 2)}\n`)
  await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene(), null, 2))
  const scriptPath = join(workspace, '01-mandatory-meeting.md')
  await writeFile(scriptPath, SCRIPT_MARKDOWN)
  const notesPath = join(workspace, 'review-notes.md')
  await writeFile(notesPath, NOTES_MARKDOWN)
  return { slug, workspace, scriptPath, notesPath }
}

const run = async (input: { slug: string; scriptPath: string; notesPath: string }) =>
  await captureLogEvents(async () => await reviewNotesCommand(
    { scriptPath: input.scriptPath, sceneSlug: input.slug, notesPath: input.notesPath },
    { runId: () => 'review-run', catalog: createBlockingFixtureCatalogStub() },
  ))

describe('review-notes parsing and classification', () => {
  test('reads every "### Panel NN" section and drops empty ones', () => {
    const notes = parseReviewNotesMarkdown(NOTES_MARKDOWN)
    expect(notes.map(note => note.panelNumber)).toEqual([1, 2, 3, 4, 5, 9])
    expect(notes[0]!.text).toStartWith('Gulp is standing on the wrong side')
    expect(notes[0]!.lineIndex).toBe(2)
    expect(parseReviewNotesMarkdown('### Panel 07\n\nZero-padded heading.\n')[0]).toMatchObject({ panelNumber: 7, text: 'Zero-padded heading.' })
    expect(() => parseReviewNotesMarkdown('# Notes\n\nNo panel headings here.\n')).toThrow('no "### Panel NN" sections')
  })

  test('classifies each note by the documented keyword table in priority order', () => {
    expect(classifyReviewNote('Peaches crossed the line between panels.')).toMatchObject({ kind: 'axis-break' })
    expect(classifyReviewNote('Duco is wearing the wrong coverall.')).toMatchObject({ kind: 'costume' })
    expect(classifyReviewNote('Too few extras in the crowd.')).toMatchObject({ kind: 'extras' })
    expect(classifyReviewNote('Pull the framing in to a tighter medium shot.')).toMatchObject({ kind: 'camera' })
    expect(classifyReviewNote('Gulp should be left of the grav lift.')).toEqual({ kind: 'blocking', matches: [] })
    expect(classifyReviewNote('The wide shot flipped sides on the axis.').kind).toBe('axis-break')
    expect(classifyReviewNote('The crowd wears the wrong uniform.').kind).toBe('costume')
    expect(classifyReviewNote('Duco is wearing the wrong coverall.').matches).toEqual(['wearing', 'coverall'])
  })
})

describe('review-notes command', () => {
  test('maps notes onto reviewed panels, classifies them, and writes paste-ready directives without a provider call', async () => {
    const prepared = await prepare()
    const { result, events } = await run(prepared)

    expect(result.outputPath).toBe(getReviewNotesPath(prepared.slug, 'review-run'))
    expect(result.panelCount).toBe(6)
    expect(result.directives.map(item => [item.target.panelNumber, item.kind])).toEqual([
      [1, 'blocking'],
      [2, 'axis-break'],
      [3, 'camera'],
      [4, 'costume'],
      [5, 'extras'],
    ])
    expect(result.countsByKind).toEqual({ blocking: 1, camera: 1, 'axis-break': 1, costume: 1, extras: 1 })
    expect(result.unmatched).toHaveLength(1)
    expect(result.unmatched[0]!.reason).toBe('metadata/scene.json has no panel 9')

    const [blocking, axis, camera, costume, extras] = result.directives
    expect(blocking!.directive).toBe('**BLOCKING:** {state: <state-id>, location: cargo-bay} Gulp is standing on the wrong side of the crates; he should be at his mark left of the grav lift.')
    expect(blocking!.placeholders).toEqual(['<state-id>'])
    expect(axis!.directive).toStartWith('**BREAK-180:** {panel: 2} The camera crossed the line here')
    expect(camera!.directive).toStartWith('**CAMERA:** {panel: 3} Pull the framing in')
    expect(costume!.directive).toStartWith('**COSTUME:** {character: duco} Duco is wearing')
    expect(extras!.directive).toStartWith('**EXTRAS:** {group: <ensemble-key>} Too few extras')
    expect(extras!.placeholders).toEqual(['<ensemble-key>'])

    expect(blocking!.target).toMatchObject({ segmentId: 'beat-0001', beatIndex: 1, beatType: 'direction', scriptLine: 7 })
    expect(axis!.target).toMatchObject({ segmentId: 'beat-0002', beatIndex: 2, speakerLabel: 'PEACHES', scriptLine: 11 })
    expect(costume!.target.segmentId).toBe('beat-0004')
    expect(costume!.target.scriptLine).toBeNull()

    for (const item of result.directives) expect(events.some(event => event.message === item.directive)).toBe(true)
    expect(events.some(event => typeof event.message === 'string' && event.message.startsWith('review-notes generated file=review-notes-review-run.md notes=6 directives=5 unmatched=1'))).toBe(true)
  })

  test('writes a report with the target beat, script line, summary table, and unmatched notes', async () => {
    const prepared = await prepare()
    const { result } = await run(prepared)
    const report = await Bun.file(result.outputPath).text()

    expect(report).toContain('| Panel | Kind | Target beat | Script line | Placeholders |')
    expect(report).toContain('| 1 | blocking | beat-0001 | 7 | <state-id> |')
    expect(report).toContain('| 4 | costume | beat-0004 | unresolved | none |')
    expect(report).toContain('Counts by kind: blocking=1, camera=1, axis-break=1, costume=1, extras=1.')
    expect(report).toContain('## Unmatched notes')
    expect(report).toContain('- Panel 9 (notes line 23): metadata/scene.json has no panel 9')
    expect(report).toContain('### Panel 2 (axis-break)')
    expect(report).toContain('- Classified as axis-break by: crossed the line')
    expect(report).toContain('- Classified as blocking by default; no keyword matched')
    expect(report).toContain('- Fill in before pasting: <ensemble-key>')
    expect(report).toContain('```markdown\n**BLOCKING:** {state: <state-id>, location: cargo-bay} Gulp is standing')
    expect(report.split('\n').every(line => line.length === 0 || !line.startsWith(' '))).toBe(true)
  })

  test('emits directives the structured-script parser accepts once the placeholders are filled in', async () => {
    const prepared = await prepare()
    const { result } = await run(prepared)
    const filled = result.directives.map(item => item.directive
      .replace('<state-id>', 'meeting-open')
      .replace('<ensemble-key>', 'deck-crew'))
    const source = [SCRIPT_MARKDOWN, ...filled].join('\n\n')
    const blocks: ExpandedScriptBlock[] = filled.map(text => ({ text }))
    expect(locateStagingDirectives(source, blocks).map(directive => directive.kind)).toEqual(['blocking', 'axis-break', 'camera', 'costume', 'extras'])
    const staging = buildStructuredStaging({ exactSource: source, expandedBlocks: blocks, sourceSegments: script.sourceSegments, sceneLocationKey: 'cargo-bay' })!
    expect(staging.blocking[0]).toMatchObject({ state: 'meeting-open', location: 'cargo-bay' })
    expect(staging.axisBreaks[0]).toMatchObject({ panel: 2 })
    expect(staging.camera[0]).toMatchObject({ panel: 3 })
    expect(staging.costume[0]).toMatchObject({ character: 'duco' })
    expect(staging.extras[0]).toMatchObject({ group: 'deck-crew', count: null })
  })

  test('rejects a missing notes file and a scene without reviewed panels', async () => {
    const prepared = await prepare()
    await captureLogEvents(async () => {
      await expect(reviewNotesCommand({ scriptPath: prepared.scriptPath, sceneSlug: prepared.slug, notesPath: join(prepared.workspace, 'absent.md') }))
        .rejects.toThrow('Review notes file not found')
    })
    await rm(getSceneJsonPath(prepared.slug))
    await captureLogEvents(async () => {
      await expect(reviewNotesCommand({ scriptPath: prepared.scriptPath, sceneSlug: prepared.slug, notesPath: prepared.notesPath }))
        .rejects.toThrow('Scene JSON not found at')
    })
  })
})

describe('review-notes command registration', () => {
  test('registers as a comic subcommand with a script parameter and --notes', () => {
    expect(reviewNotesCommandDefinition.name).toBe('comic review-notes')
    expect(Object.keys(reviewNotesCommandDefinition.flags ?? {})).toEqual(['notes'])
    const parsed = coerceAndValidateReviewNotes(parseCommandInvocation(['comic review-notes', '02-01', '--notes', 'review/pass-2.md'], reviewNotesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    expect(parsed).toEqual({ showHelp: false, scriptPath: '02-01', notes: 'review/pass-2.md' })
    expect(() => coerceAndValidateReviewNotes(parseCommandInvocation(['comic review-notes', '02-01'], reviewNotesCommandDefinition, GLOBAL_FLAG_DEFINITIONS)))
      .toThrow('comic review-notes requires --notes <path> pointing at a Markdown file with ### Panel NN headings')
    expect(() => parseCommandInvocation(['comic review-notes'], reviewNotesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
      .toThrow('Missing required parameter: script-path')
    const blank = parseCommandInvocation(['comic review-notes', '02-01', '--notes', 'n.md'], reviewNotesCommandDefinition, GLOBAL_FLAG_DEFINITIONS)
    expect(() => coerceAndValidateReviewNotes({ ...blank, parameters: { ...blank.parameters, 'script-path': '  ' } }))
      .toThrow('comic review-notes requires <script-path>.')
  })
})
