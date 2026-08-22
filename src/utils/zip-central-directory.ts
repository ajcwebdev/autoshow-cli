import type { ZipArchiveOptions, ZipEntry } from '~/types'
import { ValidationError } from '~/utils/error-handler'

/**
 * Minimal ZIP central-directory reader. The document (DOCX/PPTX/XLSX/ODF) and EPUB paths each
 * carried a full hand-written copy of this format parser; they are now one implementation
 * parameterized by the caller's error stage and optional entry-name normalization.
 */

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LFH_SIG = 0x04034b50

const findEocd = (buffer: Buffer, stage: string): number => {
  const limit = Math.max(0, buffer.length - 65557)
  for (let idx = buffer.length - 22; idx >= limit; idx--) {
    if (buffer.readUInt32LE(idx) === EOCD_SIG) return idx
  }
  throw ValidationError('Not a valid ZIP file: End of Central Directory not found', { stage })
}

const readZipCentralDirectory = (buffer: Buffer, options: ZipArchiveOptions): ZipEntry[] => {
  const eocd = findEocd(buffer, options.stage)
  const count = buffer.readUInt16LE(eocd + 10)
  const offset = buffer.readUInt32LE(eocd + 16)

  const entries: ZipEntry[] = []
  let pos = offset
  for (let idx = 0; idx < count; idx++) {
    if (buffer.readUInt32LE(pos) !== CD_SIG) break

    const method = buffer.readUInt16LE(pos + 10)
    const compSize = buffer.readUInt32LE(pos + 20)
    const uncompSize = buffer.readUInt32LE(pos + 24)
    const fnLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)
    const localOffset = buffer.readUInt32LE(pos + 42)
    const name = buffer.subarray(pos + 46, pos + 46 + fnLen).toString('utf8')

    entries.push({
      name: options.normalizeEntryName ? options.normalizeEntryName(name) : name,
      method,
      compSize,
      uncompSize,
      localOffset
    })
    pos += 46 + fnLen + extraLen + commentLen
  }

  return entries
}

export const readZipEntryData = (buffer: Buffer, entry: ZipEntry, options: ZipArchiveOptions): Buffer => {
  const localPos = entry.localOffset
  if (buffer.readUInt32LE(localPos) !== LFH_SIG) {
    throw ValidationError(`Local file header missing for entry: ${entry.name}`, { stage: options.stage })
  }

  const nameLength = buffer.readUInt16LE(localPos + 26)
  const extraLength = buffer.readUInt16LE(localPos + 28)
  const dataStart = localPos + 30 + nameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compSize)

  if (entry.method === 0) return Buffer.from(compressed)
  if (entry.method === 8) return Buffer.from(Bun.inflateSync(Uint8Array.from(compressed), { windowBits: -15 }))
  throw ValidationError(`Unsupported ZIP compression method ${entry.method} for entry: ${entry.name}`, { stage: options.stage })
}

/**
 * `list` preserves central-directory order and any duplicate names; `entries` is the
 * by-name lookup, where a later duplicate wins. Callers that enumerate an archive want
 * `list`; callers that resolve a known path want `entries`.
 */
export const openZipArchive = async (
  filePath: string,
  options: ZipArchiveOptions
): Promise<{ buffer: Buffer, list: ZipEntry[], entries: Map<string, ZipEntry> }> => {
  const buffer = Buffer.from(await Bun.file(filePath).arrayBuffer())
  const list = readZipCentralDirectory(buffer, options)
  return { buffer, list, entries: new Map(list.map((entry) => [entry.name, entry])) }
}
