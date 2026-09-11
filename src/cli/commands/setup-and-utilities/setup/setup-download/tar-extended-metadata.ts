import type { ActiveTarEntry, PaxAttributes, TarMetadataState } from './tar-stream-types'
import { archiveError, readHeaderPath, readNullTerminated } from './tar-archive-guards'

const SUPPORTED_PAX_KEYS = new Set(['path', 'linkpath', 'size'])
const textDecoder = new TextDecoder('utf-8', { fatal: true })

const parsePaxAttributes = (bytes: Buffer): PaxAttributes => {
  const attributes: PaxAttributes = {}
  let offset = 0
  while (offset < bytes.byteLength) {
    const space = bytes.indexOf(0x20, offset)
    if (space === -1) throw archiveError('Malformed PAX record length.')
    const lengthText = bytes.subarray(offset, space).toString('ascii')
    if (!/^[1-9][0-9]*$/.test(lengthText)) throw archiveError('Malformed PAX record length.')
    const length = Number.parseInt(lengthText, 10)
    if (!Number.isSafeInteger(length) || length <= space - offset + 1 || offset + length > bytes.byteLength) {
      throw archiveError('Truncated PAX record.')
    }
    const record = bytes.subarray(space + 1, offset + length)
    if (record.at(-1) !== 0x0a) throw archiveError('Malformed PAX record terminator.')
    const equals = record.indexOf(0x3d)
    if (equals <= 0) throw archiveError('Malformed PAX key/value record.')
    let key: string
    try {
      key = textDecoder.decode(record.subarray(0, equals))
    } catch (error) {
      throw archiveError('PAX record key contains invalid UTF-8.', error)
    }
    if (SUPPORTED_PAX_KEYS.has(key)) {
      try {
        attributes[key] = textDecoder.decode(record.subarray(equals + 1, -1))
      } catch (error) {
        throw archiveError(`PAX ${key} value contains invalid UTF-8.`, error)
      }
    }
    offset += length
  }
  return attributes
}

const parsePaxSize = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw archiveError('PAX size is not a valid non-negative integer.')
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw archiveError('PAX size exceeds the supported integer range.')
  return parsed
}

const decodeLongMetadata = (chunks: Buffer[]): string => {
  const bytes = Buffer.concat(chunks)
  let end = bytes.byteLength
  while (end > 0 && (bytes[end - 1] === 0 || bytes[end - 1] === 0x0a)) end--
  try {
    return textDecoder.decode(bytes.subarray(0, end))
  } catch (error) {
    throw archiveError('GNU long-name metadata contains invalid UTF-8.', error)
  }
}

export const createTarMetadataState = (): TarMetadataState => ({
  globalPax: {}, nextPax: {}, nextLongPath: undefined, nextLongLink: undefined
})

export const applyTarExtendedMetadata = (entry: ActiveTarEntry, metadata: TarMetadataState): void => {
  const chunks = entry.metadataChunks
  if (!chunks) return
  if (entry.typeFlag === 'x') metadata.nextPax = parsePaxAttributes(Buffer.concat(chunks))
  if (entry.typeFlag === 'g') metadata.globalPax = { ...metadata.globalPax, ...parsePaxAttributes(Buffer.concat(chunks)) }
  if (entry.typeFlag === 'L') metadata.nextLongPath = decodeLongMetadata(chunks)
  if (entry.typeFlag === 'K') metadata.nextLongLink = decodeLongMetadata(chunks)
}

export const resolveTarEntryMetadata = (header: Buffer, headerSize: number, metadata: TarMetadataState) => {
  const attributes = { ...metadata.globalPax, ...metadata.nextPax }
  const rawPath = attributes['path'] ?? metadata.nextLongPath ?? readHeaderPath(header)
  const linkName = attributes['linkpath'] ?? metadata.nextLongLink ?? readNullTerminated(header, 157, 257)
  const size = parsePaxSize(attributes['size'], headerSize)
  metadata.nextPax = {}
  metadata.nextLongPath = undefined
  metadata.nextLongLink = undefined
  return { rawPath, linkName, size }
}

export const assertTarMetadataConsumed = (metadata: TarMetadataState): void => {
  if (Object.keys(metadata.nextPax).length > 0 || metadata.nextLongPath !== undefined || metadata.nextLongLink !== undefined) {
    throw archiveError('Tar archive ends with unapplied extended metadata.')
  }
}
