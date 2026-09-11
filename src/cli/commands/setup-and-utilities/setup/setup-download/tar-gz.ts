import { chmod, lstat, mkdir, mkdtemp, readdir, rename, rm, rmdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { hasErrorCode } from '~/utils/error-handler'
import type { TarGzExtractOptions } from '~/types'
import type { ActiveTarEntry } from './tar-stream-types'
import { archiveError, BLOCK_SIZE, isZeroBlock } from './tar-archive-guards'
import { createTarMetadataState, assertTarMetadataConsumed } from './tar-extended-metadata'
import { createTarEntryAdmission } from './tar-entry-admission'
import { consumeTarEntryPayload } from './tar-entry-payload'
export { writeTarPayloadFully } from './tar-entry-payload'

const DEFAULT_MAX_COMPRESSED_BYTES = 4 * 1024 * 1024 * 1024
const DEFAULT_MAX_EXPANDED_BYTES = 16 * 1024 * 1024 * 1024

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
  const maxExpandedBytes = options.maxExpandedBytes ?? DEFAULT_MAX_EXPANDED_BYTES
  const expandedStream = compressedStream.pipeThrough(
    new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>
  )
  const metadata = createTarMetadataState()
  const { startEntry, directoryModes } = createTarEntryAdmission(stagingRoot, options, metadata)
  let active: ActiveTarEntry | undefined
  let buffered = Buffer.alloc(0)
  let expandedBytes = 0
  let zeroBlocks = 0
  let complete = false


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
          buffered = await consumeTarEntryPayload(active, buffered, metadata)
          if (active.remaining > 0 || active.paddingRemaining > 0) break
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
  assertTarMetadataConsumed(metadata)
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
