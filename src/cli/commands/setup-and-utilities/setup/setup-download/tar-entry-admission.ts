import { constants } from 'node:fs'
import { mkdir, open, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { TarGzExtractOptions } from '~/types'
import type { ActiveTarEntry, TarMetadataState } from './tar-stream-types'
import { archiveError, assertHeaderChecksum, assertNoSymlinkAncestor, assertSafeSymlinkTarget, readTarNumber, roundToBlock, sanitizeArchivePath } from './tar-archive-guards'
import { resolveTarEntryMetadata } from './tar-extended-metadata'

const DEFAULT_MAX_ENTRY_BYTES = 8 * 1024 * 1024 * 1024
const DEFAULT_MAX_ENTRIES = 1_000_000
const MAX_METADATA_BYTES = 1024 * 1024

export const createTarEntryAdmission = (stagingRoot: string, options: TarGzExtractOptions, metadata: TarMetadataState) => {
  const stripComponents = Math.max(0, Math.floor(options.stripComponents ?? 0))
  const maxEntryBytes = options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const seenPaths = new Set<string>()
  const explicitDirectories = new Set<string>()
  const symlinkPaths = new Set<string>()
  const directoryModes: Array<{ path: string, mode: number }> = []
  let entryCount = 0

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
    const { rawPath, linkName, size } = resolveTarEntryMetadata(header, headerSize, metadata)
    if (size > maxEntryBytes) throw archiveError(`Tar entry exceeds the ${maxEntryBytes} byte limit: ${rawPath}`)
    const relativePath = sanitizeArchivePath(rawPath, stripComponents)
    if (!relativePath) return { typeFlag, remaining: size, paddingRemaining: roundToBlock(size) - size }
    if (seenPaths.has(relativePath)) {
      // Source archives can repeat directory headers when appending vendored trees.
      // Permit only an existing explicit directory, never a file or symlink replacement.
      if (typeFlag === '5' && size === 0 && explicitDirectories.has(relativePath)) return { typeFlag, remaining: 0, paddingRemaining: 0 }
      throw archiveError(`Duplicate tar target rejected: ${relativePath}`)
    }
    assertNoSymlinkAncestor(relativePath, symlinkPaths)
    seenPaths.add(relativePath)
    const destinationPath = join(stagingRoot, relativePath)
    const mode = readTarNumber(header, 100, 108, 'entry mode') & 0o777

    if (typeFlag === '1') throw archiveError(`Tar hard links are not supported: ${relativePath}`)
    if (typeFlag === '5') {
      if (size !== 0) throw archiveError(`Tar directory contains an unexpected payload: ${relativePath}`)
      await mkdir(destinationPath, { recursive: true, mode: mode | 0o700 })
      explicitDirectories.add(relativePath)
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
  return { startEntry, directoryModes }
}
