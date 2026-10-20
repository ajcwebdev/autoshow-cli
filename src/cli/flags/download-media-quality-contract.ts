import { UsageError } from '~/utils/error-handler'

export const DOWNLOAD_MEDIA_QUALITIES = ['audio', 'original', 'best'] as const
export const DEFAULT_DOWNLOAD_MEDIA_QUALITY = 'audio'

export const resolveDownloadMediaQuality = (
  flags: Record<string, unknown>,
  explicitFlags: ReadonlySet<string> = new Set()
): { keepOriginalMedia: boolean, bestQuality: boolean } => {
  const quality = flags['media-quality'] ?? DEFAULT_DOWNLOAD_MEDIA_QUALITY
  if (!DOWNLOAD_MEDIA_QUALITIES.includes(quality as typeof DOWNLOAD_MEDIA_QUALITIES[number])) {
    throw UsageError(`Invalid --media-quality value "${String(quality)}". Expected ${DOWNLOAD_MEDIA_QUALITIES.join('|')}.`)
  }
  if (explicitFlags.has('media-quality')) {
    const aliases = ['keep-original-media', 'best-quality'].filter(name => explicitFlags.has(name))
    if (aliases.length > 0) throw UsageError(`--media-quality cannot be combined with ${aliases.map(name => `--${name}`).join(', ')}. Use only --media-quality audio|original|best.`)
  }

  // Parser defaults must not reset older callers or retained configuration using the boolean fields.
  // An explicit canonical value, including audio, takes precedence over those retained values.
  if (explicitFlags.has('media-quality') || quality !== DEFAULT_DOWNLOAD_MEDIA_QUALITY) {
    return { keepOriginalMedia: quality === 'original', bestQuality: quality === 'best' }
  }
  return {
    keepOriginalMedia: flags['keep-original-media'] === true,
    bestQuality: flags['best-quality'] === true
  }
}
