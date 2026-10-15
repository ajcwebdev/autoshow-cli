import { statPath } from '~/utils/bun-file-io'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import type { BatchListCacheEntry, FileFingerprint, MetadataTopLevelTargetInfo } from '~/types'
import { fileExists } from '~/utils/cli-utils'
import { InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { fileFingerprintsMatch, getFileFingerprint, readJsonCacheMap, writeJsonCacheEntry } from '~/utils/file-fingerprint-cache'
import { hasSupportedExtension, isLikelyUrl, isRawXSpaceId } from './metadata-input-classifier'

const URL_LIST_EXTENSIONS = ['.md', '.txt']

export const collectInputFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []

  const walk = async (currentDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = `${currentDir}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.isFile() && hasSupportedExtension(entryPath)) {
        files.push(entryPath)
      }
    }
  }

  try {
    await walk(dir)
  } catch {
    return files
  }

  return files
}

const parseListEntry = (line: string): string => {
  const withoutBullet = line.replace(/^[-*]\s+/, '').trim()
  const markdownLink = withoutBullet.match(/\[[^\]]+\]\(([^)]+)\)/)
  const raw = markdownLink?.[1] ?? withoutBullet
  return raw.replace(/^`|`$/g, '').trim()
}

// Prose is probed here as a possible filename. A long paragraph is not a
// filesystem failure and must not make a text document look like an input list.
const listCandidateExists = async (candidate: string): Promise<boolean> => {
  if (candidate.includes('\0')) return false
  // Avoid probing impossible filename components: some mounted filesystems
  // report EINPROGRESS rather than ENAMETOOLONG for these paths.
  const components = candidate.split(process.platform === 'win32' ? /[\\/]/ : '/')
  if (components.some((part) => (process.platform === 'win32' ? part.length : Buffer.byteLength(part, 'utf8')) > 255)) return false
  try {
    return await fileExists(candidate)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENAMETOOLONG') return false
    throw error
  }
}

const BATCH_LIST_CACHE_FILE = join(tmpdir(), 'autoshow-batch-list-cache.json')
const BATCH_LIST_CACHE_LOCK = 'batch-list-cache'

const getCachedBatchListItems = async (filePath: string): Promise<string[] | undefined> => {
  const cache = await readJsonCacheMap<BatchListCacheEntry>(BATCH_LIST_CACHE_FILE)
  const entry = cache[resolve(filePath)]
  if (!entry || !Array.isArray(entry.items) || !entry.fingerprint) {
    return undefined
  }
  return fileFingerprintsMatch(await getFileFingerprint(filePath), entry.fingerprint)
    ? entry.items
    : undefined
}

const writeBatchListCache = async (
  filePath: string,
  items: string[],
  fingerprint: FileFingerprint
): Promise<void> => {
  try {
    await writeJsonCacheEntry({
      cachePath: BATCH_LIST_CACHE_FILE,
      lockName: BATCH_LIST_CACHE_LOCK,
      key: resolve(filePath),
      value: { items, fingerprint }
    })
  } catch {
  }
}

export const readInputList = async (filePath: string): Promise<string[]> => {
  const cached = await getCachedBatchListItems(filePath)
  if (cached) {
    return cached
  }

  try {
    const exists = await fileExists(filePath)
    if (!exists) {
      l.warn(`Input list not found at ${filePath}`, { category: 'pipeline', metadata: { filePath } })
      return []
    }

    const fingerprintBeforeRead = await getFileFingerprint(filePath)
    const baseDir = dirname(filePath)
    const text = await Bun.file(filePath).text()
    const lines = text
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('#'))

    const valid: string[] = []
    let invalidCount = 0

    for (const line of lines) {
      const entry = parseListEntry(line)
      if (!entry) {
        invalidCount++
        continue
      }

      if (isLikelyUrl(entry)) {
        valid.push(entry)
        continue
      }

      if (isRawXSpaceId(entry)) {
        valid.push(entry)
        continue
      }

      const resolvedPath = resolve(baseDir, entry)
      if (await listCandidateExists(resolvedPath)) {
        valid.push(resolvedPath)
        continue
      }

      if (await listCandidateExists(entry)) {
        valid.push(entry)
        continue
      }

      invalidCount++
    }

    if (invalidCount > 0) {
      l.warn(`Ignored ${invalidCount} invalid entries in ${filePath}`, { category: 'pipeline', metadata: { filePath, invalidCount } })
    }

    l.write('info', `Loaded ${valid.length} inputs from ${filePath}`, { category: 'pipeline', metadata: { filePath, inputCount: valid.length } })
    const fingerprintAfterRead = await getFileFingerprint(filePath)
    if (fingerprintAfterRead && fileFingerprintsMatch(fingerprintBeforeRead, fingerprintAfterRead)) {
      await writeBatchListCache(filePath, valid, fingerprintAfterRead)
    }
    return valid
  } catch (error) {
    throw InfraError(`Failed to read input list at ${filePath}`, {
      stage: 'metadata:input-list',
      cause: error,
      metadata: { filePath }
    })
  }
}

export const isLikelyInputListFile = async (filePath: string): Promise<boolean> => {
  try {
    const baseDir = dirname(filePath)
    const text = await Bun.file(filePath).text()
    const lines = text
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('#'))

    if (lines.length === 0) {
      return true
    }

    let valid = 0
    for (const line of lines) {
      const entry = parseListEntry(line)
      if (!entry) {
        continue
      }

      if (isLikelyUrl(entry) || (isRawXSpaceId(entry) && /\d/.test(entry))) {
        valid++
        continue
      }

      if (await listCandidateExists(resolve(baseDir, entry)) || await listCandidateExists(entry)) {
        valid++
      }
    }

    return valid * 2 >= lines.length
  } catch {
    return true
  }
}

const isDirectoryPath = async (path: string): Promise<boolean> => {
  try {
    return (await statPath(path)).isDirectory()
  } catch {
    return false
  }
}

const isUrlListFilePath = (path: string): boolean => {
  return URL_LIST_EXTENSIONS.includes(extname(path).toLowerCase())
}

export const isInputDirectoryPath = (path: string): boolean => {
  return basename(path).toLowerCase() === 'input'
}

export const classifyTopLevelTarget = async (target: string): Promise<MetadataTopLevelTargetInfo> => {
  const exists = await fileExists(target)
  if (!exists) {
    return { kind: 'single', exists: false, isDirectory: false, isFile: false }
  }

  const isDirectory = await isDirectoryPath(target)
  if (isDirectory) {
    return { kind: 'directory', exists: true, isDirectory: true, isFile: false }
  }

  const isFile = true
  if (isUrlListFilePath(target)) {
    return { kind: 'input_list', exists: true, isDirectory: false, isFile }
  }

  return { kind: 'single', exists: true, isDirectory: false, isFile }
}
