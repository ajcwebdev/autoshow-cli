import { posix } from 'node:path'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { CanonicalAudioProviderProjection } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { compactTtsSlotDirectory } from './script-to-audio/tts-slot-bundle'

// Interrupted/admitted work retains its journals and reconciliation evidence.
export const compactCompletedTtsRun = async (rootDir: string): Promise<{ files: number; bytesBefore: number; bytesAfter: number; skipped: boolean }> => {
  const manifest = await readManifest(rootDir)
  if (!manifest || manifest.command !== 'tts') throw UsageError('TTS compaction requires a verified TTS manifest.')
  const providers = manifest.items.flatMap(item => item.providers)
  if (manifest.items.some(item => item.status !== 'full') || providers.some(provider => provider.status !== 'succeeded' && provider.status !== 'skipped')) return { files: 0, bytesBefore: 0, bytesAfter: 0, skipped: true }
  const directories = new Set<string>()
  for (const provider of providers.filter(provider => provider.status === 'succeeded')) {
    const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
    if (!projection?.archive || projection.activeWork) return { files: 0, bytesBefore: 0, bytesAfter: 0, skipped: true }
    directories.add(posix.join(posix.dirname(posix.dirname(projection.archive.renderRef.path)), 'slots'))
  }
  const total = { files: 0, bytesBefore: 0, bytesAfter: 0, skipped: false }
  for (const directory of directories) {
    const result = await compactTtsSlotDirectory(rootDir, directory)
    total.files += result.files; total.bytesBefore += result.bytesBefore; total.bytesAfter += result.bytesAfter
  }
  if (!await readManifest(rootDir)) throw UsageError('TTS manifest could not be verified after compaction.')
  return total
}
