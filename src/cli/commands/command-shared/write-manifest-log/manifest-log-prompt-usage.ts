import type { PromptUsageSection, WriteManifestMetadata, WriteManifestSourceRefs, WritePromptUsageRow } from '~/types'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import {
  buildProviderModelLabel,
  formatCount,
  formatPromptUsageTokenPair,
  formatTokenCount,
  resolveWhisperModel
} from './manifest-log-formatting'
import {
  getPartialStep2Entries,
  isExtractionMetadata,
  isStep2Metadata,
  isStep3Metadata,
  toArray
} from './manifest-log-metadata'

const getEpubLogicalChapterCount = (entry: { extractionMethod: string, totalPages: number, chapterExport?: unknown }): number | undefined => {
  if (entry.extractionMethod !== 'epub-text') {
    return undefined
  }

  const summary = entry.chapterExport
  if (
    !summary
    || typeof summary !== 'object'
    || Array.isArray(summary)
    || (summary as Record<string, unknown>)['sourceFormat'] !== 'epub'
    || (summary as Record<string, unknown>)['mode'] !== 'chapters'
  ) {
    return undefined
  }

  const logicalChapterCount = (summary as Record<string, unknown>)['logicalChapterCount']
  return typeof logicalChapterCount === 'number' && logicalChapterCount > entry.totalPages
    ? logicalChapterCount
    : undefined
}

const formatExtractUnitCount = (entry: { extractionMethod: string, totalPages: number, chapterExport?: unknown }): string => {
  if (entry.extractionMethod !== 'epub-text') {
    return formatCount(entry.totalPages, 'page', 'pages')
  }

  const logicalChapterCount = getEpubLogicalChapterCount(entry)
  return [
    formatCount(entry.totalPages, 'section', 'sections'),
    typeof logicalChapterCount === 'number' ? formatCount(logicalChapterCount, 'chapter', 'chapters') : null
  ].filter((value): value is string => typeof value === 'string').join(' / ')
}

export const buildPromptUsage = (
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs
): PromptUsageSection | undefined => {
  const rows: WritePromptUsageRow[] = []
  const promptArtifact = refs.promptArtifact ?? 'prompt.md'
  const extractPromptSource = 'inline source'

  for (const entry of toArray(metadata['step2'], isExtractionMetadata)) {
    const { provider, model } = resolveExtractionProviderModel(entry)
    const usage = (entry.promptTokens ?? 0) > 0 || (entry.completionTokens ?? 0) > 0
      ? formatPromptUsageTokenPair(entry.promptTokens ?? 0, entry.completionTokens ?? 0)
      : formatExtractUnitCount(entry)
    rows.push({
      step: 'Extract',
      providerModel: buildProviderModelLabel(provider, model),
      promptSource: extractPromptSource,
      usage
    })
  }

  for (const entry of getPartialStep2Entries(metadata)) {
    const { provider, model } = resolveExtractionProviderModel(entry)
    const baseUsage = (entry.promptTokens ?? 0) > 0 || (entry.completionTokens ?? 0) > 0
      ? formatPromptUsageTokenPair(entry.promptTokens ?? 0, entry.completionTokens ?? 0)
      : formatCount(entry.completedPages, 'page', 'pages')
    rows.push({
      step: 'Extract (partial)',
      providerModel: `${buildProviderModelLabel(provider, model)} (failed partial)`,
      promptSource: extractPromptSource,
      usage: `${baseUsage} / ${entry.completedPages}/${entry.totalPages} pages`
    })
  }

  for (const entry of toArray(metadata['step2'], isStep2Metadata)) {
    const model = entry.transcriptionService === 'whisper'
      ? resolveWhisperModel(entry.transcriptionModel)
      : entry.transcriptionModel
    rows.push({
      step: 'Transcribe',
      providerModel: buildProviderModelLabel(entry.transcriptionService, model),
      promptSource: null,
      usage: formatTokenCount(entry.tokenCount)
    })
  }

  for (const entry of toArray(metadata['step3'], isStep3Metadata)) {
    rows.push({
      step: 'LLM',
      providerModel: buildProviderModelLabel(entry.llmService, entry.llmModel),
      promptSource: promptArtifact,
      usage: formatPromptUsageTokenPair(entry.inputTokenCount, entry.outputTokenCount)
    })
  }

  const filteredRows = rows.filter((row) => row.promptSource !== null || row.usage !== null)
  if (filteredRows.length === 0) {
    return undefined
  }

  return {
    entries: filteredRows
  }
}
