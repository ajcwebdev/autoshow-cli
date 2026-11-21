import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { specificationHash } from '~/cli/commands/visuals/comic/comic-utils/location-reference'
import { sha256Bytes } from '~/utils/value-helpers'
import { toProjectRelativePath } from '~/utils/project-root'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { UsageError } from '~/utils/error-handler'

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

if (import.meta.main) {
  const args = process.argv.slice(2)
  let root = HARBORLIGHT_COMIC_ROOT, rootSet = false
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root' && !rootSet && args[index + 1] && !args[index + 1]!.startsWith('--')) { root = args[++index]!; rootSet = true }
    else throw UsageError('Usage: bun src/tools/prepare-harborlight-comic.ts [--root runtime/examples/<name>]')
  }
  const rel = relative(resolve('runtime/examples'), resolve(root))
  if (isAbsolute(root) || !rel || rel.startsWith('..') || isAbsolute(rel)) throw UsageError('Choose an unused relative directory beneath runtime/examples')
  await prepareHarborlightComic(root)
  writeCommandPayload(`Original inputs prepared: ${root}; no provider calls or approvals\n`)
}
