import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generatePanelImages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-panel-images'
import {
  PAGE_QA_REPORT_SCHEMA_VERSION,
  applyPageQaRepairPolicy,
  applyPageQaTolerancePolicy,
  buildComicPageQaPrompt,
  buildPageQaImageInputs,
  getPageQaHardFailureKeys,
  hasHardPageQaFailure,
  isBlockingClassFailureOnly,
  isBlockingMaterialFailure,
  parseComicPageQaResult,
  readReusablePageQaEntry,
  writePageQaReports,
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa'
import { buildComicRepairComparisonPrompt } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-repair-comparison'
import { coerceAndValidateGenerateImages } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { generateImagesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import type { BlockingHardKeyPolicy, ComicImageRequestInput, CompiledPanelBlocking, PageQaEntry, PageQaRequest, PageQaResult, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const temporaryDirectories: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')
const planSha256 = 'a'.repeat(64)
const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

const compiledBlocking = (): CompiledPanelBlocking => ({
  planSha256,
  stageStateId: 'meeting-open',
  cameraSetupId: 'wide-from-door',
  camera: { position: { x: 0, y: 0 }, heightM: 1.6, lens: 'wide', framing: 'wide', elevation: 'eye', overShoulderOf: null, headingDeg: 0, nearestView: 'establishing' },
  axis: { from: 'hero', to: 'rival', cameraSide: 'left', establishedSide: 'left', matchesEstablished: true, axisBreak: null },
  ledger: [{ characterKey: 'hero', screenSide: 'left', depthBand: 'midground', posture: 'standing', facing: 'toward-camera', seatAnchorKey: null, wardrobe: 'canonical', frame: 'in', lateral: -0.6 }],
  offFrameRoster: [{ characterKey: 'rival', note: 'on stage screen-right of frame at the loading door' }],
  croppedOnStage: [],
  extrasInFrame: [],
  dressingInFrame: 'none',
  anchorsInFrame: [{ key: 'loading door', screenSide: 'left', depthBand: 'background', seenFrom: 'front', projection: 'loading door: screen-left, far, flat face toward camera' }],
  lines: {
    camera: 'Camera wide-from-door: wide lens, wide framing, eye elevation, heading 0 degrees, nearest registered view establishing.',
    ledger: ['hero: screen-left, midground, standing, facing toward-camera, wardrobe canonical.'],
    offFrame: 'rival is on stage screen-right of frame at the loading door.',
    wardrobe: 'Wardrobe: hero canonical.',
    extras: 'Extras: none in frame.',
    dressing: 'Dressing: none.',
    anchors: 'Anchors in frame: loading door: screen-left, far, flat face toward camera.',
  },
})

const panelBundle = (panelNumber: number, options: { blocking?: boolean } = {}): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot',
  title: 'Blocking QA', location: 'Cargo Bay',
  panels: [{
    number: panelNumber, description: `Authored staging ${panelNumber}.`,
    shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
    characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
    sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
    locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
  }],
  ...(options.blocking ? { blocking: compiledBlocking() } : {}),
})

const createSceneFixture = async (sceneSlug: string, options: { blocking?: boolean } = {}): Promise<{ runDirectory: string }> => {
  const runDirectory = await makeTempDir('autoshow-comic-blocking-qa-')
  temporaryDirectories.push(runDirectory)
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  for (const key of ['hero', 'rival']) {
    const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', key)
    await mkdir(characterRoot, { recursive: true })
    await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
  }
  await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({
    schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z',
    characters: ['hero', 'rival'].map(key => ({
      key, name: key === 'hero' ? 'Hero' : 'Rival', description: `Test ${key}`, sourceSketchVersion: 'v1',
      assets: [
        { role: 'sketch-sheet', path: `assets/character-references/character-snapshot/${key}/reference.png`, sha256: sha },
        { role: 'source-image', path: `assets/character-references/character-snapshot/${key}/reference.png`, sha256: sha },
      ],
    })),
  }))
  const locationSheet = join(runDirectory, 'assets', 'location-references', 'location-snapshot', 'cargo-bay.png')
  await mkdir(dirname(locationSheet), { recursive: true })
  await Bun.write(locationSheet, tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth.', sourceScripts: ['scripts/02-script/01.md'], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: 'assets/location-references/location-snapshot/cargo-bay.png', sha256: sha } }] }))
  const directory = join(runDirectory, 'metadata', 'panel-prompts', 'panel-01')
  await mkdir(directory, { recursive: true })
  await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(1, options), null, 2)}\n\`\`\`\n`)
  return { runDirectory }
}

const auditPanel = (overrides: Partial<PageQaResult['panels'][number]> = {}): PageQaResult['panels'][number] => ({
  panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none',
  locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true,
  blockingMatch: true, axisSideMatch: true, blockingAudit: [],
  dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [],
  visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '',
  repairAssessment: { issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', editIsolation: 'isolated-single-region', collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', preservationRequirements: ['Preserve every unaffected region.'], rationale: 'Synthetic blocking fixture.' },
  ...overrides,
})

const auditResult = (panel: PageQaResult['panels'][number], summary = 'Blocking audit fixture.'): PageQaResult => ({
  panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
  panels: [panel],
  summary,
})

const entryFor = (result: PageQaResult, policy: BlockingHardKeyPolicy = []): PageQaEntry => ({
  pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5',
  hardFailure: hasHardPageQaFailure(result, { blockingHardKeys: policy }), result,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
})

const rawPanelPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none',
  locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true,
  blockingMatch: true, axisSideMatch: true, blockingAudit: [{ subject: 'hero', status: 'on-mark', note: 'Screen-left as declared.' }],
  dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [],
  visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '',
  repairAssessment: { issueVisibility: 'not-assessable', expectedBenefit: 'none', editScope: 'bounded', editIsolation: 'isolated-single-region', collateralRisk: 'low', confidence: 'high', recommendation: 'retain-current', preservationRequirements: [], rationale: 'No repair is warranted.' },
  ...overrides,
})

const rawPayload = (panel: Record<string, unknown>): string => JSON.stringify({
  panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
  panels: [panel],
  summary: 'Parsed blocking payload.',
})

describe('blocking-aware page QA and the blocking-class restart lane', () => {
  afterEach(async () => {
    resetSceneRunContext()
    while (temporaryDirectories.length > 0) await rm(temporaryDirectories.pop()!, { recursive: true, force: true })
  })

  test('requires blockingMatch, axisSideMatch, and a valid blockingAudit in every parsed panel', () => {
    expect(parseComicPageQaResult(rawPayload(rawPanelPayload()), [1]).panels[0]?.blockingAudit).toEqual([{ subject: 'hero', status: 'on-mark', note: 'Screen-left as declared.' }])
    const { blockingAudit: _omitted, ...withoutAudit } = rawPanelPayload()
    expect(() => parseComicPageQaResult(rawPayload(withoutAudit), [1])).toThrow('missing or unexpected fields')
    const { blockingMatch: _omittedMatch, ...withoutMatch } = rawPanelPayload()
    expect(() => parseComicPageQaResult(rawPayload(withoutMatch), [1])).toThrow('missing or unexpected fields')
    expect(() => parseComicPageQaResult(rawPayload(rawPanelPayload({ blockingAudit: [{ subject: 'hero', status: 'mirrored', note: 'Wrong vocabulary.' }] })), [1])).toThrow('invalid blockingAudit')
    expect(() => parseComicPageQaResult(rawPayload(rawPanelPayload({ blockingAudit: [{ subject: '', status: 'on-mark', note: 'Empty subject.' }] })), [1])).toThrow('invalid blockingAudit')
    expect(() => parseComicPageQaResult(rawPayload(rawPanelPayload({ axisSideMatch: 'yes' })), [1])).toThrow('field axisSideMatch must be boolean')
  })

  test('scopes spatial QA to the compiled camera and declared in-frame anchors', () => {
    const prompt = buildComicPageQaPrompt(panelBundle(1, { blocking: true }), [], [{ key: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth.' }])
    expect(prompt).toContain('only anchors declared inside the frame are mandatory visibility requirements')
    expect(prompt).toContain('mark an undeclared anchor outside-crop unless the generated image actually reveals that anchor or its canonical region')
    expect(prompt).toContain('judge shotPlanMatch spatially against the compiled camera line and ledger only')
    expect(prompt).toContain('They replace camera, framing, screen-side, depth, facing, posture, seat, crop, and visible-cast phrases in the older prose shot plan')
  })

  test('derives blockingMatch from the audit array in the tolerance policy', () => {
    const normalized = applyPageQaTolerancePolicy(auditResult(auditPanel({ blockingMatch: true, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }] })))
    expect(normalized.panels[0]?.blockingMatch).toBe(false)
    const advisory = applyPageQaTolerancePolicy(auditResult(auditPanel({ blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'not-assessable', note: 'Too dark to judge.' }] })))
    expect(advisory.panels[0]?.blockingMatch).toBe(true)
  })

  test('treats a blocking status as hard only when the policy lists it', () => {
    const sideSwapped = auditResult(auditPanel({ blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }] }))
    expect(hasHardPageQaFailure(sideSwapped)).toBe(false)
    expect(hasHardPageQaFailure(sideSwapped, { blockingHardKeys: ['posture-wrong'] })).toBe(false)
    expect(hasHardPageQaFailure(sideSwapped, { blockingHardKeys: ['side-swapped'] })).toBe(true)

    const depthSwapped = auditResult(auditPanel({ blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'depth-swapped', note: 'Hero reads as background.' }] }))
    expect(hasHardPageQaFailure(depthSwapped, { blockingHardKeys: ['side-swapped', 'posture-wrong', 'wardrobe-wrong', 'missing-on-mark', 'unlisted-on-stage', 'excluded-extra-present', 'axis-side'] })).toBe(false)
    expect(hasHardPageQaFailure(depthSwapped, { blockingHardKeys: ['depth-swapped'] })).toBe(true)

    const emptyMark = auditResult(auditPanel({ blockingMatch: false, blockingAudit: [{ subject: 'rival', status: 'exposed-empty-mark', note: 'Rival is absent but the rival chair is visible and empty.' }] }))
    expect(hasHardPageQaFailure(emptyMark, { blockingHardKeys: ['exposed-empty-mark'] })).toBe(true)

    const crossedAxis = auditResult(auditPanel({ axisSideMatch: false }))
    expect(hasHardPageQaFailure(crossedAxis)).toBe(false)
    expect(hasHardPageQaFailure(crossedAxis, { blockingHardKeys: ['side-swapped'] })).toBe(false)
    expect(hasHardPageQaFailure(crossedAxis, { blockingHardKeys: ['axis-side'] })).toBe(true)
  })

  test('reports blocking failure keys and recognizes blocking-class-only failures', () => {
    const policy: BlockingHardKeyPolicy = ['side-swapped', 'axis-side']
    const blockingOnly = entryFor(auditResult(auditPanel({ blockingMatch: false, axisSideMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }] })), policy)
    expect(getPageQaHardFailureKeys(blockingOnly, policy)).toEqual(['panel-1:blockingAudit', 'panel-1:axisSideMatch'])
    expect(isBlockingClassFailureOnly(blockingOnly, policy)).toBe(true)
    expect(isBlockingMaterialFailure(blockingOnly, policy)).toBe(true)

    const blockingAndSet = entryFor(auditResult(auditPanel({ blockingMatch: false, setContinuityMatch: false, setContinuityAudit: [{ anchor: 'bridge', status: 'missing', evidence: 'The bridge region is empty.' }], blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }] })), policy)
    expect(isBlockingClassFailureOnly(blockingAndSet, policy)).toBe(false)
    expect(isBlockingMaterialFailure(blockingAndSet, policy)).toBe(true)

    const mixed = entryFor(auditResult(auditPanel({ blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }], dialogueAccuracy: false, dialogueIssueKind: 'content' })), policy)
    expect(getPageQaHardFailureKeys(mixed, policy)).toEqual(['panel-1:blockingAudit', 'panel-1:dialogueAccuracy'])
    expect(isBlockingClassFailureOnly(mixed, policy)).toBe(false)
    expect(isBlockingMaterialFailure(mixed, policy)).toBe(false)

    const clean = entryFor(auditResult(auditPanel()), policy)
    expect(getPageQaHardFailureKeys(clean, policy)).toEqual([])
    expect(isBlockingClassFailureOnly(clean, policy)).toBe(false)
  })

  test('keeps shot-plan and blocking failures hard after repairs', () => {
    const policy: BlockingHardKeyPolicy = ['side-swapped']
    const result = auditResult(auditPanel({ shotPlanMatch: false, blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is screen-right.' }] }))
    const strict = applyPageQaRepairPolicy(entryFor(result, policy), 1, policy)
    expect(strict.waivedChecks).toBeUndefined()
    expect(strict.hardFailure).toBe(true)
    expect(getPageQaHardFailureKeys(strict, policy)).toEqual(['panel-1:shotPlanMatch', 'panel-1:blockingAudit'])

    const shotPlanOnly = auditResult(auditPanel({ shotPlanMatch: false }))
    expect(applyPageQaRepairPolicy(entryFor(shotPlanOnly, policy), 1, policy).hardFailure).toBe(true)
  })

  test('asks the judge for a blocking audit and pins the rewritten world-space sentence', () => {
    const prompt = buildComicPageQaPrompt(panelBundle(1, { blocking: true }), [{ key: 'hero', description: 'Hero.' }], [{ key: 'cargo-bay', specification: 'Cargo bay.' }])
    expect(prompt).toContain('Judge set anchors in world space (topology and relative relationships), but judge each listed character\'s screen side, depth order, posture, facing, and wardrobe in screen space against the blocking ledger when one is supplied. A different camera distance, elevation, perspective, or crop is desirable shot variation; a swapped screen side or a crossed axis of action is not.')
    expect(prompt).toContain('Blocking ledger supplied for this panel.')
    expect(prompt).toContain('hero: screen-left, midground, standing, facing toward-camera, wardrobe canonical.')
    expect(prompt).toContain('Declared wardrobe: Wardrobe: hero canonical.')
    expect(prompt).toContain('Off-frame roster: rival is on stage screen-right of frame at the loading door.')
    expect(prompt).toContain('Emit one blockingAudit entry for every character listed in the panel contract')
    for (const status of ['side-swapped', 'depth-swapped', 'facing-wrong', 'posture-wrong', 'wardrobe-wrong', 'missing-on-mark', 'unlisted-on-stage', 'exposed-empty-mark', 'excluded-extra-present', 'scale-wrong', 'crowd-uniform', 'not-assessable']) {
      expect(prompt).toContain(status)
    }
    expect(prompt).toContain('Absence of the person alone is not enough for on-mark.')
    const planFree = buildComicPageQaPrompt(panelBundle(1))
    expect(planFree).toContain('No blocking ledger is supplied for this panel. Leave blockingAudit empty, set blockingMatch=true, and set axisSideMatch=true')
    expect(planFree).not.toContain('Blocking ledger supplied for this panel.')
  })

  test('labels roster cards absent-by-contract and emits a lookalike cue only for shared panels', () => {
    const shared = buildComicPageQaPrompt(panelBundle(1), [], [], [], {
      rosterCards: [{ key: 'rival', name: 'Rival' }],
      characterCues: [{ characterKey: 'hero', distinguishFrom: [{ characterKey: 'rival', cue: 'Hero wears the navy hoodie; Rival wears the orange coverall.' }] }],
    })
    expect(shared).toContain('roster identity cards for rival (Rival)')
    expect(shared).toContain('absent from this panel by contract')
    expect(shared).toContain('report any of them you can see as unlisted-on-stage')
    expect(shared).not.toContain('Lookalike cues for characters that share this panel')

    const bundleWithBoth = panelBundle(1)
    bundleWithBoth.panels[0]!.characterKeys = ['hero', 'rival']
    const together = buildComicPageQaPrompt(bundleWithBoth, [], [], [], {
      characterCues: [{ characterKey: 'hero', distinguishFrom: [{ characterKey: 'rival', cue: 'Hero wears the navy hoodie; Rival wears the orange coverall.' }] }],
    })
    expect(together).toContain('Lookalike cues for characters that share this panel: hero versus rival: Hero wears the navy hoodie; Rival wears the orange coverall.')
  })

  test('sends roster identity cards at low detail after the high-detail contract references', async () => {
    const directory = await makeTempDir('autoshow-comic-blocking-inputs-')
    temporaryDirectories.push(directory)
    const page = join(directory, 'page.png')
    const roster = join(directory, 'roster.png')
    await Bun.write(page, tinyPng)
    await Bun.write(roster, tinyPng)
    const inputs = await buildPageQaImageInputs([page], [roster])
    expect(inputs.map(input => input.detail)).toEqual(['high', 'low'])
    expect(inputs.every(input => input.type === 'input_image' && input.image_url.startsWith('data:image/png;base64,'))).toBe(true)
  })

  test('names the blocking correction as the target change in the comparison prompt only when it is the only finding', () => {
    const blockingPrompt = buildComicRepairComparisonPrompt({ pass: 1, targetedFinding: 'Hero is screen-right.', targetedCorrection: 'Move hero to screen-left.', panelData: panelBundle(1, { blocking: true }), blockingOnlyCorrection: true })
    expect(blockingPrompt).toContain('The corresponding character pose, position, and placement change is the target change itself, so never report it as non-target drift')
    const defaultPrompt = buildComicRepairComparisonPrompt({ pass: 1, targetedFinding: 'A wall display is missing.', targetedCorrection: 'Restore the wall display.', panelData: panelBundle(1) })
    expect(defaultPrompt).toContain('Every element outside the only requested correction, character pose and position included, is non-target and must be judged as drift.')
    expect(defaultPrompt).not.toContain('is the target change itself')
  })

  test('routes a blocking-class failure to the canonical-reference restart lane and skips the comparison calls', async () => {
    const sceneSlug = `blocking-restart-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, { blocking: true })
    const calls: ComicImageRequestInput[] = []
    const judgeRequests: PageQaRequest[] = []
    let judges = 0
    const judgePage = async (request: PageQaRequest): Promise<PageQaEntry> => {
      judgeRequests.push(request)
      judges++
      const failed = judges === 1
      const result = auditResult(auditPanel(failed
        ? { blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is drawn screen-right.' }] }
        : {}))
      return { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: request.model, hardFailure: hasHardPageQaFailure(result, { blockingHardKeys: request.blockingHardKeys ?? [] }), result, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 1, blockingHardKeys: ['side-swapped'] }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: Buffer.from(`attempt-${calls.length}`).toString('base64') } } },
      writeImage: async (outputPath, imageBase64) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
      judgePage,
      requestRepairComparison: async () => { throw new Error('the blocking-class restart lane must not run a comparison') },
    })

    expect(calls).toHaveLength(2)
    expect(calls[1]?.model).toBe('gpt-image-2')
    expect(calls[1]?.referenceImages.some(path => path.includes('attempt-0.png'))).toBe(false)
    expect(calls[1]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(calls[1]?.normalizedPrompt).toContain('The reviewed blocking ledger is authoritative for this panel:')
    expect(calls[1]?.normalizedPrompt).toContain('hero: screen-left, midground, standing, facing toward-camera, wardrobe canonical.')

    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    expect(Buffer.from(await Bun.file(output).arrayBuffer())).toEqual(Buffer.from('attempt-2'))
    const evidence = JSON.parse(await Bun.file(join(runDirectory, 'panels', 'test-run', 'attempts', 'panel-01', 'attempt-0-qa.json')).text()) as PageQaEntry
    expect(evidence.repairPolicy).toEqual({ action: 'restart', reason: 'blocking-class', repeatedHardFailures: ['panel-1:blockingAudit'] })
    expect(judgeRequests[0]?.blockingHardKeys).toEqual(['side-swapped'])
    expect(judgeRequests[0]?.rosterCards?.map(card => card.key)).toEqual(['rival'])
  })

  test('stops a blocking-to-set-to-blocking cycle instead of restarting through the remaining budget', async () => {
    const sceneSlug = `blocking-cycle-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug, { blocking: true })
    const calls: ComicImageRequestInput[] = []
    const failures = ['blocking', 'set', 'blocking'] as const
    let judges = 0
    const judgePage = async (request: PageQaRequest): Promise<PageQaEntry> => {
      const failure = failures[Math.min(judges++, failures.length - 1)]!
      const result = auditResult(auditPanel(failure === 'blocking'
        ? { blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is drawn screen-right.' }], issues: ['Hero is on the wrong side.'], editInstructions: 'Move hero screen-left.' }
        : { setContinuityMatch: false, issues: ['The loading door is misplaced.'], editInstructions: 'Restore the loading door screen-left.' }))
      return { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: request.model, hardFailure: hasHardPageQaFailure(result, { blockingHardKeys: request.blockingHardKeys ?? [] }), result, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 4, blockingHardKeys: ['side-swapped'] }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: Buffer.from(`attempt-${calls.length}`).toString('base64') } } },
      writeImage: async (outputPath, imageBase64) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
      judgePage,
      requestRepairComparison: async ({ pass }) => ({
        text: JSON.stringify({ targetedDefectStatusImageA: pass === 1 ? 'visible' : 'not-visible', targetedDefectStatusImageB: pass === 1 ? 'not-visible' : 'visible', targetedDefectLowerIn: pass === 1 ? 'image-b' : 'image-a', differenceMeaningful: true, majorRegressionImageA: false, majorRegressionImageB: false, nonTargetDifferenceLevel: 'none', preservationRequirementsSatisfiedImageA: true, preservationRequirementsSatisfiedImageB: true, nonTargetDifferences: [], fullContractPreference: pass === 1 ? 'image-b' : 'image-a', confidence: 'high', regressionsImageA: [], regressionsImageB: [], rationale: 'The candidate fixes the targeted finding without regression.' }),
        inputTokens: 1,
        outputTokens: 1,
      }),
    })).rejects.toThrow('1 panel QA hard failure(s)')

    expect(calls).toHaveLength(3)
    const evidence = JSON.parse(await Bun.file(join(runDirectory, 'panels', 'test-run', 'attempts', 'panel-01', 'attempt-2-qa.json')).text()) as PageQaEntry
    expect(evidence.repairPolicy).toEqual({ action: 'stop', reason: 'constraint-oscillation', repeatedHardFailures: ['panel-1:blockingAudit'] })
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).exists()).toBe(false)
  })

  test('counts comparison-rejected repair candidates toward the stagnation stop', async () => {
    const sceneSlug = `comparison-stagnation-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    let comparisons = 0
    const failedResult = auditResult(auditPanel({ shotPlanMatch: false, issues: ['The camera framing remains wrong.'], editInstructions: 'Correct the camera framing.' }))
    const judgePage = async (request: PageQaRequest): Promise<PageQaEntry> => ({
      pageNumber: 1,
      panelNumbers: [1],
      outputFile: 'attempt.png',
      judgeModel: request.model,
      hardFailure: true,
      result: failedResult,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 4 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: Buffer.from(`attempt-${calls.length}`).toString('base64') } } },
      writeImage: async (outputPath, imageBase64) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
      judgePage,
      requestRepairComparison: async ({ pass }) => {
        comparisons++
        return {
          text: JSON.stringify({ targetedDefectStatusImageA: pass === 1 ? 'not-visible' : 'visible', targetedDefectStatusImageB: pass === 1 ? 'visible' : 'not-visible', targetedDefectLowerIn: pass === 1 ? 'image-a' : 'image-b', differenceMeaningful: true, majorRegressionImageA: false, majorRegressionImageB: false, nonTargetDifferenceLevel: 'none', preservationRequirementsSatisfiedImageA: true, preservationRequirementsSatisfiedImageB: true, nonTargetDifferences: [], fullContractPreference: pass === 1 ? 'image-a' : 'image-b', confidence: 'high', regressionsImageA: [], regressionsImageB: [], rationale: 'The original remains better than the candidate.' }),
          inputTokens: 1,
          outputTokens: 1,
        }
      },
    })).rejects.toThrow('1 panel QA hard failure(s)')

    expect(calls).toHaveLength(4)
    expect(comparisons).toBe(6)
    const evidence = JSON.parse(await Bun.file(join(runDirectory, 'panels', 'test-run', 'attempts', 'panel-01', 'attempt-3-qa.json')).text()) as PageQaEntry
    expect(evidence.repairComparison?.decision).toBe('retain-original')
    expect(evidence.repairPolicy).toEqual({ action: 'stop', reason: 'repeated-hard-failure', repeatedHardFailures: ['panel-1:shotPlanMatch'] })
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).exists()).toBe(false)
  })

  test('keeps a mixed blocking-and-dialogue failure in the edit lane', async () => {
    const sceneSlug = `blocking-mixed-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug, { blocking: true })
    const calls: ComicImageRequestInput[] = []
    let comparisons = 0
    let judges = 0
    const judgePage = async (request: PageQaRequest): Promise<PageQaEntry> => {
      judges++
      const failed = judges === 1
      const result = auditResult(auditPanel(failed
        ? { blockingMatch: false, blockingAudit: [{ subject: 'hero', status: 'side-swapped', note: 'Hero is drawn screen-right.' }], dialogueAccuracy: false, dialogueIssueKind: 'content', issues: ['The bubble text is wrong.'], editInstructions: 'Restore the exact dialogue and move hero screen-left.' }
        : {}))
      return { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: request.model, hardFailure: hasHardPageQaFailure(result, { blockingHardKeys: request.blockingHardKeys ?? [] }), result, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 1, blockingHardKeys: ['side-swapped'] }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: Buffer.from(`attempt-${calls.length}`).toString('base64') } } },
      writeImage: async (outputPath, imageBase64) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
      judgePage,
      requestRepairComparison: async ({ pass }) => {
        comparisons++
        return { text: JSON.stringify({ targetedDefectStatusImageA: pass === 1 ? 'visible' : 'not-visible', targetedDefectStatusImageB: pass === 1 ? 'not-visible' : 'visible', targetedDefectLowerIn: pass === 1 ? 'image-b' : 'image-a', differenceMeaningful: true, majorRegressionImageA: false, majorRegressionImageB: false, nonTargetDifferenceLevel: 'none', preservationRequirementsSatisfiedImageA: true, preservationRequirementsSatisfiedImageB: true, nonTargetDifferences: [], fullContractPreference: pass === 1 ? 'image-b' : 'image-a', confidence: 'high', regressionsImageA: [], regressionsImageB: [], rationale: 'The candidate fixes the finding without regression.' }), inputTokens: 1, outputTokens: 1 }
      },
    })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.referenceImages.some(path => path.includes('attempt-0.png'))).toBe(true)
    expect(calls[1]?.normalizedPrompt).toContain('Edit the first image only.')
    expect(comparisons).toBe(0)
  })

  test('rejects a version-4 page QA report for reuse', async () => {
    const directory = await makeTempDir('autoshow-comic-blocking-report-')
    temporaryDirectories.push(directory)
    const pagePath = join(directory, 'panel-01.png')
    await Bun.write(pagePath, tinyPng)
    const entry = entryFor(auditResult(auditPanel()))
    await writePageQaReports(directory, [{ ...entry, outputFile: 'panel-01.png' }])
    expect(PAGE_QA_REPORT_SCHEMA_VERSION).toBe(6)
    expect(await readReusablePageQaEntry(pagePath, 'gpt-5.5')).toBeDefined()
    const report = JSON.parse(await Bun.file(join(directory, 'page-qa-report.json')).text()) as Record<string, unknown>
    await Bun.write(join(directory, 'page-qa-report.json'), JSON.stringify({ ...report, schemaVersion: 4 }, null, 2))
    expect(await readReusablePageQaEntry(pagePath, 'gpt-5.5')).toBeUndefined()
  })

  test('validates --blocking-hard-keys against the hard-candidate vocabulary', () => {
    const parse = (args: string[]) => coerceAndValidateGenerateImages(parseCommandInvocation([generateImagesCommandDefinition.name, ...args], generateImagesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    expect(parse(['script.md', '--blocking-hard-keys', 'side-swapped,axis-side,side-swapped']).blockingHardKeys).toEqual(['side-swapped', 'axis-side'])
    expect(() => parse(['script.md', '--blocking-hard-keys', 'scale-wrong'])).toThrow('Invalid blocking hard key "scale-wrong"')
    expect(() => parse(['script.md', '--blocking-hard-keys', ' , '])).toThrow('Invalid blocking hard key list')
    expect(parse(['script.md']).blockingHardKeys).toBeUndefined()
  })

  test('keeps the dense blocking layout guide opt-in and single-panel only', () => {
    const parse = (args: string[]) => coerceAndValidateGenerateImages(parseCommandInvocation([generateImagesCommandDefinition.name, ...args], generateImagesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    expect(parse(['script.md']).blockingLayoutGuide).toBeUndefined()
    expect(parse(['script.md', '--blocking-layout-guide']).blockingLayoutGuide).toBe(true)
    expect(() => parse(['script.md', '--blocking-layout-guide', '--panels-per-image', '2'])).toThrow('--blocking-layout-guide requires --panels-per-image 1')
    expect(() => parse(['script.md', '--blocking-layout-guide', '--qa-only', '--max-repairs', '0'])).toThrow('--qa-only cannot be combined with --blocking-layout-guide')
  })
})
