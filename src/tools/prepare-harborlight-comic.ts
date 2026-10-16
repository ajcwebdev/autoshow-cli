import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { BlockingPlan, CanonicalComicItemMetadata, StructuredScriptData } from '~/types'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { hashSourceSegmentText } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-validation'
import { specificationHash } from '~/cli/commands/visuals/comic/comic-utils/location-reference'
import { sha256Bytes } from '~/utils/value-helpers'
import { toProjectRelativePath } from '~/utils/project-root'
import { verifyImageArtifact } from './verify-image-artifact'

export const HARBORLIGHT_COMIC_ROOT = 'runtime/examples/harborlight-comic'
export const HARBORLIGHT_COMIC_SOURCE = 'input/examples/comic/harborlight'
export const HARBORLIGHT_LOCATION_SPECIFICATION = 'A woodland campsite has a circular stone fire ring at its center, a fixed timber bench to the north, and a narrow path running north behind the bench between two tall pine trees. The open southern approach provides a clear view of the ring, bench, and path. No buildings or installed equipment are present.'

/** Copy authored inputs only; never create provider receipts, approvals, or generated outputs. */
export const prepareHarborlightComic = async (root = HARBORLIGHT_COMIC_ROOT): Promise<void> => {
  await mkdir(dirname(root), { recursive: true })
  await mkdir(root) // Refuse existing destinations, including interrupted preparations.
  const characters = join(root, 'characters'), locations = join(root, 'locations')
  await Promise.all([mkdir(characters), mkdir(locations), mkdir(join(root, '02-script'))])
  for (const name of ['papa-bear', 'mira']) await copyFile(join(HARBORLIGHT_COMIC_SOURCE, `${name}.png`), join(characters, `${name}.png`), constants.COPYFILE_EXCL)
  await copyFile(join(HARBORLIGHT_COMIC_SOURCE, '02-script/01-harborlight-camp.md'), join(root, '02-script/01-harborlight-camp.md'), constants.COPYFILE_EXCL)
  await copyFile(join(HARBORLIGHT_COMIC_SOURCE, 'review-notes.md'), join(root, 'review-notes.md'), constants.COPYFILE_EXCL)
  const image = join(locations, 'harborlight-camp--reference.png')
  await copyFile(join(HARBORLIGHT_COMIC_SOURCE, 'harborlight-camp.png'), image, constants.COPYFILE_EXCL)
  const json = async (path: string, value: unknown) => await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  await json(join(root, 'empty-config.json'), {})
  await json(join(characters, 'characters-reference.json'), { schemaVersion: 3, characters: [
    { key: 'papa-bear', name: 'Papa Bear', aliases: ['PAPA BEAR'], image: 'papa-bear.png', outlineSheet: 'papa-bear.png', description: 'Adult human guide with gray hair and beard, rust-orange field coat, navy trousers and brown boots. Papa Bear is a nickname, never an animal.' },
    { key: 'mira', name: 'Mira', aliases: ['MIRA'], image: 'mira.png', outlineSheet: 'mira.png', description: 'Adult human with brown skin, straight dark shoulder-length hair, round gold glasses, teal jacket, navy trousers and brown boots.' },
  ], groupAliases: [] })
  const sketches = await Promise.all(['papa-bear', 'mira'].map(async characterKey => {
    const sha256 = sha256Bytes(new Uint8Array(await readFile(join(characters, `${characterKey}.png`))))
    return { characterKey, generationId: `harborlight-original-${characterKey}-v1`, origin: 'legacy-import', sourceImage: `${characterKey}.png`, outlineSheet: `${characterKey}.png`, sourceSha256: sha256, sheetSha256: sha256, model: null, createdAt: '2026-10-15T00:00:00.000Z' }
  }))
  await json(join(characters, 'character-sketches.json'), { schemaVersion: 1, sketches })
  await json(join(locations, 'locations-reference.json'), { schemaVersion: 1, styleImage: 'harborlight-camp--reference.png', locations: [{ key: 'harborlight-camp', name: 'Harborlight Camp', aliases: ['EXT. HARBORLIGHT CAMP - DUSK'], specification: HARBORLIGHT_LOCATION_SPECIFICATION, sourceScripts: [toProjectRelativePath(join(root, '02-script/01-harborlight-camp.md'))] }] })
  await json(join(locations, 'location-sketches.json'), { schemaVersion: 2, sketches: [{ locationKey: 'harborlight-camp', specificationSha256: specificationHash(HARBORLIGHT_LOCATION_SPECIFICATION), views: [{ view: 'establishing', generationId: 'harborlight-original-art-v1', image: 'harborlight-camp--reference.png', imageSha256: sha256Bytes(new Uint8Array(await readFile(image))), model: 'existing-canonical-art', createdAt: '2026-10-15T00:00:00.000Z', lineage: 'clean' }] }] })
}

/** Authored geometry; citations come from the actual local parser output. */
export const buildHarborlightBlockingPlan = (script: StructuredScriptData, structuredBytes: string): BlockingPlan => {
  const first = script.sourceSegments[0]
  if (!first || !script.characterKeys.includes('papa-bear') || !script.characterKeys.includes('mira')) throw new Error('Expected the original Harborlight two-speaker structured script')
  const citation = { sourceSegmentId: first.id, sourceSegmentSha256: hashSourceSegmentText(first.text) }
  return {
    schemaVersion: 1, sceneSlug: script.scriptSlug, structuredScriptSha256: sha256Bytes(structuredBytes), generatedBy: { mode: 'import', model: null },
    locations: [{ locationKey: 'harborlight-camp', specificationSha256: specificationHash(HARBORLIGHT_LOCATION_SPECIFICATION), geometrySource: 'specification', anchors: [
      { key: 'stone fire ring', position: { x: 0, y: 1 }, footprint: { width: 1, depth: 1 }, wall: 'floor', facingDeg: null, longAxis: null },
      { key: 'timber bench', position: { x: 0, y: 3 }, footprint: { width: 3, depth: 0.5 }, wall: 'floor', facingDeg: 180, longAxis: 'x' },
    ], suppressedAnchors: [], dressing: [], cameraCells: [] }],
    stageStates: [{ id: 'lantern-path', locationKey: 'harborlight-camp', startsAt: citation, characters: [
      { characterKey: 'papa-bear', position: { x: -1, y: 0 }, facingDeg: 90, posture: 'standing', seatAnchorKey: null, wardrobe: 'canonical', wardrobeCitation: null },
      { characterKey: 'mira', position: { x: 1, y: 0 }, facingDeg: 270, posture: 'standing', seatAnchorKey: null, wardrobe: 'canonical', wardrobeCitation: null },
    ], extras: [], actionAxis: { from: 'papa-bear', to: 'mira', establishedSide: null }, dressing: 'One portable lantern passes between the two adults; no extra people.', moves: [] }],
    cameraSetups: [{ id: 'path-side-wide', locationKey: 'harborlight-camp', position: { x: 0, y: -4 }, heightM: 1.6, target: { x: 0, y: 1 }, lens: 'normal', framing: 'wide', elevation: 'eye', overShoulderOf: null }],
  }
}

export const writeHarborlightBlockingPlan = async (root = HARBORLIGHT_COMIC_ROOT): Promise<void> => {
  const bytes = await readFile(join(root, 'run/metadata/structured-script.json'), 'utf8')
  await writeFile(join(root, 'blocking-plan.json'), `${JSON.stringify(buildHarborlightBlockingPlan(JSON.parse(bytes) as StructuredScriptData, bytes), null, 2)}\n`, { flag: 'wx' })
}

/** Explicit local publication after human review; keep every generated candidate and never replace canonical files. */
export const publishHarborlightPanels = async (root: string, imageRunId: string): Promise<void> => {
  if (!/^[a-zA-Z0-9_-]+$/.test(imageRunId)) throw new Error('Expected a single image run ID, without path separators')
  const run = join(root, 'run'), manifest = await readManifest(run), item = manifest?.items[0]
  if (manifest?.command !== 'comic' || manifest.items.length !== 1 || !item) throw new Error('Expected the canonical Harborlight comic manifest')
  const providers = item.providers.filter(provider => provider.operation === 'comic-image')
  const selected = providers[0], local = selected?.settings?.local
  if (providers.length !== 1 || selected?.status !== 'succeeded' || selected.metadata?.['runId'] !== imageRunId || selected.options?.['panelsPerImage'] !== 1 || !['images', 'both'].includes(String(selected.options?.['target'])) || local?.['grid'] || local?.['variations'] || (local?.['panels'] !== undefined && local['panels'] !== 'all')) throw new Error('Select one completed single-model canonical individual-panel run covering all four panels, without grid or variations')
  const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
  const scene = JSON.parse(await readFile(join(run, 'metadata/scene.json'), 'utf8')) as { panels?: Array<{ number: number }> }
  if (scene.panels?.length !== 4 || scene.panels.some((panel, index) => panel.number !== index + 1)) throw new Error('Expected the reviewed four-panel Harborlight scene')
  const paths = await Promise.all(scene.panels.map(async panel => {
    const filename = `panel-${String(panel.number).padStart(2, '0')}.png`, source = `panels/${imageRunId}/${filename}`, destination = join(run, 'panels', filename)
    const artifact = comic.stages.image.artifactRefs?.find(ref => ref.path === source)
    const verified = await verifyImageArtifact(join(run, source))
    if (!artifact || artifact.sha256 !== verified.sha256 || verified.width! % 2 || verified.height! % 2) throw new Error(`Selected panel is stale or has incompatible dimensions: ${source}`)
    try { await lstat(destination); throw new Error(`Canonical panel already exists; preserve it: ${toProjectRelativePath(destination)}`) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return { source: join(run, source), destination, width: verified.width, height: verified.height }
  }))
  if (paths.some(path => path.width !== paths[0]!.width || path.height !== paths[0]!.height)) throw new Error('All four selected panels must have matching dimensions')
  // Every source, hash, full decode, dimension and destination is checked before the first copy.
  for (const path of paths) await copyFile(path.source, path.destination, constants.COPYFILE_EXCL)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  let plan = false, root = HARBORLIGHT_COMIC_ROOT, rootSet = false, imageRunId: string | undefined
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--plan' && !plan) plan = true
    else if (args[index] === '--root' && !rootSet && args[index + 1] && !args[index + 1]!.startsWith('--')) { root = args[++index]!; rootSet = true }
    else if (args[index] === '--publish-panels' && imageRunId === undefined && args[index + 1] && !args[index + 1]!.startsWith('--')) imageRunId = args[++index]!
    else throw new Error('Usage: bun src/tools/prepare-harborlight-comic.ts [--root runtime/examples/<name>] [--plan | --publish-panels <reviewed-image-run-id>]')
  }
  if (plan && imageRunId !== undefined) throw new Error('Choose either --plan or --publish-panels')
  const rel = relative(resolve('runtime/examples'), resolve(root))
  if (isAbsolute(root) || !rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Choose an unused relative directory beneath runtime/examples')
  if (imageRunId !== undefined) await publishHarborlightPanels(root, imageRunId)
  else if (plan) await writeHarborlightBlockingPlan(root)
  else await prepareHarborlightComic(root)
  console.log(imageRunId !== undefined ? `Reviewed panels published locally from ${imageRunId}; original candidates retained` : plan ? `Authored blocking plan written: ${root}/blocking-plan.json` : `Original inputs prepared: ${root}; no provider calls or approvals`)
}
