import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { JsonProfileStore } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { isRecord } from '~/utils/value-helpers'
import { readTextFile, writeFileExact } from '~/utils/bun-file-io'

export const createJsonProfileStore = <const TVersion extends number, TEntry>(options: {
  version: TVersion
  parseEntry: (value: unknown) => TEntry | undefined
  resolvePath: () => string
  invalidStorePolicy?: 'empty' | 'throw' | undefined
  publishPolicy?: {
    lockName: string
    maxEntries: number
    compareForRetention: (left: TEntry, right: TEntry) => number
  } | undefined
}): {
  read: (profilePath?: string | undefined) => Promise<JsonProfileStore<TVersion, TEntry>>
  readSync: (profilePath?: string | undefined) => JsonProfileStore<TVersion, TEntry>
  publish: (
    samples: readonly TEntry[],
    merge: (existing: TEntry[], samples: readonly TEntry[]) => TEntry[],
    profilePath?: string | undefined
  ) => Promise<void>
} => {
  const emptyStore = (): JsonProfileStore<TVersion, TEntry> => ({ version: options.version, profiles: [] })
  const invalidStore = (message: string): JsonProfileStore<TVersion, TEntry> => {
    if (options.invalidStorePolicy === 'throw') {
      throw InternalError(message, { retryable: false })
    }
    return emptyStore()
  }
  const parseStore = (value: unknown): JsonProfileStore<TVersion, TEntry> => {
    if (!isRecord(value) || value['version'] !== options.version || !Array.isArray(value['profiles'])) {
      return invalidStore(`Invalid JSON profile store; expected version ${options.version}.`)
    }
    const profiles = value['profiles'].map(options.parseEntry)
    if (options.invalidStorePolicy === 'throw' && profiles.some((entry) => entry === undefined)) {
      return invalidStore(`Invalid entry in JSON profile store version ${options.version}.`)
    }
    return {
      version: options.version,
      profiles: profiles.filter((entry): entry is TEntry => entry !== undefined)
    }
  }

  const readStore = async (profilePath: string): Promise<JsonProfileStore<TVersion, TEntry>> => {
    if (!existsSync(profilePath)) return emptyStore()
    try {
      return parseStore(JSON.parse(await readTextFile(profilePath)) as unknown)
    } catch (error) {
      if (options.invalidStorePolicy === 'throw') throw error
      return emptyStore()
    }
  }

  return {
    read: async (profilePath = options.resolvePath()): Promise<JsonProfileStore<TVersion, TEntry>> => await readStore(profilePath),
    readSync: (profilePath = options.resolvePath()): JsonProfileStore<TVersion, TEntry> => {
      try {
        if (!existsSync(profilePath)) return emptyStore()
        return parseStore(JSON.parse(readFileSync(profilePath, 'utf-8')) as unknown)
      } catch (error) {
        if (options.invalidStorePolicy === 'throw') throw error
        return emptyStore()
      }
    },
    publish: async (samples, merge, profilePath = options.resolvePath()): Promise<void> => {
      const policy = options.publishPolicy
      if (!policy) {
        throw InternalError('Publishing a JSON profile store requires a publishPolicy.', { retryable: false })
      }
      if (samples.length === 0) return

      await withProcessLock(policy.lockName, async () => {
        const current = await readStore(profilePath)
        const nextStore: JsonProfileStore<TVersion, TEntry> = {
          version: options.version,
          profiles: merge(current.profiles, samples)
            .sort(policy.compareForRetention)
            .slice(0, policy.maxEntries)
        }
        await mkdir(dirname(profilePath), { recursive: true })
        const tempPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`
        await writeFileExact(tempPath, JSON.stringify(nextStore, null, 2) + '\n')
        await rename(tempPath, profilePath)
      })
    }
  }
}

export const selectBestScoredProfile = <TEntry extends { sampleCount: number, lastSeenAt: string }>(
  profiles: readonly TEntry[],
  score: (profile: TEntry) => number
): TEntry | undefined =>
  profiles
    .map((profile) => ({ profile, score: score(profile) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) =>
      right.score - left.score
      || right.profile.sampleCount - left.profile.sampleCount
      || Date.parse(right.profile.lastSeenAt) - Date.parse(left.profile.lastSeenAt)
    )[0]?.profile
