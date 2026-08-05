import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { CharacterReferenceManifest } from './character-reference-snapshot'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getCharacterReferencesDirectory } from './project-paths'

export type CharacterIdentityReference = {
  key: string
  name: string
  description: string
  referenceIndex: number
  path: string
}

type IdentityCardMetadata = {
  schemaVersion: 1
  characterKey: string
  sourceHash: string
  width: 1536
  height: 1024
}

const hashFile = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')
const GLYPHS: Record<string, string[]> = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'], C:['01111','10000','10000','10000','10000','10000','01111'], D:['11110','10001','10001','10001','10001','10001','11110'], E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'], G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'], I:['11111','00100','00100','00100','00100','00100','11111'], J:['00111','00010','00010','00010','10010','10010','01100'], K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'], M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','10101','10011','10001','10001','10001'], O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'], Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'], S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'], U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'], W:['10001','10001','10001','10101','10101','10101','01010'], X:['10001','10001','01010','00100','01010','10001','10001'], Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'], '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'], '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','10000','11110','00001','00001','11110'], '6':['01110','10000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'], '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'], ':':['00000','00100','00100','00000','00100','00100','00000'], ' ':['00000','00000','00000','00000','00000','00000','00000'],
}

const bitmapLabelDraw = (value: string): string => {
  const pixel = 8
  const advance = 48
  const xStart = 42
  const yStart = 40
  const rectangles: string[] = []
  for (const [characterIndex, character] of Array.from(value.toUpperCase()).entries()) {
    const glyph = GLYPHS[character] ?? GLYPHS[' ' ]!
    glyph.forEach((row, rowIndex) => Array.from(row).forEach((bit, columnIndex) => {
      if (bit !== '1') return
      const x = xStart + characterIndex * advance + columnIndex * pixel
      const y = yStart + rowIndex * pixel
      rectangles.push(`rectangle ${x},${y} ${x + pixel - 1},${y + pixel - 1}`)
    }))
  }
  return rectangles.join(' ')
}

const resolveMagick = (): string => {
  for (const command of ['magick', 'convert']) {
    const result = spawnSync(command, ['-version'], { stdio: 'ignore' })
    if (result.status === 0) return command
  }
  throw InfraError('Comic identity-card composition requires ImageMagick (`magick` or `convert`).', { stage: 'comic:identity-card' })
}

const getSources = (runDirectory: string, character: CharacterReferenceManifest['characters'][number]) => {
  const sheet = character.assets.find(asset => asset.role === 'sketch-sheet')
  const source = character.assets.find(asset => asset.role === 'source-image')
  if (!sheet || !source) {
    throw ValidationError(`Snapshot character "${character.key}" is missing its canonical character reference.`, { stage: 'comic:identity-card' })
  }
  return { sheetPath: resolve(runDirectory, sheet.path), sourcePath: resolve(runDirectory, source.path) }
}

export const getCharacterIdentityCardPath = (
  runDirectory: string,
  manifest: CharacterReferenceManifest,
  characterKey: string,
): string => {
  const characterIndex = manifest.characters.findIndex(character => character.key === characterKey)
  if (characterIndex < 0) {
    throw ValidationError(`Snapshot ${manifest.snapshotId} does not contain required character "${characterKey}"`, { stage: 'comic:identity-card' })
  }
  return join(
    getCharacterReferencesDirectory(runDirectory),
    manifest.snapshotId,
    'identity-cards',
    `${String(characterIndex + 1).padStart(2, '0')}-${characterKey}-identity-card.png`,
  )
}

export const ensureCharacterIdentityCardSync = (
  runDirectory: string,
  manifest: CharacterReferenceManifest,
  characterKey: string,
): string => {
  const character = manifest.characters.find(candidate => candidate.key === characterKey)
  if (!character) {
    throw ValidationError(`Snapshot ${manifest.snapshotId} does not contain required character "${characterKey}"`, { stage: 'comic:identity-card' })
  }
  const outputPath = getCharacterIdentityCardPath(runDirectory, manifest, characterKey)
  const metadataPath = `${outputPath}.json`
  const { sheetPath, sourcePath } = getSources(runDirectory, character)
  if (sheetPath === sourcePath) return sheetPath
  const sourceHash = createHash('sha256')
    .update(character.key).update('\0')
    .update(hashFile(sourcePath)).update('\0')
    .update(hashFile(sheetPath)).update('\0')
    .update('identity-card-v2-1536x1024-isolated-input-resize')
    .digest('hex')

  if (existsSync(outputPath) && existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as IdentityCardMetadata
      if (metadata.schemaVersion === 1 && metadata.characterKey === characterKey && metadata.sourceHash === sourceHash) {
        return outputPath
      }
    } catch {}
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const tempPath = `${outputPath}.tmp-${process.pid}.png`
  const command = resolveMagick()
  const label = `CHARACTER KEY: ${character.key}`
  const result = spawnSync(command, [
    '-size', '1536x1024', 'xc:#f4f0e8',
    '(', sourcePath, '-resize', '480x824>', ')', '-gravity', 'southwest', '-geometry', '+32+32', '-composite',
    '(', sheetPath, '-resize', '960x824>', ')', '-gravity', 'southeast', '-geometry', '+32+32', '-composite',
    '-fill', '#172033', '-draw', 'rectangle 0,0 1536,168',
    '-fill', 'white', '-draw', bitmapLabelDraw(label),
    '-strip', '-define', 'png:exclude-chunk=date,time', tempPath,
  ], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw InfraError(`ImageMagick failed to compose ${basename(outputPath)}: ${result.stderr || result.stdout}`, { stage: 'comic:identity-card' })
  }
  renameSync(tempPath, outputPath)
  const metadata: IdentityCardMetadata = { schemaVersion: 1, characterKey, sourceHash, width: 1536, height: 1024 }
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  return outputPath
}

export const resolveCharacterIdentityReferences = (
  runDirectory: string,
  manifest: CharacterReferenceManifest,
  characterKeys: readonly string[],
  options: { compose?: boolean } = {},
): CharacterIdentityReference[] => {
  const byKey = new Map(manifest.characters.map(character => [character.key, character]))
  const seen = new Set<string>()
  const references: CharacterIdentityReference[] = []
  for (const key of characterKeys) {
    if (seen.has(key)) continue
    seen.add(key)
    const character = byKey.get(key)
    if (!character) throw ValidationError(`Snapshot ${manifest.snapshotId} does not contain required character "${key}"`, { stage: 'comic:identity-card' })
    const sources = getSources(runDirectory, character)
    const path = sources.sheetPath === sources.sourcePath
      ? sources.sheetPath
      : options.compose === false
        ? getCharacterIdentityCardPath(runDirectory, manifest, key)
        : ensureCharacterIdentityCardSync(runDirectory, manifest, key)
    references.push({ key, name: character.name, description: character.description, referenceIndex: references.length + 1, path })
  }
  return references
}
