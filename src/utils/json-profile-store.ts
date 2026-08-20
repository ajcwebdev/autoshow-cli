import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isRecord } from '~/utils/value-helpers'

type JsonProfileStore<TVersion extends number, TEntry> = {
  version: TVersion
  profiles: TEntry[]
}

export const createJsonProfileStore = <const TVersion extends number, TEntry>(options: {
  version: TVersion
  acceptVersions?: readonly number[] | undefined
  parseEntry: (value: unknown) => TEntry | undefined
  resolvePath: () => string
}): {
  read: (profilePath?: string | undefined) => Promise<JsonProfileStore<TVersion, TEntry>>
  readSync: (profilePath?: string | undefined) => JsonProfileStore<TVersion, TEntry>
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

  return {
    read: async (profilePath = options.resolvePath()): Promise<JsonProfileStore<TVersion, TEntry>> => {
      try {
        return parseStore(JSON.parse(await readFile(profilePath, 'utf-8')) as unknown)
      } catch {
        return emptyStore()
      }
    },
    readSync: (profilePath = options.resolvePath()): JsonProfileStore<TVersion, TEntry> => {
      try {
        if (!existsSync(profilePath)) return emptyStore()
        return parseStore(JSON.parse(readFileSync(profilePath, 'utf-8')) as unknown)
      } catch {
        return emptyStore()
      }
    }
  }
}
