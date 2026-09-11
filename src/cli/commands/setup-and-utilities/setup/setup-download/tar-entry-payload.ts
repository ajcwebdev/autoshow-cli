import { chmod } from 'node:fs/promises'
import type { ActiveTarEntry, TarMetadataState, TarPayloadWrite } from './tar-stream-types'
import { archiveError, isZeroBlock } from './tar-archive-guards'
import { applyTarExtendedMetadata } from './tar-extended-metadata'

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

const finishTarEntryPayload = async (entry: ActiveTarEntry, metadata: TarMetadataState): Promise<void> => {
  if (entry.handle) {
    await entry.handle.close()
    entry.handle = undefined
    if (entry.path && entry.mode !== undefined) await chmod(entry.path, entry.mode & 0o777)
  }
  applyTarExtendedMetadata(entry, metadata)
}

export const consumeTarEntryPayload = async (entry: ActiveTarEntry, buffered: Buffer<ArrayBuffer>, metadata: TarMetadataState): Promise<Buffer<ArrayBuffer>> => {
  if (entry.remaining > 0) {
    const count = Math.min(entry.remaining, buffered.byteLength)
    const payload = buffered.subarray(0, count)
    if (entry.handle) {
      const handle = entry.handle
      await writeTarPayloadFully(payload, async (remaining) => {
        const { bytesWritten } = await handle.write(remaining)
        return bytesWritten
      })
    }
    if (entry.metadataChunks) entry.metadataChunks.push(Buffer.from(payload))
    entry.remaining -= count
    buffered = buffered.subarray(count)
    if (entry.remaining > 0) return buffered
  }
  if (!entry.payloadFinished) {
    await finishTarEntryPayload(entry, metadata)
    entry.payloadFinished = true
  }
  if (entry.paddingRemaining > 0) {
    const count = Math.min(entry.paddingRemaining, buffered.byteLength)
    const padding = buffered.subarray(0, count)
    if (!isZeroBlock(padding)) throw archiveError('Tar entry padding contains non-zero bytes.')
    entry.paddingRemaining -= count
    buffered = buffered.subarray(count)
    if (entry.paddingRemaining > 0) return buffered
  }
  return buffered
}
