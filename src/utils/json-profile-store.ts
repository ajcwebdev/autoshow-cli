import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { JsonProfileStore } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { isRecord } from '~/utils/value-helpers'

export const createJsonProfileStore = <const TVersion extends number, TEntry>(options: {
  version: TVersion
  acceptVersions?: readonly number[] | undefined
  parseEntry: (value: unknown) => TEntry | undefined
  resolvePath: () => string
  /** Required to call `publish`; read-only stores omit it. */
  publishPolicy?: {
    /** Identifies the cross-process lock guarding this store. */
    lockName: string
    /** Entries are capped after merging and ordering. */
    maxEntries: number
    /** Orders entries before the cap is applied. */
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
  const acceptedVersions = new Set([options.version, ...(options.acceptVersions ?? [])])
  const emptyStore = (): JsonProfileStore<TVersion, TEntry> => ({ version: options.version, profiles: [] })
  const parseStore = (value: unknown): JsonProfileStore<TVersion, TEntry> => {
    if (!isRecord(value) || typeof value['version'] !== 'number' || !acceptedVersions.has(value['version']) || !Array.isArray(value['profiles'])) {
      return emptyStore()
    }
    return {
      version: options.version,
      profiles: value['profiles'].map(options.parseEntry).filter((entry): entry is TEntry => entry !== undefined)
    }
  }

  const readStore = async (profilePath: string): Promise<JsonProfileStore<TVersion, TEntry>> => {
    try {
      return parseStore(JSON.parse(await readFile(profilePath, 'utf-8')) as unknown)
    } catch {
      return emptyStore()
    }
  }

  return {
    read: async (profilePath = options.resolvePath()): Promise<JsonProfileStore<TVersion, TEntry>> => await readStore(profilePath),
    readSync: (profilePath = options.resolvePath()): JsonProfileStore<TVersion, TEntry> => {
      try {
        if (!existsSync(profilePath)) return emptyStore()
        return parseStore(JSON.parse(readFileSync(profilePath, 'utf-8')) as unknown)
      } catch {
        return emptyStore()
      }
    },
    /**
     * Read-merge-cap-write under the store's process lock, publishing through a
     * temporary file and an atomic rename so a concurrent reader never sees a torn
     * store. The domain merge decides how one sample folds into an existing profile.
     */
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
        await writeFile(tempPath, JSON.stringify(nextStore, null, 2) + '\n')
        await rename(tempPath, profilePath)
      })
    }
  }
}

/**
 * Picks the best-matching calibration profile: highest score wins, then the profile
 * backed by more samples, then the most recently seen. A negative score means the
 * profile is not a candidate at all, so it is dropped before ordering.
 */
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
