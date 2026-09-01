import { constants } from 'node:fs'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rename,
  rm,
  rmdir,
  symlink,
  type FileHandle
} from 'node:fs/promises'
import { basename, dirname, join, posix, resolve } from 'node:path'
import { ValidationError, hasErrorCode } from '~/utils/error-handler'
import type { TarGzExtractOptions } from '~/types'

const BLOCK_SIZE = 512
const DEFAULT_MAX_COMPRESSED_BYTES = 4 * 1024 * 1024 * 1024
const DEFAULT_MAX_EXPANDED_BYTES = 16 * 1024 * 1024 * 1024
const DEFAULT_MAX_ENTRY_BYTES = 8 * 1024 * 1024 * 1024
const DEFAULT_MAX_ENTRIES = 1_000_000
const MAX_METADATA_BYTES = 1024 * 1024
const SUPPORTED_PAX_KEYS = new Set(['path', 'linkpath', 'size'])

const textDecoder = new TextDecoder('utf-8', { fatal: true })

type PaxAttributes = Record<string, string>

type TarPayloadWrite = (payload: Uint8Array) => Promise<number>

type ActiveTarEntry = {
  typeFlag: string
  remaining: number
  paddingRemaining: number
  payloadFinished?: boolean | undefined
  handle?: FileHandle | undefined
  mode?: number | undefined
  path?: string | undefined
  metadataChunks?: Buffer[] | undefined
}

const archiveError = (message: string, cause?: unknown): Error =>
  ValidationError(message, {
    stage: 'setup:tar-gz',
    ...(cause instanceof Error ? { cause } : {})
  })

export const writeTarPayloadFully = async (
  payload: Uint8Array,
  write: TarPayloadWrite
): Promise<void> => {
  let offset = 0
  while (offset < payload.byteLength) {
    const remaining = payload.subarray(offset)
    const bytesWritten = await write(remaining)
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > remaining.byteLength) {
      throw archiveError(`Tar extraction file write returned an invalid byte count: ${bytesWritten}`)
    }
    offset += bytesWritten
  }
}

const isZeroBlock = (block: Uint8Array): boolean => {
  for (const byte of block) {
    if (byte !== 0) return false
  }
  return true
}

const readNullTerminated = (buffer: Uint8Array, start: number, end: number): string => {
  let stop = start
  while (stop < end && buffer[stop] !== 0) stop++
  try {
    return textDecoder.decode(buffer.subarray(start, stop))
  } catch (error) {
    throw archiveError('Tar header contains invalid UTF-8 text.', error)
  }
}

const readTarNumber = (buffer: Uint8Array, start: number, end: number, label: string): number => {
  const field = buffer.subarray(start, end)
  if ((field[0] ?? 0) & 0x80) {
    let value = BigInt((field[0] ?? 0) & 0x7f)
    for (const byte of field.subarray(1)) value = (value << 8n) | BigInt(byte)
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw archiveError(`Tar ${label} exceeds the supported integer range.`)
    return Number(value)
  }
  const raw = readNullTerminated(buffer, start, end).replace(/\0/g, '').trim()
  if (raw.length === 0) return 0
  if (!/^[0-7]+$/.test(raw)) throw archiveError(`Tar ${label} is not a valid octal number.`)
  const parsed = Number.parseInt(raw, 8)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw archiveError(`Tar ${label} is outside the supported range.`)
  return parsed
}

const assertHeaderChecksum = (header: Uint8Array): void => {
  const expected = readTarNumber(header, 148, 156, 'header checksum')
  let actual = 0
  for (let index = 0; index < header.byteLength; index++) {
    actual += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0)
  }
  if (expected !== actual) throw archiveError(`Malformed tar header checksum: expected ${expected}, calculated ${actual}.`)
}

const roundToBlock = (size: number): number => Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE

const readHeaderPath = (header: Uint8Array): string => {
  const name = readNullTerminated(header, 0, 100)
  const prefix = readNullTerminated(header, 345, 500)
  return prefix ? `${prefix}/${name}` : name
}

const assertPortableArchivePath = (path: string, label: string): void => {
  if (path.includes('\0')) throw archiveError(`${label} contains a NUL byte.`)
  if (path.includes('\\')) throw archiveError(`${label} uses a Windows-style separator: ${path}`)
  if (posix.isAbsolute(path) || /^[A-Za-z]:/.test(path)) throw archiveError(`${label} is absolute: ${path}`)
  if (path.split('/').some((segment) => segment === '..')) throw archiveError(`${label} contains traversal: ${path}`)
}

const sanitizeArchivePath = (path: string, stripComponents: number): string | null => {
  assertPortableArchivePath(path, 'Unsafe tar path rejected')
  const components = path.replace(/^(?:\.\/)+/, '').split('/').filter((component) => component.length > 0 && component !== '.')
  const stripped = components.slice(stripComponents)
  if (stripped.length === 0) return null
  const result = posix.normalize(stripped.join('/'))
  assertPortableArchivePath(result, 'Unsafe tar path rejected after strip-components')
  return result === '.' ? null : result
}

const assertSafeSymlinkTarget = (target: string, linkPath: string): void => {
  if (target.length === 0) throw archiveError(`Unsafe tar symlink target rejected for ${linkPath}: empty target`)
  if (target.includes('\0') || target.includes('\\') || posix.isAbsolute(target) || /^[A-Za-z]:/.test(target)) {
    throw archiveError(`Unsafe tar symlink target rejected: ${target}`)
  }
  const resolvedTarget = posix.normalize(posix.join(posix.dirname(linkPath), target))
  if (resolvedTarget === '..' || resolvedTarget.startsWith('../')) {
    throw archiveError(`Unsafe tar symlink target rejected: ${target}`)
  }
}

const assertNoSymlinkAncestor = (path: string, symlinkPaths: Set<string>): void => {
  const segments = path.split('/')
  let parent = ''
  for (const segment of segments.slice(0, -1)) {
    parent = parent ? `${parent}/${segment}` : segment
    if (symlinkPaths.has(parent)) throw archiveError(`Tar entry traverses an archived symlink: ${path}`)
  }
}

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

const assertEmptyDestination = async (destination: string): Promise<boolean> => {
  try {
    const entry = await lstat(destination)
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw archiveError(`Tar extraction destination is not a safe directory: ${destination}`)
    if ((await readdir(destination)).length > 0) throw archiveError(`Tar extraction destination must be empty: ${destination}`)
    return true
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return false
    throw error
  }
}

const extractTarStreamInto = async (
  compressedStream: ReadableStream<Uint8Array>,
  stagingRoot: string,
  options: TarGzExtractOptions
): Promise<void> => {
  const stripComponents = Math.max(0, Math.floor(options.stripComponents ?? 0))
  const maxExpandedBytes = options.maxExpandedBytes ?? DEFAULT_MAX_EXPANDED_BYTES
  const maxEntryBytes = options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const expandedStream = compressedStream.pipeThrough(
    new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>
  )
  const seenPaths = new Set<string>()
  const symlinkPaths = new Set<string>()
  const directoryModes: Array<{ path: string, mode: number }> = []
  let globalPax: PaxAttributes = {}
  let nextPax: PaxAttributes = {}
  let nextLongPath: string | undefined
  let nextLongLink: string | undefined
  let active: ActiveTarEntry | undefined
  let buffered = Buffer.alloc(0)
  let expandedBytes = 0
  let entryCount = 0
  let zeroBlocks = 0
  let complete = false

  const finishActivePayload = async (entry: ActiveTarEntry): Promise<void> => {
    if (entry.handle) {
      await entry.handle.close()
      entry.handle = undefined
      if (entry.path && entry.mode !== undefined) await chmod(entry.path, entry.mode & 0o777)
    }
    const chunks = entry.metadataChunks
    if (!chunks) return
    if (entry.typeFlag === 'x') nextPax = parsePaxAttributes(Buffer.concat(chunks))
    if (entry.typeFlag === 'g') globalPax = { ...globalPax, ...parsePaxAttributes(Buffer.concat(chunks)) }
    if (entry.typeFlag === 'L') nextLongPath = decodeLongMetadata(chunks)
    if (entry.typeFlag === 'K') nextLongLink = decodeLongMetadata(chunks)
  }

  const startEntry = async (header: Buffer): Promise<ActiveTarEntry> => {
    assertHeaderChecksum(header)
    const headerSize = readTarNumber(header, 124, 136, 'entry size')
    const typeFlag = String.fromCharCode(header[156] ?? 0)
    if (typeFlag === 'x' || typeFlag === 'g' || typeFlag === 'L' || typeFlag === 'K') {
      if (headerSize > MAX_METADATA_BYTES) throw archiveError(`Tar metadata entry exceeds ${MAX_METADATA_BYTES} bytes.`)
      return {
        typeFlag,
        remaining: headerSize,
        paddingRemaining: roundToBlock(headerSize) - headerSize,
        metadataChunks: []
      }
    }

    entryCount++
    if (entryCount > maxEntries) throw archiveError(`Tar archive exceeds the ${maxEntries} entry limit.`)
    const attributes = { ...globalPax, ...nextPax }
    const rawPath = attributes['path'] ?? nextLongPath ?? readHeaderPath(header)
    const linkName = attributes['linkpath'] ?? nextLongLink ?? readNullTerminated(header, 157, 257)
    const size = parsePaxSize(attributes['size'], headerSize)
    nextPax = {}
    nextLongPath = undefined
    nextLongLink = undefined
    if (size > maxEntryBytes) throw archiveError(`Tar entry exceeds the ${maxEntryBytes} byte limit: ${rawPath}`)
    const relativePath = sanitizeArchivePath(rawPath, stripComponents)
    if (!relativePath) return { typeFlag, remaining: size, paddingRemaining: roundToBlock(size) - size }
    if (seenPaths.has(relativePath)) throw archiveError(`Duplicate tar target rejected: ${relativePath}`)
    assertNoSymlinkAncestor(relativePath, symlinkPaths)
    seenPaths.add(relativePath)
    const destinationPath = join(stagingRoot, relativePath)
    const mode = readTarNumber(header, 100, 108, 'entry mode') & 0o777

    if (typeFlag === '1') throw archiveError(`Tar hard links are not supported: ${relativePath}`)
    if (typeFlag === '5') {
      if (size !== 0) throw archiveError(`Tar directory contains an unexpected payload: ${relativePath}`)
      await mkdir(destinationPath, { recursive: true, mode: mode | 0o700 })
      directoryModes.push({ path: destinationPath, mode })
      return { typeFlag, remaining: 0, paddingRemaining: 0 }
    }
    if (typeFlag === '2') {
      if (size !== 0) throw archiveError(`Tar symlink contains an unexpected payload: ${relativePath}`)
      assertSafeSymlinkTarget(linkName, relativePath)
      await mkdir(dirname(destinationPath), { recursive: true })
      await symlink(linkName, destinationPath)
      symlinkPaths.add(relativePath)
      return { typeFlag, remaining: 0, paddingRemaining: 0 }
    }
    if (typeFlag !== '0' && typeFlag !== '\0' && typeFlag !== '7') {
      throw archiveError(`Unsupported tar entry type ${JSON.stringify(typeFlag)} for ${relativePath}`)
    }
    await mkdir(dirname(destinationPath), { recursive: true })
    const handle = await open(
      destinationPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      mode || 0o600
    )
    return {
      typeFlag,
      remaining: size,
      paddingRemaining: roundToBlock(size) - size,
      handle,
      mode,
      path: destinationPath
    }
  }

  try {
    for await (const chunk of expandedStream) {
      expandedBytes += chunk.byteLength
      if (expandedBytes > maxExpandedBytes) throw archiveError(`Expanded tar archive exceeds the ${maxExpandedBytes} byte limit.`)
      buffered = buffered.byteLength === 0 ? Buffer.from(chunk) : Buffer.concat([buffered, chunk])

      while (buffered.byteLength > 0) {
        if (complete) {
          if (!isZeroBlock(buffered)) throw archiveError('Tar archive contains non-zero trailing bytes after its end marker.')
          buffered = Buffer.alloc(0)
          break
        }
        if (active) {
          if (active.remaining > 0) {
            const count = Math.min(active.remaining, buffered.byteLength)
            const payload = buffered.subarray(0, count)
            if (active.handle) {
              const handle = active.handle
              await writeTarPayloadFully(payload, async (remaining) => {
                const { bytesWritten } = await handle.write(remaining)
                return bytesWritten
              })
            }
            if (active.metadataChunks) active.metadataChunks.push(Buffer.from(payload))
            active.remaining -= count
            buffered = buffered.subarray(count)
            if (active.remaining > 0) break
          }
          if (!active.payloadFinished) {
            await finishActivePayload(active)
            active.payloadFinished = true
          }
          if (active.paddingRemaining > 0) {
            const count = Math.min(active.paddingRemaining, buffered.byteLength)
            const padding = buffered.subarray(0, count)
            if (!isZeroBlock(padding)) throw archiveError('Tar entry padding contains non-zero bytes.')
            active.paddingRemaining -= count
            buffered = buffered.subarray(count)
            if (active.paddingRemaining > 0) break
          }
          active = undefined
          continue
        }
        if (buffered.byteLength < BLOCK_SIZE) break
        const header = buffered.subarray(0, BLOCK_SIZE)
        buffered = buffered.subarray(BLOCK_SIZE)
        if (isZeroBlock(header)) {
          zeroBlocks++
          if (zeroBlocks === 2) complete = true
          continue
        }
        if (zeroBlocks !== 0) throw archiveError('Tar archive contains data after an incomplete end marker.')
        active = await startEntry(header)
      }
    }
  } finally {
    if (active?.handle) await active.handle.close().catch(() => undefined)
  }

  if (active || buffered.byteLength !== 0 || !complete) throw archiveError('Truncated tar archive rejected.')
  if (Object.keys(nextPax).length > 0 || nextLongPath !== undefined || nextLongLink !== undefined) {
    throw archiveError('Tar archive ends with unapplied extended metadata.')
  }
  for (const directory of directoryModes.reverse()) await chmod(directory.path, directory.mode & 0o777)
}

const extractTarGzStream = async (
  compressedStream: ReadableStream<Uint8Array>,
  compressedBytes: number,
  options: TarGzExtractOptions
): Promise<void> => {
  const maxCompressedBytes = options.maxCompressedBytes ?? DEFAULT_MAX_COMPRESSED_BYTES
  if (compressedBytes > maxCompressedBytes) throw archiveError(`Compressed tar archive exceeds the ${maxCompressedBytes} byte limit.`)
  const destination = resolve(options.destination)
  const parent = dirname(destination)
  await mkdir(parent, { recursive: true })
  const destinationWasEmpty = await assertEmptyDestination(destination)
  const stagingDirectory = await mkdtemp(join(parent, `.${basename(destination)}.tar-stage-`))
  const stagingRoot = join(stagingDirectory, 'root')
  await mkdir(stagingRoot)
  let removedEmptyDestination = false
  try {
    await extractTarStreamInto(compressedStream, stagingRoot, options)
    await assertEmptyDestination(destination)
    if (destinationWasEmpty) {
      await rmdir(destination)
      removedEmptyDestination = true
    }
    await rename(stagingRoot, destination)
  } catch (error) {
    if (removedEmptyDestination) await mkdir(destination, { recursive: false }).catch(() => undefined)
    throw error
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }
}

export const extractTarGzFile = async (
  archivePath: string,
  options: TarGzExtractOptions
): Promise<void> => {
  const file = Bun.file(archivePath)
  await extractTarGzStream(file.stream(), file.size, options)
}

export const extractTarGzBuffer = async (
  compressed: ArrayBuffer | Uint8Array<ArrayBuffer>,
  options: TarGzExtractOptions
): Promise<void> => {
  const bytes = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed)
  await extractTarGzStream(new Blob([bytes]).stream(), bytes.byteLength, options)
}
