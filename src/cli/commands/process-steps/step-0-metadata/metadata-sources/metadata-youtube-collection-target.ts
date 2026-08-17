import * as v from 'valibot'
import * as l from '~/utils/app-logger/app-logger'
import { exec } from '~/utils/cli-utils'
import { isLikelyUrl } from '../metadata-targets/metadata-input-classifier'
import { validateDataSafe } from '~/utils/validate/validation'
import { buildYtDlpListArgs, buildYtDlpFailureMessage } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { getYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'

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
    return h.includes('youtube.com') || h.includes('youtu.be')
  } catch {
    return false
  }
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const COLLECTION_CACHE_FILE = join(tmpdir(), 'autoshow-yt-collection-cache.json')

const readCollectionCache = (): Record<string, string[]> => {
  try {
    if (existsSync(COLLECTION_CACHE_FILE)) {
      return JSON.parse(readFileSync(COLLECTION_CACHE_FILE, 'utf-8'))
    }
  } catch {
  }
  return {}
}

const writeCollectionCache = (url: string, items: string[]): void => {
  try {
    const cache = readCollectionCache()
    cache[url] = items
    writeFileSync(COLLECTION_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
  }
}

const buildYoutubeCollectionListArgs = async (url: string): Promise<string[]> =>
  await buildYtDlpListArgs(url, { limit: 'all', order: 'newest' })

const getYoutubeCollectionItems = async (url: string): Promise<string[]> => {
  const cached = readCollectionCache()[url]
  if (cached) {
    return cached
  }

  try {
    const args = await buildYoutubeCollectionListArgs(url)
    const res = await exec(getYtDlpBinary(), args)
    if (res.exitCode !== 0) {
      l.warn(buildYtDlpFailureMessage('list', res.stderr || res.stdout || 'unknown yt-dlp error'))
      return []
    }
    const lines = res.stdout.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    const items: string[] = lines.map((line: string) => {
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
    }).filter((u: string) => u.length > 0)
    const uniq = Array.from(new Set(items))
    writeCollectionCache(url, uniq)
    return uniq
  } catch {
    l.warn(`Failed to enumerate YouTube items`)
    return []
  }
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
