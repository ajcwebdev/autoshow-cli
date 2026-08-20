import { ValidationError } from '~/utils/error-handler'
import { inspectEpubWithReader, normalizeEntryPath } from './inspect-core'
import type { EpubContentEntry, EpubContentReader, EpubInspectEngine, EpubInspectOutput } from '~/types'
import { openZipArchive, readZipEntryData } from '~/utils/zip-central-directory'

const EPUB_ARCHIVE = { stage: 'ocr:epub-zip', normalizeEntryName: normalizeEntryPath } as const

const createZipReader = async (filePath: string): Promise<EpubContentReader> => {
  const { buffer, list, entries: byPath } = await openZipArchive(filePath, EPUB_ARCHIVE)
  const entries: EpubContentEntry[] = list.map(entry => ({
    path: entry.name,
    size: entry.uncompSize,
    compressedSize: entry.compSize
  }))

  return {
    adapterLabel: 'bun-zip',
    entries,
    hasEntry: (entryPath: string) => byPath.has(normalizeEntryPath(entryPath)),
    readText: async (entryPath: string) => {
      const normalized = normalizeEntryPath(entryPath)
      const entry = byPath.get(normalized)
      if (!entry) {
        throw ValidationError(`EPUB entry not found: ${normalized}`, { stage: 'ocr:epub-zip' })
      }
      return readZipEntryData(buffer, entry, EPUB_ARCHIVE).toString('utf8')
    }
  }
}

export const runEpubZipInspect = async (
  filePath: string,
  engine: EpubInspectEngine
): Promise<EpubInspectOutput> => {
  const reader = await createZipReader(filePath)
  return await inspectEpubWithReader(reader, engine)
}

export const runEpubBunInspect = async (filePath: string): Promise<EpubInspectOutput> =>
  await runEpubZipInspect(filePath, 'bun')
