import type { PromptUsageSection, WriteManifestMetadata, WriteManifestSourceRefs, WritePromptUsageRow } from '~/types'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { resolveReverbModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-model-labels'
import {
  buildProviderModelLabel,
  formatCount,
  formatPromptUsageTokenPair,
  formatSecondsShort,
  formatTokenCount,
  resolveWhisperModel
} from './manifest-log-formatting'
import {
  getActualCostBreakdown,
  getPartialStep2Entries,
  getTimingEntries,
  isExtractionMetadata,
  isStep2Metadata,
  isStep3Metadata,
  isStep4Metadata,
  isStep5Metadata,
  isStep6Metadata,
  isStep7Metadata,
  toArray
} from './manifest-log-metadata'
import { PROMPT_USAGE_COLUMNS } from './write-manifest-log-columns'

const resolveTtsCharacterCount = (metadata: WriteManifestMetadata, index: number): number | undefined => {
  const actualTtsRows = getTimingEntries(metadata, 'actual').filter((entry) => entry.step === 'tts')
  const actualValue = actualTtsRows[index]?.inputMetric === 'characters' ? actualTtsRows[index]?.inputValue : undefined
  if (typeof actualValue === 'number' && actualValue > 0) {
    return actualValue
  }

  const estimatedTtsRows = getTimingEntries(metadata, 'estimated').filter((entry) => entry.step === 'tts')
  const estimatedValue = estimatedTtsRows[index]?.inputMetric === 'characters' ? estimatedTtsRows[index]?.inputValue : undefined
  if (typeof estimatedValue === 'number' && estimatedValue > 0) {
    return estimatedValue
  }

  const actualCost = getActualCostBreakdown(metadata)
  const actualCostRow = actualCost?.steps.filter((entry) => entry.step === 'tts')[index]
  const costValue = actualCostRow?.inputMetric === 'characters' ? actualCostRow.inputValue : undefined
  return typeof costValue === 'number' && costValue > 0 ? costValue : undefined
}

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
  const step3RenderedOutput = refs.step3RenderedOutput ?? 'step3 rendered output'

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
      : entry.transcriptionService === 'reverb'
        ? resolveReverbModelLabel(entry.transcriptionModel)
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

  for (const [index, entry] of toArray(metadata['step4'], isStep4Metadata).entries()) {
    const characterCount = resolveTtsCharacterCount(metadata, index)
    const usage = [
      typeof characterCount === 'number' ? formatCount(characterCount, 'char', 'chars') : null,
      formatCount(entry.chunkCount, 'chunk', 'chunks')
    ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' / ')
    rows.push({
      step: 'TTS',
      providerModel: buildProviderModelLabel(entry.ttsService, entry.ttsModel),
      promptSource: step3RenderedOutput,
      usage: usage.length > 0 ? usage : null
    })
  }

  for (const entry of toArray(metadata['step5'], isStep5Metadata)) {
    rows.push({
      step: 'Image',
      providerModel: buildProviderModelLabel(entry.imageService, entry.imageModel),
      promptSource: step3RenderedOutput,
      usage: formatCount(entry.imageCount, 'image', 'images')
    })
  }

  for (const entry of toArray(metadata['step6'], isStep6Metadata)) {
    rows.push({
      step: 'Video',
      providerModel: buildProviderModelLabel(entry.videoGenService, entry.videoGenModel),
      promptSource: step3RenderedOutput,
      usage: typeof entry.videoDuration === 'number' && entry.videoDuration > 0 ? formatSecondsShort(entry.videoDuration) : null
    })
  }

  for (const entry of toArray(metadata['step7'], isStep7Metadata)) {
    rows.push({
      step: 'Music',
      providerModel: buildProviderModelLabel(entry.musicService, entry.musicModel),
      promptSource: step3RenderedOutput,
      usage: typeof entry.musicDurationMs === 'number' && entry.musicDurationMs > 0
        ? formatSecondsShort(entry.musicDurationMs / 1000)
        : null
    })
  }

  const filteredRows = rows.filter((row) => row.promptSource !== null || row.usage !== null)
  if (filteredRows.length === 0) {
    return undefined
  }

  return {
    columns: PROMPT_USAGE_COLUMNS,
    rows: filteredRows,
    humanTable: createHumanTable(filteredRows.map((row) => ({
      step: row.step,
      providerModel: row.providerModel,
      promptSource: row.promptSource ?? '',
      usage: row.usage ?? ''
    })), PROMPT_USAGE_COLUMNS)
  }
}
