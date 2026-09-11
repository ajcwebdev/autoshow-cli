import { afterEach } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { PageQaEntry, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

export const setupPageContractFixtures = () => {
  const temporaryDirectories: string[] = []
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')

  const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

  const repairAssessment = (overrides: Partial<NonNullable<PageQaEntry['result']['panels'][number]['repairAssessment']>> = {}): NonNullable<PageQaEntry['result']['panels'][number]['repairAssessment']> => ({
    issueVisibility: 'not-assessable', expectedBenefit: 'none', editScope: 'bounded', editIsolation: 'isolated-single-region', collateralRisk: 'low', confidence: 'high', recommendation: 'retain-current', preservationRequirements: [], rationale: 'No material repair is warranted.', ...overrides,
  })

  const repairComparisonResponse = (pass: 1 | 2, outcome: 'winner' | 'tie' | 'worse'): string => {
    const candidateIsA = pass === 2
    const candidateLabel = candidateIsA ? 'image-a' : 'image-b'
    const originalLabel = candidateIsA ? 'image-b' : 'image-a'
    const candidateStatus = outcome === 'tie' ? 'visible' : 'not-visible'
    const originalStatus = 'visible'
    return JSON.stringify({
      targetedDefectStatusImageA: candidateIsA ? candidateStatus : originalStatus,
      targetedDefectStatusImageB: candidateIsA ? originalStatus : candidateStatus,
      targetedDefectLowerIn: outcome === 'tie' ? 'neither' : candidateLabel,
      differenceMeaningful: outcome !== 'tie',
      majorRegressionImageA: outcome === 'worse' && candidateIsA,
      majorRegressionImageB: outcome === 'worse' && !candidateIsA,
      nonTargetDifferenceLevel: outcome === 'worse' ? 'major' : 'none',
      preservationRequirementsSatisfiedImageA: !(outcome === 'worse' && candidateIsA),
      preservationRequirementsSatisfiedImageB: !(outcome === 'worse' && !candidateIsA),
      nonTargetDifferences: outcome === 'worse' ? ['A principal cast member disappeared.'] : [],
      fullContractPreference: outcome === 'winner' ? candidateLabel : outcome === 'worse' ? originalLabel : 'tie',
      confidence: 'high',
      regressionsImageA: outcome === 'worse' && candidateIsA ? ['A principal cast member disappeared.'] : [],
      regressionsImageB: outcome === 'worse' && !candidateIsA ? ['A principal cast member disappeared.'] : [],
      rationale: outcome === 'winner' ? 'The candidate clearly fixes the visible issue without regression.' : outcome === 'worse' ? 'The candidate fixes the target but loses required cast.' : 'The images are materially equivalent.',
    })
  }

  const panelBundle = (panelNumber: number): PanelBundleData => ({
    schemaVersion: 4, snapshotId: 'character-snapshot',
    title: 'Location Contract', location: 'Cargo Bay', panels: [{
      number: panelNumber, description: `Authored staging ${panelNumber}.`,
      shotPlan: `Medium eye-level shot ${panelNumber}; hero is screen left, facing right; exclude all unlisted cast.`,
      characterKeys: ['hero'], speech: [], sourceSegmentIds: [`beat-${panelNumber}`],
      sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Authored staging ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: cargoBayLocation }],
      locationKey: 'cargo-bay', locationSnapshotId: 'location-snapshot',
    }],
  })

  const createSceneFixture = async (sceneSlug: string): Promise<{ runDirectory: string; locationSheet: string }> => {
    const runDirectory = await makeTempDir('autoshow-comic-location-')
    temporaryDirectories.push(runDirectory)
    beginSceneRun(sceneSlug, { outputDir: runDirectory })
    const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero')
    await mkdir(characterRoot, { recursive: true })
    await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
    await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
    const locationSheet = join(runDirectory, 'assets', 'location-references', 'location-snapshot', 'cargo-bay.png')
    await mkdir(dirname(locationSheet), { recursive: true })
    await Bun.write(locationSheet, tinyPng)
    await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'cargo-bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['scripts/02-script/01.md'], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: 'assets/location-references/location-snapshot/cargo-bay.png', sha256: sha } }] }))
    for (const panelNumber of [1, 2]) {
      const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
      await mkdir(directory, { recursive: true })
      await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
    }
    return { runDirectory, locationSheet }
  }

  const createMultiLocationFixture = async (sceneSlug: string): Promise<{ runDirectory: string; locationSheets: string[] }> => {
    const runDirectory = await makeTempDir('autoshow-comic-multi-location-')
    temporaryDirectories.push(runDirectory)
    beginSceneRun(sceneSlug, { outputDir: runDirectory })
    const characterRoot = join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero')
    await mkdir(characterRoot, { recursive: true })
    await Bun.write(join(characterRoot, 'reference.png'), tinyPng)
    await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Test hero', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }, { role: 'source-image', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: sha }] }] }))
    const locations = [
      { key: 'quarters', snapshotId: 'location-quarters' },
      { key: 'hallway', snapshotId: 'location-hallway' },
    ]
    const locationSheets: string[] = []
    const snapshots = []
    for (const location of locations) {
      const path = join(runDirectory, 'assets', 'location-references', location.snapshotId, `${location.key}.png`)
      await mkdir(dirname(path), { recursive: true })
      await Bun.write(path, tinyPng)
      locationSheets.push(path)
      snapshots.push({ schemaVersion: 2, snapshotId: location.snapshotId, locationKey: location.key, specification: location.key, sourceScripts: [], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: sha }], sheet: { path: `assets/location-references/${location.snapshotId}/${location.key}.png`, sha256: sha } })
    }
    await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots }))
    for (const [index, location] of locations.entries()) {
      const panelNumber = index + 1
      const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-0${panelNumber}`)
      await mkdir(directory, { recursive: true })
      const locationData = { key: location.key, raw: location.key }
      const bundle: PanelBundleData = {
        schemaVersion: 4,
        snapshotId: 'character-snapshot',
        title: 'Two locations',
        location: 'quarters then hallway',
        panels: [{
          number: panelNumber,
          description: `Panel ${panelNumber}.`,
          shotPlan: `Panel ${panelNumber} shot.`,
          characterKeys: ['hero'],
          speech: [],
          sourceSegmentIds: [`beat-${panelNumber}`],
          sourceSegments: [{ id: `beat-${panelNumber}`, type: 'direction', text: `Panel ${panelNumber}.`, sourceSpans: [], beatIndex: panelNumber, location: locationData }],
          locationKey: location.key,
          locationSnapshotId: location.snapshotId,
        }],
      }
      await Bun.write(join(directory, 'prompt.md'), `\`\`\`json\n${JSON.stringify(bundle)}\n\`\`\``)
    }
    return { runDirectory, locationSheets }
  }

  afterEach(async () => {
    resetSceneRunContext()
    await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })
  return { temporaryDirectories, tinyPng, sha, cargoBayLocation, repairAssessment, repairComparisonResponse, panelBundle, createSceneFixture, createMultiLocationFixture }
}
