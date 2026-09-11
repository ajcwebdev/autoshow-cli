import { posix } from 'node:path'
import { ValidationError } from '~/utils/error-handler'

export const BLOCK_SIZE = 512
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export const archiveError = (message: string, cause?: unknown): Error =>
  ValidationError(message, {
    stage: 'setup:tar-gz',
    ...(cause instanceof Error ? { cause } : {})
  })

export const isZeroBlock = (block: Uint8Array): boolean => {
  for (const byte of block) {
    if (byte !== 0) return false
  }
  return true
}

export const readNullTerminated = (buffer: Uint8Array, start: number, end: number): string => {
  let stop = start
  while (stop < end && buffer[stop] !== 0) stop++
  try {
    return textDecoder.decode(buffer.subarray(start, stop))
  } catch (error) {
    throw archiveError('Tar header contains invalid UTF-8 text.', error)
  }
}

export const readTarNumber = (buffer: Uint8Array, start: number, end: number, label: string): number => {
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

export const assertHeaderChecksum = (header: Uint8Array): void => {
  const expected = readTarNumber(header, 148, 156, 'header checksum')
  let actual = 0
  for (let index = 0; index < header.byteLength; index++) {
    actual += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0)
  }
  if (expected !== actual) throw archiveError(`Malformed tar header checksum: expected ${expected}, calculated ${actual}.`)
}

export const roundToBlock = (size: number): number => Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE

export const readHeaderPath = (header: Uint8Array): string => {
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

export const sanitizeArchivePath = (path: string, stripComponents: number): string | null => {
  assertPortableArchivePath(path, 'Unsafe tar path rejected')
  const components = path.replace(/^(?:\.\/)+/, '').split('/').filter((component) => component.length > 0 && component !== '.')
  const stripped = components.slice(stripComponents)
  if (stripped.length === 0) return null
  const result = posix.normalize(stripped.join('/'))
  assertPortableArchivePath(result, 'Unsafe tar path rejected after strip-components')
  return result === '.' ? null : result
}

export const assertSafeSymlinkTarget = (target: string, linkPath: string): void => {
  if (target.length === 0) throw archiveError(`Unsafe tar symlink target rejected for ${linkPath}: empty target`)
  if (target.includes('\0') || target.includes('\\') || posix.isAbsolute(target) || /^[A-Za-z]:/.test(target)) {
    throw archiveError(`Unsafe tar symlink target rejected: ${target}`)
  }
  const resolvedTarget = posix.normalize(posix.join(posix.dirname(linkPath), target))
  if (resolvedTarget === '..' || resolvedTarget.startsWith('../')) {
    throw archiveError(`Unsafe tar symlink target rejected: ${target}`)
  }
}

export const assertNoSymlinkAncestor = (path: string, symlinkPaths: Set<string>): void => {
  const segments = path.split('/')
  let parent = ''
  for (const segment of segments.slice(0, -1)) {
    parent = parent ? `${parent}/${segment}` : segment
    if (symlinkPaths.has(parent)) throw archiveError(`Tar entry traverses an archived symlink: ${path}`)
  }
}
