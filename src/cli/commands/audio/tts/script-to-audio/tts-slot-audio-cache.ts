import { lstat } from 'node:fs/promises'
import type { TtsOutputLayout } from '~/types'
import { copyCreateOnly, hasErrorCode, readObservedAudio } from './attempt-io'
import { sha256Bytes } from './contract-identity'

// Repeated request text may produce different takes. Keep the first cache entry and
// retain additional bytes under their content hash, without changing paid-slot identity.
export const retainTtsSlotAudio = async (rootDir: string, layout: TtsOutputLayout, slotHash: string, source: string, sha256: string): Promise<string> => {
  const primary = layout.slotWavPath(slotHash)
  let artifactRef = primary
  try {
    await lstat(rootDir + '/' + primary)
    if (sha256Bytes((await readObservedAudio(rootDir, rootDir + '/' + primary)).bytes) !== sha256) artifactRef = layout.slotWavPath(slotHash + '-' + sha256)
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  await copyCreateOnly(rootDir, source, rootDir + '/' + artifactRef)
  return artifactRef
}
