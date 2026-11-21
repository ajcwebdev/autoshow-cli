import { afterEach } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { ComicImageRequestInput, GeneratedImageResponse, PanelBundleData } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'

export const setupPageContractFixtures = () => {
  const temporaryDirectories: string[] = []
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const sha = new Bun.CryptoHasher('sha256').update(tinyPng).digest('hex')

  const cargoBayLocation = { key: 'cargo-bay', raw: 'cargo-bay' }

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
    await createLiveCharacterFixture(runDirectory)
    const [locationSheet] = await createLiveLocationFixture(runDirectory, [{ key: 'cargo-bay', name: 'Cargo Bay', specification: 'A loading door stays left of a fixed control booth; camera angles and crops may vary.', sourceScripts: ['scripts/02-script/01.md'] }], tinyPng)
    for (const panelNumber of [1, 2]) {
      const directory = join(runDirectory, 'metadata', 'panel-prompts', `panel-${String(panelNumber).padStart(2, '0')}`)
      await mkdir(directory, { recursive: true })
      await Bun.write(join(directory, 'prompt.md'), `Generate panel independently.\n\n\`\`\`json\n${JSON.stringify(panelBundle(panelNumber), null, 2)}\n\`\`\`\n`)
    }
    return { runDirectory, locationSheet: locationSheet! }
  }

  const createMultiLocationFixture = async (sceneSlug: string): Promise<{ runDirectory: string; locationSheets: string[] }> => {
    const runDirectory = await makeTempDir('autoshow-comic-multi-location-')
    temporaryDirectories.push(runDirectory)
    beginSceneRun(sceneSlug, { outputDir: runDirectory })
    await createLiveCharacterFixture(runDirectory)
    const locations = [
      { key: 'quarters', snapshotId: 'location-quarters' },
      { key: 'hallway', snapshotId: 'location-hallway' },
    ]
    const locationSheets = await createLiveLocationFixture(runDirectory, locations.map(location => ({ key: location.key, name: location.key, specification: location.key, sourceScripts: [] })), tinyPng)
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

  /** Fake provider that returns the decodable PNG fixture and writes it exactly, recording every dispatched request. */
  const fakeImageProvider = (calls: ComicImageRequestInput[] = []) => ({
    calls,
    requestImage: async (input: ComicImageRequestInput): Promise<GeneratedImageResponse> => { calls.push(input); return { mode: 'generate', result: { imageBase64: tinyPng.toString('base64') } } },
    writeImage: async (outputPath: string) => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
  })

  afterEach(async () => {
    resetSceneRunContext()
    configureCharactersRoot('input/characters')
    await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })
  return { temporaryDirectories, tinyPng, sha, cargoBayLocation, panelBundle, createSceneFixture, createMultiLocationFixture, fakeImageProvider }
}
