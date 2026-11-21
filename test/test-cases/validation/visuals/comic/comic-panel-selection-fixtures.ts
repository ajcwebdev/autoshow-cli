import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { deflateSync } from 'node:zlib'
import { createComicSourceIdentity } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import type { CharacterKey, ComicSourceIdentity, ScenePromptData, StructuredScriptData } from '~/types'

/** Scene slug shared by the panel selection, review and slideshow-input contracts. */
export const SELECTION_SCENE_SLUG = '01-selection-fixture'
export const SELECTION_SCRIPT_PATH = 'input/scripts/02-script/01-selection-fixture.md'

const cargo = { key: 'cargo-bay', raw: 'INT. CARGO BAY - MORNING', type: 'INT', place: 'CARGO BAY - MORNING' }

export const sha256Hex = (bytes: Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

export const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(Bun.hash.crc32(typeAndData) >>> 0)
  return Buffer.concat([length, typeAndData, crc])
}

/**
 * Encode a real, fully decodable 8-bit RGB PNG (valid CRCs and zlib data). `seed` changes every pixel so
 * different seeds give different bytes and hashes. Decoded integrity only; it says nothing about image content.
 */
export const makeTestPng = (options: { width?: number, height?: number, seed?: number } = {}): Buffer => {
  const width = options.width ?? 8
  const height = options.height ?? 6
  const seed = options.seed ?? 1
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const rows: number[] = []
  for (let y = 0; y < height; y++) {
    rows.push(0)
    for (let x = 0; x < width; x++) rows.push((seed * 37 + x * 11) & 0xff, (seed * 53 + y * 17) & 0xff, (seed * 97 + x + y) & 0xff)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from(rows))),
    pngChunk('IEND', new Uint8Array()),
  ])
}

export const encodeTestPngRows = (rows: number[], interlaced: boolean): Buffer => {
  const header = Buffer.alloc(13)
  header[8] = 8
  header[9] = 2
  header.writeUInt32BE(2, 0)
  header.writeUInt32BE(2, 4)
  header[12] = Number(interlaced)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(Buffer.from(rows))), pngChunk('IEND', Buffer.alloc(0))])
}

const selectionSourceIdentity = (): ComicSourceIdentity => {
  const base = { schemaVersion: 1 as const, canonicalPath: SELECTION_SCRIPT_PATH, scriptSlug: SELECTION_SCENE_SLUG, contentSha256: '0'.repeat(64) }
  return { ...base, identityHash: hashCanonicalTtsValue(base) }
}

export const buildSelectionStructuredScript = (panelCount: number): StructuredScriptData => ({
  schemaVersion: 5,
  scriptSlug: SELECTION_SCENE_SLUG,
  sourceFile: SELECTION_SCRIPT_PATH,
  sourceIdentity: selectionSourceIdentity(),
  document: { heading: 'Episode 2', title: 'Episode 2', metadata: [] },
  scene: { heading: 'SCENE 1: "Selection Fixture"', section: 'SCENE 1', title: 'Selection Fixture', location: cargo, soundscape: { cues: [], ambientBeds: [] } },
  characterKeys: ['hero' as CharacterKey],
  beats: [],
  sourceSegments: Array.from({ length: panelCount }, (_, index) => ({ id: `beat-${String(index + 1).padStart(4, '0')}`, type: 'direction' as const, text: `Beat ${index + 1} happens in the cargo bay.`, beatIndex: index + 1, sourceSpans: [], location: cargo })),
})

export const buildSelectionScene = (panelCount: number): ScenePromptData => ({
  schemaVersion: 4,
  title: 'Selection Fixture',
  location: 'INT. CARGO BAY - MORNING',
  panels: Array.from({ length: panelCount }, (_, index) => ({
    number: index + 1,
    description: `Authored staging ${index + 1}.`,
    shotPlan: `Medium eye-level shot ${index + 1}; hero is screen left, facing right; exclude all unlisted cast.`,
    characterKeys: ['hero' as CharacterKey],
    speech: [],
    sourceSegmentIds: [`beat-${String(index + 1).padStart(4, '0')}`],
    locationKey: 'cargo-bay',
    designReferences: [],
  })),
})

/** Write the reviewed scene and structured script that review, selection and the slideshow read. */
export const writeSelectionSceneInputs = async (workspace: string, panelCount: number, scriptPath?: string): Promise<{ scene: ScenePromptData, structuredScriptText: string }> => {
  await mkdir(join(workspace, 'metadata'), { recursive: true })
  const scene = buildSelectionScene(panelCount)
  const structured = buildSelectionStructuredScript(panelCount)
  if (scriptPath) {
    const source = structured.sourceSegments.map(segment => segment.text).join('\n\n')
    await writeFile(scriptPath, source)
    structured.sourceIdentity = await createComicSourceIdentity(scriptPath, source)
    structured.sourceFile = structured.sourceIdentity.canonicalPath
  }
  const structuredScriptText = `${JSON.stringify(structured, null, 2)}\n`
  await writeFile(join(workspace, 'metadata', 'scene.json'), `${JSON.stringify(scene, null, 2)}\n`)
  await writeFile(join(workspace, 'metadata', 'structured-script.json'), structuredScriptText)
  return { scene, structuredScriptText }
}

/** Write a run-scoped candidate at panels/<run>/panel-NN.png and return its workspace-relative path. */
export const writeRunCandidate = async (workspace: string, runDirectory: string, panelNumber: number, bytes: Uint8Array): Promise<string> => {
  const path = `panels/${runDirectory}/panel-${String(panelNumber).padStart(2, '0')}.png`
  await mkdir(dirname(join(workspace, path)), { recursive: true })
  await writeFile(join(workspace, path), bytes)
  return path
}

export const readBytes = async (path: string): Promise<Buffer> => Buffer.from(await Bun.file(path).arrayBuffer())

/**
 * Hash every file that defines the current selection: all of panels/ (canonical slots and run candidates)
 * and metadata/panel-selections.json. Two equal snapshots mean no selection, candidate or record changed.
 */
export const snapshotSelectionState = async (workspace: string): Promise<Record<string, string>> => {
  const snapshot: Record<string, string> = {}
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else snapshot[relative(workspace, path)] = sha256Hex(await readBytes(path))
    }
  }
  await walk(join(workspace, 'panels'))
  const store = join(workspace, 'metadata', 'panel-selections.json')
  if (await Bun.file(store).exists()) snapshot['metadata/panel-selections.json'] = sha256Hex(await readBytes(store))
  return snapshot
}
