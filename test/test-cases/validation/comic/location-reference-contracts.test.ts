import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { locationReferenceSketchCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/reference-sketch/location-reference-command'
import { getLocationReferencePath, getLocationSketchManifestPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'

const roots: string[] = []
const image = Buffer.from('mock-image')

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-location-reference-'))
  roots.push(root)
  const characters = join(root, 'input', 'characters')
  const locations = join(root, 'input', 'locations')
  await mkdir(characters, { recursive: true })
  await mkdir(locations, { recursive: true })
  await Bun.write(join(characters, '03-duco.webp'), image)
  await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/03-duco.webp', locations: [] }))
  await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 1, sketches: [] }))
  const scripts = join(root, 'input', 'episode-scripts', '02-script')
  await mkdir(scripts, { recursive: true })
  await Bun.write(join(scripts, '01-cargo.md'), '# Episode\n\n**INT. CARGO BAY – MORNING**\n\nCrates line fixed wall rails. Duco drops a temporary wrench.')
  await Bun.write(join(scripts, '02-cargo.md'), '# Episode\n\n**INT. CARGO BAY – NIGHT**\n\nThe fixed loading door faces the wall rails. Damage smolders beside Peaches.')
  await Bun.write(join(scripts, '03-bridge.md'), '# Episode\n\n**INT. BRIDGE – DAY**\n\nA command chair.')
  configureCharactersRoot(characters)
  return { root, locations }
}

afterEach(async () => {
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('canonical location reference registration', () => {
  test('aggregates matching scripts once, preserves provenance, chains views, and registers only after QA success', async () => {
    const { locations } = await fixture()
    let aggregateCalls = 0
    const requests: string[][] = []
    let establishingJudgments = 0
    await locationReferenceSketchCommand({ location: 'cargo-bay', qa: true, maxRepairs: 2 }, {
      aggregateSpecification: async ({ scripts }) => { aggregateCalls++; expect(scripts).toHaveLength(2); return { name: 'Cargo Bay', specification: 'Fixed wall rails opposite a loading door; muted industrial palette.' } },
      requestImage: async (_prompt, references) => { requests.push(references); return { mode: requests.length === 2 ? 'edit' : 'generate', result: { imageBase64: image.toString('base64') } } },
      writeImage: async path => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, image) },
      judgeView: async ({ view }) => {
        if (view === 'establishing') establishingJudgments++
        const pass = view !== 'establishing' || establishingJudgments > 1
        return { pass, stableFeaturesMatch: pass, crossViewGeometryMatch: pass, houseStyleMatch: true, noPeople: true, noCopiedStyleContent: true, failedChecks: pass ? [] : ['stableFeaturesMatch'], editInstructions: pass ? '' : 'Restore the loading door.', summary: pass ? 'Pass.' : 'Repair.' }
      },
      composeSheet: async (_sources, output) => { await Bun.write(output, image) }, generationId: () => 'test-generation',
    })
    expect(aggregateCalls).toBe(1)
    expect(requests).toHaveLength(4)
    expect(requests[1]?.[0]).toContain('establishing-attempt-0.png')
    expect(requests[2]?.[0]).toContain('establishing-attempt-1.png')
    expect(requests[3]?.[0]).toContain('establishing-attempt-1.png')
    const catalog = JSON.parse(await Bun.file(getLocationReferencePath()).text())
    expect(catalog.locations[0].sourceScripts).toHaveLength(2)
    expect(catalog.locations[0].specification).not.toContain('Duco')
    const manifest = JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())
    expect(manifest.sketches[0].locationKey).toBe('cargo-bay')
    expect(await Bun.file(join(locations, 'cargo-bay--reference-sheet.png')).exists()).toBe(true)
  })

  test('preserves attempts but writes no catalog entry or registration when QA is exhausted', async () => {
    const { locations } = await fixture()
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', qa: true, maxRepairs: 1 }, {
      aggregateSpecification: async () => ({ name: 'Cargo Bay', specification: 'Fixed loading door.' }),
      requestImage: async () => ({ mode: 'generate', result: { imageBase64: image.toString('base64') } }),
      writeImage: async path => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, image) },
      judgeView: async () => ({ pass: false, stableFeaturesMatch: false, crossViewGeometryMatch: false, houseStyleMatch: true, noPeople: true, noCopiedStyleContent: true, failedChecks: ['geometry'], editInstructions: 'Fix geometry.', summary: 'Fail.' }),
      generationId: () => 'failed-generation',
    })).rejects.toThrow('failed QA')
    expect(JSON.parse(await Bun.file(getLocationReferencePath()).text()).locations).toEqual([])
    expect(JSON.parse(await Bun.file(getLocationSketchManifestPath()).text()).sketches).toEqual([])
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'failed-generation', 'establishing-attempt-1.png')).exists()).toBe(true)
  })
})
