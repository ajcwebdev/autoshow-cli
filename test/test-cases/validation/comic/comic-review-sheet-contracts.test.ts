import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { reviewSheetCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/review/review-sheet-command'
import { reconcileFromDirectives } from '~/cli/commands/process-steps/step-8-comic/comic-commands/review/review-reconcile'
import { getReviewExportDocPath, getReviewSheetPath } from '~/cli/commands/process-steps/step-8-comic/comic-commands/review/review-paths'
import { captureBloopers, categorizeBlooper } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blooper-ledger'
import { getBlockingPanelSvgPath, getBlockingPlanPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-paths'
import { getPanelComicImagePath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-utils'
import { getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { coerceAndValidateDraftScenes, coerceAndValidateReviewSheet } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { draftScenesCommandDefinition, reviewSheetCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import type { BlooperRecord, PageQaEntry, StructuredScriptData } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { BLOCKING_FIXTURE_SCENE_SLUG, buildBlockingFixturePlan, buildBlockingFixtureScene, buildBlockingFixtureStructuredScript } from './fixtures/blocking/blocking-plan-fixture'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

afterEach(async () => {
  resetSceneRunContext()
  configureOutputRoot('./output')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const prepare = async (options: { withBlocking?: boolean; withBoard?: boolean; withImage?: boolean; staging?: StructuredScriptData['staging'] } = {}) => {
  const workspace = await makeTempDir('autoshow-review-sheet-')
  temporaryDirectories.push(workspace)
  const slug = BLOCKING_FIXTURE_SCENE_SLUG
  beginSceneRun(slug, { outputDir: workspace })
  await mkdir(join(workspace, 'metadata'), { recursive: true })
  const structuredScript = { ...buildBlockingFixtureStructuredScript(), ...(options.staging ? { staging: options.staging } : {}) }
  await writeFile(getStructuredScriptPath(slug), `${JSON.stringify(structuredScript, null, 2)}\n`)
  await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene({ withBlocking: options.withBlocking === true }), null, 2))
  if (options.withBoard) {
    const svgPath = getBlockingPanelSvgPath(slug, 1)
    await mkdir(dirname(svgPath), { recursive: true })
    await writeFile(svgPath, '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>panel 1 stage board</title></svg>\n')
  }
  if (options.withImage) {
    const imagePath = getPanelComicImagePath(slug, 1)
    await mkdir(dirname(imagePath), { recursive: true })
    await writeFile(imagePath, tinyPng)
  }
  return { slug, workspace, structuredScript }
}

const emptyStaging = (): NonNullable<StructuredScriptData['staging']> => ({ blocking: [], camera: [], axisBreaks: [], costume: [], extras: [], skipPanels: null })

describe('comic review-sheet', () => {
  test('renders one section per panel with the contract, source segments, stage board, and image', async () => {
    const { slug } = await prepare({ withBoard: true, withImage: true })
    const result = await reviewSheetCommand({ scriptPath: 'input/scripts/02-script/01-mandatory-meeting.md', sceneSlug: slug })
    expect(result.outputPath).toBe(getReviewSheetPath(slug))
    expect(result.exportDocPath).toBeNull()
    const html = await Bun.file(result.outputPath).text()
    for (const panelNumber of [1, 2, 3, 4, 5, 6]) expect(html).toContain(`<h2>Panel ${panelNumber}</h2>`)
    expect(html).toContain('<strong>Description:</strong> Panel 1 staging.')
    expect(html).toContain('<strong>Shot plan:</strong> Panel 1 shot plan using camera wide-from-airlock.')
    expect(html).toContain('<code>beat-0001</code> The crew gathers in the cargo bay.')
    expect(html).toContain('<title>panel 1 stage board</title>')
    expect(html).not.toContain('<?xml')
    expect(html).toContain('<img src="../../panels/panel-01.png"')
    expect(html).toContain('No stage board: this scene has no blocking plan.')
    expect(html).toContain('QA evidence not retained.')
    expect(html).toContain('<textarea class="notes" data-panel="1"')
    expect(html).not.toMatch(/src="https?:\/\//u)
    expect(html).not.toContain('<link ')
    expect(html).not.toContain('cdn')
  })

  test('reports retained QA evidence including the blocking-class restart route', async () => {
    const { slug } = await prepare()
    const entry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: true,
      repairPolicy: { action: 'restart', reason: 'blocking-class', repeatedHardFailures: ['panel-1:blockingAudit'] },
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: false, axisSideMatch: false, blockingAudit: [{ subject: 'gulp', status: 'side-swapped', note: 'Gulp is screen-right.' }], dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Blocking failure.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    const result = await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: slug }, { pageQaEntries: [entry] })
    const html = await Bun.file(result.outputPath).text()
    expect(html).toContain('<strong>Repair route:</strong> restart (blocking-class)')
    expect(html).toContain('panel-1:blockingAudit, panel-1:axisSideMatch')
    expect(html).toContain('<strong>Lineage:</strong> restarted from canonical references')
  })

  test('--export-doc writes one heading and image line per panel with a blank paragraph after each image', async () => {
    const { slug } = await prepare({ withImage: true })
    const result = await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: slug, exportDoc: true })
    expect(result.exportDocPath).toBe(getReviewExportDocPath(slug))
    const markdown = await Bun.file(result.exportDocPath!).text()
    const headings = [...markdown.matchAll(/^### Panel (\d+)$/gmu)].map(match => Number(match[1]))
    expect(headings).toEqual([1, 2, 3, 4, 5, 6])
    expect(markdown).toContain('![Panel 1](../../panels/panel-01.png)\n\n\n')
    expect(markdown).toContain('_No canonical panel image is promoted for panel 2._\n\n\n')
  })

  test('registers review-sheet as a comic subcommand with its one export flag', () => {
    expect(reviewSheetCommandDefinition.name).toBe('comic review-sheet')
    const parse = (args: string[]) => coerceAndValidateReviewSheet(parseCommandInvocation(['comic review-sheet', ...args], reviewSheetCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    expect(parse(['02-01']).exportDoc).toBeUndefined()
    expect(parse(['02-01', '--export-doc']).exportDoc).toBe(true)
    expect(() => parseCommandInvocation(['comic review-sheet'], reviewSheetCommandDefinition, GLOBAL_FLAG_DEFINITIONS)).toThrow()
  })
})

describe('draft-scenes --reconcile-from-directives', () => {
  test('applies every directive kind without a provider call and logs the changes', async () => {
    const staging = emptyStaging()
    staging.camera.push({ lineIndex: 10, afterSegmentId: 'beat-0001', panel: 1, text: 'Use reverse-from-hatch for this beat.' })
    staging.camera.push({ lineIndex: 11, afterSegmentId: 'beat-0002', panel: 2, text: 'Push in tighter on the crates.' })
    staging.axisBreaks.push({ lineIndex: 12, afterSegmentId: 'beat-0003', panel: 3, text: 'Peaches turns and the reverse is deliberate.' })
    staging.costume.push({ lineIndex: 13, afterSegmentId: 'beat-0004', character: 'duco', text: 'Duco is in the cut-down loincloth from here on.' })
    staging.extras.push({ lineIndex: 14, afterSegmentId: 'beat-0001', group: 'deck-crew', count: 14, exclude: ['children'], text: 'blank picket signs' })
    const { slug, structuredScript } = await prepare({ withBlocking: true, staging })
    const plan = buildBlockingFixturePlan()
    await writeFile(getBlockingPlanPath(slug), `${JSON.stringify(plan, null, 2)}\n`)

    const result = await reconcileFromDirectives({ sceneSlug: slug }, { runId: () => 'reconcile-run', structuredScript })
    expect(result.sceneChanged).toBe(true)
    expect(result.planChanged).toBe(true)
    expect(result.changes.map(change => change.kind)).toEqual(['camera', 'camera', 'axis-break', 'costume', 'extras'])
    expect(result.changes[0]).toMatchObject({ kind: 'camera', panelNumber: 1, target: 'panels[1].blocking.cameraSetupId', before: 'wide-from-airlock', after: 'reverse-from-hatch' })
    expect(result.changes[1]?.target).toBe('panels[2].shotPlan')
    expect(result.changes[1]?.after).toContain('Reviewer camera note: Push in tighter on the crates.')
    expect(result.changes[2]).toMatchObject({ kind: 'axis-break', panelNumber: 3, before: 'null', after: 'beat-0003: Peaches turns and the reverse is deliberate.' })
    expect(result.changes[3]?.after).toBe('Duco is in the cut-down loincloth from here on.')
    expect(result.changes[4]?.after).toContain('count=14')
    expect(result.changes[4]?.after).toContain('exclude=[children]')

    const scene = JSON.parse(await Bun.file(getSceneJsonPath(slug)).text()) as { panels: Array<{ number: number; shotPlan: string; blocking?: { cameraSetupId: string; axisBreak: { sourceSegmentId: string } | null } }> }
    expect(scene.panels[0]?.blocking?.cameraSetupId).toBe('reverse-from-hatch')
    expect(scene.panels[2]?.blocking?.axisBreak?.sourceSegmentId).toBe('beat-0003')
    const rewrittenPlan = JSON.parse(await Bun.file(getBlockingPlanPath(slug)).text()) as ReturnType<typeof buildBlockingFixturePlan>
    expect(rewrittenPlan.stageStates.some(state => state.characters.some(mark => mark.characterKey === 'duco' && mark.wardrobe.includes('loincloth')))).toBe(true)
    expect(rewrittenPlan.stageStates.some(state => state.extras.some(region => region.count === 14 && region.exclude.includes('children')))).toBe(true)
    const log = JSON.parse(await Bun.file(result.logPath).text()) as { changes: unknown[]; skipped: unknown[] }
    expect(log.changes).toHaveLength(5)
    expect(log.skipped).toHaveLength(0)
  })

  test('rejects a panel split and skips unbound or unknown targets', async () => {
    const splitStaging = emptyStaging()
    splitStaging.camera.push({ lineIndex: 4, afterSegmentId: 'beat-0001', panel: 1, text: 'Split this panel into two beats.' })
    const split = await prepare({ withBlocking: true, staging: splitStaging })
    await expect(reconcileFromDirectives({ sceneSlug: split.slug }, { runId: () => 'r', structuredScript: split.structuredScript }))
      .rejects.toThrow('asks for a panel split or merge')

    const skipStaging = emptyStaging()
    skipStaging.camera.push({ lineIndex: 4, afterSegmentId: null, panel: 'next', text: 'Tighter framing.' })
    skipStaging.camera.push({ lineIndex: 5, afterSegmentId: null, panel: 99, text: 'Tighter framing.' })
    skipStaging.costume.push({ lineIndex: 6, afterSegmentId: null, character: 'nobody', text: 'A hat.' })
    const skips = await prepare({ withBlocking: true, staging: skipStaging })
    await writeFile(getBlockingPlanPath(skips.slug), `${JSON.stringify(buildBlockingFixturePlan(), null, 2)}\n`)
    const result = await reconcileFromDirectives({ sceneSlug: skips.slug }, { runId: () => 'r', structuredScript: skips.structuredScript })
    expect(result.changes).toHaveLength(0)
    expect(result.skipped.map(skip => skip.reason)).toEqual([
      'the directive targets "next" instead of a bound panel number',
      'metadata/scene.json has no panel 99',
      'no stage state carries a mark for character "nobody"',
    ])
  })

  test('rejects the flag combinations that would need a redraft', () => {
    const parse = (args: string[]) => coerceAndValidateDraftScenes(parseCommandInvocation(['comic draft-scenes', ...args], draftScenesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    expect(parse(['02-01', '--reconcile-from-directives']).reconcileFromDirectives).toBe(true)
    expect(parse(['02-01']).reconcileFromDirectives).toBeUndefined()
    expect(() => parse(['02-01', '--reconcile-from-directives', '--only', 'scene'])).toThrow('--reconcile-from-directives cannot be combined with --only')
    expect(() => parse(['02-01', '--reconcile-from-directives', '--only', 'blocking', '--rebind'])).toThrow('--reconcile-from-directives cannot be combined with --only')
  })
})

describe('blooper ledger', () => {
  test('copies every non-promoted attempt with a provenance sidecar and never copies the promoted image', async () => {
    const workspace = await makeTempDir('autoshow-bloopers-')
    temporaryDirectories.push(workspace)
    const attemptsDirectory = join(workspace, 'attempts', 'panel-01')
    await mkdir(attemptsDirectory, { recursive: true })
    const promotedPath = join(workspace, 'panel-01.png')
    await writeFile(join(attemptsDirectory, 'attempt-0.png'), Buffer.from('first-attempt'))
    await writeFile(join(attemptsDirectory, 'attempt-1.png'), Buffer.from('promoted-bytes'))
    await writeFile(promotedPath, Buffer.from('promoted-bytes'))
    await writeFile(join(attemptsDirectory, 'attempt-0-qa.json'), JSON.stringify({
      pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: true,
      repairPolicy: { action: 'restart', reason: 'blocking-class', repeatedHardFailures: ['panel-1:blockingAudit'] },
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: false, axisSideMatch: true, blockingAudit: [{ subject: 'gulp', status: 'side-swapped', note: 'Gulp is screen-right.' }], dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Blocking failure.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }))
    const bloopersRoot = join(workspace, 'bloopers')

    const result = await captureBloopers({
      sceneSlug: '01-mandatory-meeting', episode: '02', runId: 'blooper-run', panelNumber: 1,
      promotedPath, attemptsDirectory, imageModel: 'gpt-image-2', bloopersRoot, now: () => new Date('2026-09-02T00:00:00.000Z'),
    })

    expect(result.copied).toHaveLength(1)
    const record = result.copied[0]!
    expect(record).toMatchObject({
      schemaVersion: 1, runId: 'blooper-run', episode: '02', sceneSlug: '01-mandatory-meeting',
      panelNumber: 1, attemptNumber: 0, lastHopModel: 'gpt-image-2', cleanLineage: true, lineage: 'clean',
      qaVerdict: 'hard-failure', hardFailureKeys: ['panel-1:blockingAudit'], category: 'side-flip', capturedAt: '2026-09-02T00:00:00.000Z',
    })
    const copiedPath = join(bloopersRoot, '02', '01-mandatory-meeting', 'panel-01-attempt-0.png')
    expect(Buffer.from(await Bun.file(copiedPath).arrayBuffer())).toEqual(Buffer.from('first-attempt'))
    expect(await Bun.file(join(bloopersRoot, '02', '01-mandatory-meeting', 'panel-01-attempt-1.png')).exists()).toBe(false)
    const sidecar = JSON.parse(await Bun.file(`${copiedPath}.json`).text()) as BlooperRecord
    expect(sidecar.sha256).toBe(new Bun.CryptoHasher('sha256').update(Buffer.from('first-attempt')).digest('hex'))
    const ledger = JSON.parse(await Bun.file(result.ledgerPath).text()) as { schemaVersion: number; records: BlooperRecord[] }
    expect(ledger.schemaVersion).toBe(1)
    expect(ledger.records).toHaveLength(1)
    const readme = await Bun.file(result.readmePath).text()
    expect(readme).toContain('| side-flip | 1 |')
    expect(readme).toContain('nothing here changes any QA or review status')
  })

  test('derives the category from the blocking audit and falls back to other', () => {
    const entryWith = (overrides: Record<string, unknown>): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: true, axisSideMatch: true, blockingAudit: [], dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '', ...overrides }], summary: 'Fixture.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    expect(categorizeBlooper(entryWith({ blockingAudit: [{ subject: 'gulp', status: 'unlisted-on-stage', note: 'Gulp is here.' }] }), 1)).toBe('intruder')
    expect(categorizeBlooper(entryWith({ blockingAudit: [{ subject: 'duco', status: 'wardrobe-wrong', note: 'Wrong coverall.' }] }), 1)).toBe('wardrobe-swap')
    expect(categorizeBlooper(entryWith({ axisSideMatch: false }), 1)).toBe('side-flip')
    expect(categorizeBlooper(entryWith({ setContinuityAudit: [{ anchor: 'desk', status: 'mirrored', evidence: 'The desk is flipped.' }] }), 1)).toBe('furniture-spin')
    expect(categorizeBlooper(entryWith({}), 1)).toBe('other')
    expect(categorizeBlooper(undefined, 1)).toBe('other')
  })
})
