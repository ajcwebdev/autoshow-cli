import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { isComicRecoveryState } from '~/cli/commands/command-shared/pipeline-manifest/comic-recovery-parser'
import { captureComicImageRecoveryInputs } from '~/cli/commands/visuals/comic/comic-utils/comic-image-recovery'
import { validateComicRecoveryInputs } from '~/cli/commands/visuals/comic/comic-utils/comic-recovery-intent'
import type { ComicRecoveryInput, ComicRecoveryIntent, PanelBundleData } from '~/types'
import { tinyPngFixture } from '../../../../test-utils/character-catalog-fixture'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { createLiveLocationFixture } from '../../../../test-utils/live-location-reference-fixture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const originalCwd = process.cwd()
const temporaryRoots: string[] = []
const sha256 = (bytes: string | Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const readJson = async (path: string) => JSON.parse(await Bun.file(path).text())
const writeJson = async (path: string, value: unknown): Promise<void> => { await writeFile(path, JSON.stringify(value)) }

const filesBelow = async (root: string, prefix = ''): Promise<string[]> => {
  const files: string[] = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...await filesBelow(root, relativePath))
    else files.push(relativePath)
  }
  return files.sort()
}

const intentFor = (charactersRoot: string, inputs: ComicRecoveryInput[]): ComicRecoveryIntent => ({
  schemaVersion: 1, flags: { target: 'images' }, inputs, charactersRoot,
  planHash: 'a'.repeat(64), completed: false, imageRunId: 'live-reference-recovery',
})

const fixture = async () => {
  const project = await realpath(await makeTempDir('autoshow-live-reference-recovery-'))
  temporaryRoots.push(project)
  process.chdir(project)
  const { charactersRoot } = await createLiveCharacterFixture(project, [
    { key: 'hero', name: 'Hero', aliases: [], image: 'hero.png', outlineSheet: 'hero.png', description: 'Blue uniform.' },
    { key: 'rival', name: 'Rival', aliases: [], image: 'rival.png', outlineSheet: 'rival.png', description: 'Red coat.' },
  ])
  const [locationPath] = await createLiveLocationFixture(project, [{ key: 'bridge', name: 'Bridge', specification: 'A fixed console stands beside the door.', sourceScripts: [] }], tinyPngFixture())
  const designPath = join(project, 'input/designs/console.png')
  await mkdir(join(project, 'input/designs'), { recursive: true })
  await writeFile(designPath, tinyPngFixture())
  const workspace = join(project, 'output/scene')
  const panelDirectory = join(workspace, 'metadata/panel-prompts/panel-01')
  await mkdir(panelDirectory, { recursive: true })
  const bundle: PanelBundleData = {
    schemaVersion: 4, snapshotId: 'retired-character-snapshot', title: 'Live recovery', location: 'Bridge',
    panels: [{
      number: 1, description: 'Hero checks the console.', shotPlan: 'Eye-level medium shot with Hero facing the console.',
      characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-1'],
      sourceSegments: [{ id: 'beat-1', type: 'direction', text: 'Hero checks the console.', sourceSpans: [], beatIndex: 1, location: { key: 'bridge', raw: 'Bridge' } }],
      locationKey: 'bridge', locationSnapshotId: 'retired-location-snapshot', designSnapshotId: 'retired-design-snapshot', designReferenceKeys: ['console'],
      designReferences: [{ key: 'console', sourcePath: 'input/designs/console.png', usage: 'The fixed console layout.' }],
    }],
  }
  await writeFile(join(panelDirectory, 'scene-panel-1.md'), `Reviewed panel.\n\n\`\`\`json\n${JSON.stringify(bundle)}\n\`\`\`\n`)
  await writeJson(join(workspace, 'metadata/scene.json'), {
    schemaVersion: 4, title: bundle.title, location: bundle.location,
    panels: [{ number: 1, description: 'Hero checks the console.', shotPlan: 'Eye-level medium shot with Hero facing the console.', characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-1'], locationKey: 'bridge', designReferences: bundle.panels[0]!.designReferences }],
  })
  await writeJson(join(workspace, 'metadata/structured-script.json'), { sourceSegments: [{ id: 'beat-1', text: 'Hero checks the console.' }] })
  return { project, workspace, charactersRoot, heroPath: join(charactersRoot, 'hero.png'), locationPath: locationPath!, designPath }
}

afterEach(async () => {
  process.chdir(originalCwd)
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('comic recovery binds current canonical references without materializing copies', () => {
  test('captures portable project inputs and validates canonical files without creating scene assets', async () => {
    const f = await fixture()
    const before = await filesBelow(f.workspace)
    const inputs = await captureComicImageRecoveryInputs(f.workspace, true)
    const canonical = inputs.filter(input => input.base === 'project')
    expect(canonical.map(input => input.path).sort()).toEqual([
      'input/characters/character-sketches.json', 'input/characters/characters-reference.json', 'input/characters/hero.png',
      'input/designs/console.png', 'input/locations/bridge.png', 'input/locations/location-sketches.json', 'input/locations/locations-reference.json',
    ])
    expect(inputs.every(input => !isAbsolute(input.path))).toBe(true)
    expect(inputs.filter(input => !input.base).map(input => input.path).sort()).toEqual(before)
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, inputs))).resolves.toBeUndefined()
    expect(await filesBelow(f.workspace)).toEqual(before)
    expect(existsSync(join(f.workspace, 'assets'))).toBe(false)
  })

  test('ignores obsolete snapshots and invalid old manifests rather than capturing or repairing them', async () => {
    const f = await fixture()
    const original = await captureComicImageRecoveryInputs(f.workspace)
    for (const kind of ['character', 'location', 'design']) {
      const directory = join(f.workspace, 'assets', `${kind}-references`, 'retired')
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'reference.png'), `obsolete-${kind}`)
      await writeFile(join(f.workspace, 'assets', `${kind}-references.json`), '{invalid obsolete manifest')
    }
    const files = await filesBelow(f.workspace)
    expect(await captureComicImageRecoveryInputs(f.workspace, true)).toEqual(original)
    expect(await filesBelow(f.workspace)).toEqual(files)
    await rm(join(f.workspace, 'assets'), { recursive: true })
    expect(await captureComicImageRecoveryInputs(f.workspace)).toEqual(original)
  })

  test('rebinds a replacement canonical character path and registration without rebuilding panel prompts', async () => {
    const f = await fixture()
    const original = await captureComicImageRecoveryInputs(f.workspace)
    const latestBytes = Buffer.concat([tinyPngFixture(), Buffer.from('latest character')])
    const catalogPath = join(f.charactersRoot, 'characters-reference.json')
    const catalog = await readJson(catalogPath)
    Object.assign(catalog.characters[0], { image: 'hero-latest.png', outlineSheet: 'hero-latest.png' })
    await writeJson(catalogPath, catalog)
    await writeFile(join(f.charactersRoot, 'hero-latest.png'), latestBytes)
    const manifestPath = join(f.charactersRoot, 'character-sketches.json')
    const manifest = await readJson(manifestPath)
    Object.assign(manifest.sketches[0], { generationId: 'latest-hero', sourceImage: 'hero-latest.png', outlineSheet: 'hero-latest.png', sourceSha256: sha256(latestBytes), sheetSha256: sha256(latestBytes) })
    await writeJson(manifestPath, manifest)
    const current = await captureComicImageRecoveryInputs(f.workspace)
    expect(current).toContainEqual({ base: 'project', path: 'input/characters/hero-latest.png', sha256: sha256(latestBytes) })
    expect(current.some(input => input.path === 'input/characters/hero.png')).toBe(false)
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, original))).rejects.toThrow('Comic recovery input changed')
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, current))).resolves.toBeUndefined()
    expect(existsSync(join(f.workspace, 'assets'))).toBe(false)
  })

  test('binds replacement canonical location bytes and every newly registered view', async () => {
    const f = await fixture()
    const original = await captureComicImageRecoveryInputs(f.workspace)
    const latest = Buffer.concat([tinyPngFixture(), Buffer.from('latest establishing')])
    const reverse = Buffer.concat([tinyPngFixture(), Buffer.from('latest reverse')])
    await writeFile(f.locationPath, latest)
    await writeFile(join(f.project, 'input/locations/bridge-reverse.png'), reverse)
    const manifestPath = join(f.project, 'input/locations/location-sketches.json')
    const manifest = await readJson(manifestPath)
    Object.assign(manifest.sketches[0].views[0], { imageSha256: sha256(latest), generationId: 'latest-establishing' })
    manifest.sketches[0].views.push({ ...manifest.sketches[0].views[0], view: 'reverse', image: 'bridge-reverse.png', imageSha256: sha256(reverse), generationId: 'latest-reverse' })
    await writeJson(manifestPath, manifest)
    const current = await captureComicImageRecoveryInputs(f.workspace)
    expect(current).toContainEqual({ base: 'project', path: 'input/locations/bridge.png', sha256: sha256(latest) })
    expect(current).toContainEqual({ base: 'project', path: 'input/locations/bridge-reverse.png', sha256: sha256(reverse) })
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, original))).rejects.toThrow('Comic recovery input changed')
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, current))).resolves.toBeUndefined()
  })

  test('detects current design replacement and rejects reuse of the previous captured bytes', async () => {
    const f = await fixture()
    const original = await captureComicImageRecoveryInputs(f.workspace)
    const latest = Buffer.concat([tinyPngFixture(), Buffer.from('latest console')])
    await writeFile(f.designPath, latest)
    const current = await captureComicImageRecoveryInputs(f.workspace)
    expect(current).toContainEqual({ base: 'project', path: 'input/designs/console.png', sha256: sha256(latest) })
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, original))).rejects.toThrow('Comic recovery input changed')
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, current))).resolves.toBeUndefined()
  })

  test('captures current descriptions, distinction cues, and location specifications without changing image registrations', async () => {
    const f = await fixture()
    const original = await captureComicImageRecoveryInputs(f.workspace)
    const catalogPath = join(f.charactersRoot, 'characters-reference.json')
    const catalog = await readJson(catalogPath)
    catalog.characters[0].description = 'The current captain wears a green coat.'
    await writeJson(catalogPath, catalog)
    const descriptionInputs = await captureComicImageRecoveryInputs(f.workspace)
    expect(descriptionInputs).not.toEqual(original)
    catalog.characters[0].distinguishFrom = [{ characterKey: 'rival', cue: 'Hero has the green coat; Rival has the red coat.' }]
    await writeJson(catalogPath, catalog)
    const cueInputs = await captureComicImageRecoveryInputs(f.workspace)
    expect(cueInputs).not.toEqual(descriptionInputs)
    const locationCatalogPath = join(f.project, 'input/locations/locations-reference.json')
    const locations = await readJson(locationCatalogPath)
    locations.locations[0].specification = 'The current bridge has a fixed console to the right of the door.'
    await writeJson(locationCatalogPath, locations)
    const specificationInputs = await captureComicImageRecoveryInputs(f.workspace)
    expect(specificationInputs).not.toEqual(cueInputs)
    expect(specificationInputs.find(input => input.path === 'input/characters/hero.png')).toEqual(original.find(input => input.path === 'input/characters/hero.png'))
    expect(specificationInputs.find(input => input.path === 'input/locations/bridge.png')).toEqual(original.find(input => input.path === 'input/locations/bridge.png'))
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, specificationInputs))).resolves.toBeUndefined()
    expect(existsSync(join(f.workspace, 'assets'))).toBe(false)
  })

  for (const kind of ['character', 'location']) test(`rejects unregistered changes to current ${kind} bytes during capture and validation`, async () => {
    const f = await fixture()
    const inputs = await captureComicImageRecoveryInputs(f.workspace)
    await writeFile(kind === 'character' ? f.heroPath : f.locationPath, 'unregistered replacement')
    await expect(captureComicImageRecoveryInputs(f.workspace)).rejects.toThrow(/stale|tampered|modified/)
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, inputs))).rejects.toThrow('Comic recovery input changed')
  })

  test('resolves project inputs against the project root rather than a matching workspace path', async () => {
    const f = await fixture()
    await mkdir(join(f.workspace, 'input/designs'), { recursive: true })
    await writeFile(join(f.workspace, 'input/designs/console.png'), 'workspace decoy')
    const inputs: ComicRecoveryInput[] = [{ base: 'project', path: 'input/designs/console.png', sha256: sha256(tinyPngFixture()) }]
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, inputs))).resolves.toBeUndefined()
    await writeFile(f.designPath, 'changed actual project source')
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, inputs))).rejects.toThrow('Comic recovery input changed')
  })

  test('rejects a project reference that traverses a symbolic link', async () => {
    const f = await fixture()
    const outside = join(f.project, 'outside.png')
    await writeFile(outside, tinyPngFixture())
    await symlink(outside, join(f.project, 'input/designs/alias.png'))
    const inputs: ComicRecoveryInput[] = [{ base: 'project', path: 'input/designs/alias.png', sha256: sha256(tinyPngFixture()) }]
    await expect(validateComicRecoveryInputs(f.workspace, intentFor(f.charactersRoot, inputs))).rejects.toThrow(/non-symlink file/)
  })
})

describe('comic recovery project-base parser compatibility', () => {
  const stateFor = (ref: unknown) => ({ image: intentFor(join(originalCwd, 'input/characters'), [ref as ComicRecoveryInput]) })

  test('accepts canonical project-relative inputs and existing workspace/absolute input forms', () => {
    for (const ref of [
      { base: 'project', path: 'input/characters/hero.png', sha256: 'b'.repeat(64) },
      { path: 'metadata/scene.json', sha256: 'b'.repeat(64) },
      { path: join(originalCwd, 'input/characters/hero.png'), sha256: 'b'.repeat(64) },
    ]) expect(isComicRecoveryState(stateFor(ref))).toBe(true)
  })

  for (const path of ['../outside.png', 'input/../outside.png', './input/hero.png', 'input//hero.png', 'input\\hero.png', '', '.', join(originalCwd, 'input/characters/hero.png')]) test(`rejects unsafe project-relative path ${JSON.stringify(path)}`, () => {
    expect(isComicRecoveryState(stateFor({ base: 'project', path, sha256: 'b'.repeat(64) }))).toBe(false)
  })

  for (const base of ['workspace', 'canonical', '', null, 1, {}, ['project']]) test(`rejects malformed base ${JSON.stringify(base)}`, () => {
    expect(isComicRecoveryState(stateFor({ base, path: 'input/characters/hero.png', sha256: 'b'.repeat(64) }))).toBe(false)
  })

  test('rejects malformed hashes and unrecognized input fields', () => {
    expect(isComicRecoveryState(stateFor({ base: 'project', path: 'input/characters/hero.png', sha256: 'invalid' }))).toBe(false)
    expect(isComicRecoveryState(stateFor({ base: 'project', path: 'input/characters/hero.png', sha256: 'b'.repeat(64), root: 'other' }))).toBe(false)
  })
})
