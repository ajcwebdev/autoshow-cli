import { basename, extname, join } from 'node:path'
import type { CompletedTtsBatchItem, TtsDeliveryChapter, TtsDeliveryExportRecord, TtsExportOptions, TtsTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { readManifest, updateManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { sanitizeTitleSlug } from '~/cli/commands/sources/download/download-audio/metadata-utils'
import { inspectSoundscapeAudio } from './soundscape/soundscape-audio'
import { encodeTtsDelivery, ttsExportExtension } from './tts-utils/tts-delivery-encode'
import { exportTtsDeliveryAudio } from './tts-delivery-export'
import { serializeTtsMetadataEntries } from './script-to-audio/current-render-artifacts'

export const ttsBookChapterTitle = (inputPath: string): string => {
  const stem = basename(inputPath, extname(inputPath)).replace(/[_-]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  return stem || basename(inputPath)
}

export const ttsBookFileName = (target: Pick<TtsTarget, 'service' | 'model'>, singleTarget: boolean, options: Pick<TtsExportOptions, 'format'>): string =>
  `${singleTarget ? 'book' : `book-${target.service}-${sanitizeTitleSlug(target.model, 120)}`}${ttsExportExtension(options.format)}`

export type TtsBookChapterSource = Pick<CompletedTtsBatchItem, 'index' | 'inputPath' | 'metadata'>

export type TtsBookRecord = TtsDeliveryExportRecord & { service: string, model: string, durationMs: number }

// Chapters are the per-file mastered WAVs in batch order, so a book is assembled without any
// provider request and can be rebuilt whenever tags or format change.
export const assembleTtsBooks = async (input: {
  batchDir: string
  items: readonly TtsBookChapterSource[]
  targets: readonly TtsTarget[]
  expectedItemCount: number
  options: TtsExportOptions
}): Promise<TtsBookRecord[]> => {
  const books: TtsBookRecord[] = []
  const ordered = [...input.items].sort((left, right) => left.index - right.index)
  for (const target of input.targets) {
    const chapterSources = ordered.flatMap((item) => {
      const entry = item.metadata.find((candidate) => candidate.ttsService === target.service && candidate.ttsModel === target.model && !candidate.generationCheckpoint)
      return entry ? [{ item, path: join(input.batchDir, entry.audioFileName) }] : []
    })
    if (chapterSources.length !== input.expectedItemCount) {
      l.warn(`Skipping the ${target.service}/${target.model} book: ${chapterSources.length} of ${input.expectedItemCount} chapters completed. Rerun the same command with --tts-book in this output directory to finish the missing chapters and assemble it; completed chapters are not purchased again.`, { category: 'pipeline' })
      continue
    }
    const chapters: TtsDeliveryChapter[] = []
    let cursorMs = 0
    for (const source of chapterSources) {
      const { durationMs } = await inspectSoundscapeAudio(source.path)
      chapters.push({ title: ttsBookChapterTitle(source.item.inputPath), startMs: cursorMs, endMs: cursorMs + durationMs })
      cursorMs += durationMs
    }
    const fileName = ttsBookFileName(target, input.targets.length === 1, input.options)
    const outputPath = await encodeTtsDelivery({ sourcePaths: chapterSources.map((source) => source.path), outputPath: join(input.batchDir, fileName), options: input.options, chapters })
    books.push({
      service: target.service,
      model: target.model,
      fileName,
      format: input.options.format,
      sizeBytes: Bun.file(outputPath).size,
      durationMs: cursorMs,
      ...(input.options.bitrateKbps !== undefined ? { bitrateKbps: input.options.bitrateKbps } : {}),
      ...(input.options.metadata ? { metadata: input.options.metadata } : {}),
      chapters,
    })
    l.write('info', `Book: ${join(input.batchDir, fileName)} (${chapters.length} chapters)`, { category: 'artifact', metadata: { artifact: 'book', path: join(input.batchDir, fileName) } })
  }
  return books
}

// An already-completed batch directory can gain or rebuild its book from the manifest alone.
export const assembleTtsBooksFromManifest = async (input: {
  batchDir: string
  targets: readonly TtsTarget[]
  options: TtsExportOptions
}): Promise<TtsBookRecord[]> => {
  const manifest = await readManifest(input.batchDir)
  if (manifest?.command !== 'tts' || manifest.scope !== 'batch') return []
  const items: TtsBookChapterSource[] = manifest.items.map((item, index) => ({
    index,
    inputPath: item.input ?? `chapter-${index + 1}`,
    metadata: Array.isArray(item.metadata?.['tts']) ? item.metadata['tts'] as TtsBookChapterSource['metadata'] : [],
  }))
  const books = await assembleTtsBooks({ batchDir: input.batchDir, items, targets: input.targets, expectedItemCount: manifest.items.length, options: input.options })
  if (books.length > 0) await updateManifest(input.batchDir, (current) => ({ ...current, source: { ...current.source, books } }))
  return books
}

// Rerunning a completed batch with different export options rebuilds each chapter's export from
// its retained WAV master.
export const refreshTtsBatchExports = async (batchDir: string, options: TtsExportOptions): Promise<void> => {
  if (options.format === 'wav') return
  const manifest = await readManifest(batchDir)
  if (manifest?.command !== 'tts' || manifest.scope !== 'batch') return
  const exportedByItem = await Promise.all(manifest.items.map(async (item) => {
    const entries = Array.isArray(item.metadata?.['tts']) ? item.metadata['tts'] as TtsBookChapterSource['metadata'] : []
    return await exportTtsDeliveryAudio(batchDir, entries, options)
  }))
  await updateManifest(batchDir, (current) => ({
    ...current,
    items: current.items.map((item, index) => ({ ...item, metadata: { ...item.metadata, tts: serializeTtsMetadataEntries(exportedByItem[index] ?? []) } })),
  }))
}
