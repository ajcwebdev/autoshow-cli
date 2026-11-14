import * as v from 'valibot'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { exec } from '~/utils/cli-utils'
import { readJsonCacheMap, writeJsonCacheEntry } from '~/utils/file-fingerprint-cache'
import { isLikelyUrl } from '../metadata-targets/metadata-input-classifier'
import { validateDataSafe } from '~/utils/validate/validation'
import { buildYtDlpListArgs, buildYtDlpFailureMessage } from '~/cli/commands/command-shared/shared-yt-dlp-options'
import { getYtDlpBinary } from '~/cli/commands/command-shared/shared-yt-dlp-binary'

const YtDlpPlaylistItemSchema = v.object({
  webpage_url: v.optional(v.string(), undefined),
  url: v.optional(v.string(), undefined)
})

const ensureAbsoluteYoutubeUrl = (idOrUrl: string): string => {
  if (!idOrUrl) return ''
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) return idOrUrl
  return `https://www.youtube.com/watch?v=${idOrUrl}`
}

const isYoutubeUrl = (s: string): boolean => {
  try {
    const u = new URL(s)
    const h = u.hostname.toLowerCase()
    return (u.protocol === 'http:' || u.protocol === 'https:') &&
      (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be' || h.endsWith('.youtu.be'))
  } catch {
    return false
  }
}

const COLLECTION_CACHE_FILE = join(tmpdir(), 'autoshow-yt-collection-cache.json')
const COLLECTION_CACHE_LOCK = 'yt-collection-cache'
const YoutubeCollectionItemsSchema = v.array(v.pipe(v.string(), v.check(isYoutubeUrl)))

const buildYoutubeCollectionListArgs = async (url: string): Promise<string[]> =>
  await buildYtDlpListArgs(url, { limit: 'all', order: 'newest' })

const getYoutubeCollectionItems = async (url: string): Promise<string[]> => {
  const cached = validateDataSafe(
    YoutubeCollectionItemsSchema,
    (await readJsonCacheMap<unknown>(COLLECTION_CACHE_FILE))[url]
  )
  if (cached) {
    return cached
  }

  let items: string[]
  try {
    const args = await buildYoutubeCollectionListArgs(url)
    const res = await exec(getYtDlpBinary(), args)
    if (res.exitCode !== 0) {
      l.warn(buildYtDlpFailureMessage('list', res.stderr || res.stdout || 'unknown yt-dlp error'), { category: 'pipeline' })
      return []
    }
    const lines = res.stdout.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    const parsedItems = lines.map((line: string) => {
      try {
        const raw: unknown = JSON.parse(line)
        const parsed = validateDataSafe(YtDlpPlaylistItemSchema, raw)
        if (!parsed) return ''
        const direct = parsed.webpage_url ?? ''
        const id = parsed.url ?? ''
        const finalUrl = direct || ensureAbsoluteYoutubeUrl(id)
        return finalUrl
      } catch {
        return ''
      }
    }).filter(isYoutubeUrl)
    items = Array.from(new Set(parsedItems))
  } catch (error) {
    l.warn('Failed to enumerate YouTube items', { category: 'pipeline', error })
    return []
  }

  await writeJsonCacheEntry({
    cachePath: COLLECTION_CACHE_FILE,
    lockName: COLLECTION_CACHE_LOCK,
    key: url,
    value: items
  })
  return items
}

export const resolveYoutubeCollectionItems = async (
  resolvedTarget: string
): Promise<string[] | null> => {
  if (!isLikelyUrl(resolvedTarget) || !isYoutubeUrl(resolvedTarget)) {
    return null
  }

  const items = await getYoutubeCollectionItems(resolvedTarget)
  if (items.length <= 1) {
    return null
  }

  return items
}
