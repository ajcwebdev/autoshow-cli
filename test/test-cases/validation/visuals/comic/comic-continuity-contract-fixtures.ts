import { afterEach } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import {
  buildContinuityJudgeEntry
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/continuity-qa'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { ContinuityJudgeEntry, ContinuityJudgeRequest, ContinuityJudgeResult, ContinuityLabelsFile, PageQaEntry, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
export type FixturePanel = { number: number; characterKeys: string[]; locationKey?: string }
export const setupContinuityContractFixtures = () => {
  const temporaryDirectories: string[] = []
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')
  const JUDGE_MODEL = 'gpt-6.1-sol'

  const locationOf = (key: string) => ({ key, raw: key })

  const panelBundle = (panel: FixturePanel): PanelBundleData => {
    const locationKey = panel.locationKey ?? 'cargo-bay'
    return {
      schemaVersion: 4, snapshotId: 'character-snapshot',
      title: 'Continuity Contract', location: 'Cargo Bay', panels: [{
        number: panel.number, description: `Authored staging ${panel.number}.`,
        shotPlan: `Medium eye-level shot ${panel.number}; hero is screen left facing right at the control booth.`,
        characterKeys: panel.characterKeys, speech: [], sourceSegmentIds: [`beat-${panel.number}`],
        sourceSegments: [{ id: `beat-${panel.number}`, type: 'direction', text: `Authored staging ${panel.number}.`, sourceSpans: [], beatIndex: panel.number, location: locationOf(locationKey) }],
        locationKey, locationSnapshotId: `location-${locationKey}`,
      }],
    }
  }

  const createSceneFixture = async (sceneSlug: string, panels: FixturePanel[], options: { canonicalPanels?: number[] } = {}): Promise<{ runDirectory: string }> => {
    const runDirectory = await makeTempDir('autoshow-comic-continuity-')
    temporaryDirectories.push(runDirectory)
    beginSceneRun(sceneSlug, { outputDir: runDirectory })
    const characters = ['hero', 'rival']
    await createLiveCharacterFixture(runDirectory, characters.map(key => ({ key, name: key === 'hero' ? 'Hero' : 'Rival', description: key === 'hero' ? 'Test hero in a blue uniform' : 'Test rival in a red coat', image: `${key}.png`, outlineSheet: `${key}.png`, aliases: [] })))
    const locationKeys = Array.from(new Set(panels.map(panel => panel.locationKey ?? 'cargo-bay')))
    await createLiveLocationFixture(runDirectory, locationKeys.map(key => ({ key, name: key, specification: `${key}: a loading door stays left of a fixed control booth.`, sourceScripts: ['scripts/02-script/01.md'] })), tinyPng)
    for (const panel of panels) {
      const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panel.number).padStart(2, '0')}`)
      await mkdir(directory, { recursive: true })
      await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panel), null, 2)}\n\`\`\`\n`)
    }
    const canonical = options.canonicalPanels ?? panels.map(panel => panel.number)
    await mkdir(join(runDirectory, 'panels'), { recursive: true })
    for (const number of canonical) await Bun.write(join(runDirectory, 'panels', `panel-${String(number).padStart(2, '0')}.png`), tinyPng)
    return { runDirectory }
  }

  const continuityResult = (overrides: Partial<ContinuityJudgeResult> = {}): ContinuityJudgeResult => ({
    panelNumber: 2, anchorPanel: 1, predecessorPanel: 1, axisStatus: 'consistent',
    castAudit: [
      { characterKey: 'hero', status: 'present', note: 'Hero is seated screen left at the booth.' },
      { characterKey: 'rival', status: 'not-assessable', note: 'Rival is not listed and not visible.' },
    ],
    characters: [{ characterKey: 'hero', screenSide: 'left', posture: 'seated', relativePlacement: 'at the control booth beside the loading door', wardrobe: 'canonical blue uniform' }],
    furnitureOrientation: { versusAnchor: 'same', versusPredecessor: 'same' },
    observedStageState: 'Hero sits screen left at the control booth; nobody else is on stage.',
    blooperCategory: 'none', repairRoute: 'none', notes: 'Clean panel.',
    ...overrides,
  })

  const entryFor = (panelNumber: number, anchorPanel: number, predecessorPanel: number | null, overrides: Partial<ContinuityJudgeResult> = {}, usage = { inputTokens: 10, outputTokens: 5 }): ContinuityJudgeEntry =>
    buildContinuityJudgeEntry({ panelNumber, panelPath: `/scene/panels/panel-${String(panelNumber).padStart(2, '0')}.png`, anchorPanel, predecessorPanel, model: JUDGE_MODEL }, continuityResult({ panelNumber, anchorPanel, predecessorPanel, ...overrides }), [], usage)

  const judgeRequest = (overrides: Partial<ContinuityJudgeRequest> = {}): ContinuityJudgeRequest => ({
    sceneSlug: 'scene', panelNumber: 2, panelPath: '/scene/panels/panel-02.png', anchorPanel: 1, anchorPath: '/scene/panels/panel-01.png', predecessorPanel: 1, predecessorPath: '/scene/panels/panel-01.png', trustedAnchorPanel: null,
    panelData: panelBundle({ number: 2, characterKeys: ['hero'] }), roster: ['hero', 'rival'], absentKeys: ['rival'],
    castCards: [{ key: 'hero', path: '/scene/assets/hero.png' }], absentCards: [{ key: 'rival', path: '/scene/assets/rival.png' }],
    characterReferences: [{ key: 'hero', description: 'Test hero in a blue uniform' }, { key: 'rival', description: 'Test rival in a red coat' }],
    locationReferences: [{ key: 'cargo-bay', specification: 'cargo-bay: a loading door stays left of a fixed control booth.' }],
    model: JUDGE_MODEL,
    ...overrides,
  })

  const pageQaEntry = (panelNumber: number, overrides: Partial<PageQaEntry> = {}): PageQaEntry => ({
    pageNumber: panelNumber, panelNumbers: [panelNumber], outputFile: `panel-${String(panelNumber).padStart(2, '0')}.png`, judgeModel: JUDGE_MODEL, hardFailure: false,
    result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [panelNumber], issues: [] }, panels: [{ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' }], summary: 'Pass.' },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.01 },
    ...overrides,
  })

  const labelsFile = (sceneSlug: string, overrides: Partial<ContinuityLabelsFile> = {}): ContinuityLabelsFile => ({
    schemaVersion: 1, sceneSlug, trustedAnchorPanel: null, labeled: true, labeler: 'Anthony', date: '2026-09-02',
    pairs: [],
    ...overrides,
  })

  const verdicts = (positive: string[] = []) => ({
    'side-flip': positive.includes('side-flip'), 'seat-swap': positive.includes('seat-swap'), 'furniture-spin': positive.includes('furniture-spin'),
    intruder: positive.includes('intruder'), 'vanishing-crowd': positive.includes('vanishing-crowd'), 'wardrobe-swap': positive.includes('wardrobe-swap'),
  })

  afterEach(async () => {
    resetSceneRunContext()
    configureCharactersRoot('input/characters')
    await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })
  return { temporaryDirectories, tinyPng, sha, JUDGE_MODEL, locationOf, panelBundle, createSceneFixture, continuityResult, entryFor, judgeRequest, pageQaEntry, labelsFile, verdicts }
}
