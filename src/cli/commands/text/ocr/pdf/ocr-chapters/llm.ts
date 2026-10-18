import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { UsageError } from '~/utils/error-handler'
import { runLLM } from '~/cli/commands/text/write/run-llm'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import type { PageResult, PdfPageMapSpan, PdfTocEntry, ResolvedPdfChapter, TranscriptionResult, VideoMetadata } from '~/types'
import {
  dedupeResolvedChapters,
  findDetectedHeadingAnchorPage,
  findTitleAnchorPage
} from './detection'
import { excerptPageText } from './text'

const selectPagesForLlmDossier = (
  pages: PageResult[],
  tocPages: number[],
  localCandidates: ResolvedPdfChapter[]
): Array<{ pdfPage: number, excerpt: string }> => {
  const selected = new Set<number>()
  for (const tocPage of tocPages.slice(0, 4)) {
    selected.add(tocPage)
  }
  for (const chapter of localCandidates.slice(0, 20)) {
    selected.add(chapter.pdfStartPage)
  }
  for (let pageNumber = 1; pageNumber <= Math.min(10, pages.length); pageNumber++) {
    selected.add(pageNumber)
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((pdfPage) => ({
      pdfPage,
      excerpt: excerptPageText(pages.find((page) => page.pageNumber === pdfPage)?.text ?? '', 1200)
    }))
    .filter((entry) => entry.excerpt.length > 0)
}

const buildPdfChapterPrompt = (
  instruction: string,
  dossier: Record<string, unknown>
): string => `${instruction}

Use the dossier below to resolve major PDF chapter starts. Return JSON only.

PDF chapter dossier:
${JSON.stringify(dossier, null, 2)}`

const buildLlmOptions = (
  service: string,
  model: string,
  outputDir: string,
  promptBuilder: (instruction: string) => string
): Parameters<typeof runLLM>[2] => ({
  outputDir,
  prompts: ['pdfChapterBoundaries'],
  llmProviderConcurrency: DEFAULT_CLI_CONCURRENCY,
  llmLocalConcurrency: DEFAULT_CLI_CONCURRENCY,
  promptBuilder,
  ...(service === 'openai' ? { openaiModels: [model] } : {}),
  ...(service === 'gemini' ? { geminiModels: [model] } : {}),
  ...(service === 'anthropic' ? { anthropicModels: [model] } : {}),
  ...(service === 'grok' ? { grokModels: [model] } : {}),
})

export const resolveLlmCandidates = async (input: {
  title?: string
  author?: string
  pages: PageResult[]
  tocPages: number[]
  tocEntries: PdfTocEntry[]
  pageMapSpans: PdfPageMapSpan[]
  localCandidates: ResolvedPdfChapter[]
  llmService: string
  llmModel: string
}): Promise<ResolvedPdfChapter[] | undefined> => {
  if (!Object.hasOwn(WRITE_LLM_PROVIDER_TARGETS, input.llmService)) {
    throw UsageError(`Unsupported PDF chapter LLM provider ${input.llmService}. Select an active writing provider explicitly.`)
  }
  const configuredModels = getModelRegistry().llm[input.llmService]?.models
  if (!configuredModels || !Object.hasOwn(configuredModels, input.llmModel)) {
    throw UsageError(`Unsupported PDF chapter LLM model ${input.llmService}/${input.llmModel}. Select an active writing model explicitly.`)
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-pdf-chapters-llm-'))
  try {
    const metadata: VideoMetadata = {
      title: input.title ?? 'Document',
      duration: `${input.pages.length} pages`,
      channel: input.author ?? 'Unknown',
      description: 'PDF chapter boundary resolution',
      url: 'file://pdf-chapter-detection.local'
    }
    const transcription: TranscriptionResult = {
      text: '',
      segments: []
    }

    const dossier = {
      title: input.title,
      author: input.author,
      totalPages: input.pages.length,
      localCandidates: input.localCandidates.slice(0, 40),
      tocPages: input.tocPages,
      tocEntries: input.tocEntries.slice(0, 80),
      pageMapSpans: input.pageMapSpans,
      pageSnippets: selectPagesForLlmDossier(input.pages, input.tocPages, input.localCandidates)
    }

    const options = buildLlmOptions(
      input.llmService,
      input.llmModel,
      tempDir,
      (instruction) => buildPdfChapterPrompt(instruction, dossier)
    )
    const results = await runLLM(metadata, transcription, options)
    const parsed = results[0]?.parsedJson as { chapters?: Array<Record<string, unknown>> } | undefined
    const chapters = parsed?.chapters
    if (!Array.isArray(chapters)) {
      return undefined
    }

    const resolved: ResolvedPdfChapter[] = []
    for (const chapter of chapters) {
      const title = typeof chapter['title'] === 'string' ? chapter['title'].trim() : ''
      const pdfStartPage = typeof chapter['pdfStartPage'] === 'number' ? Math.trunc(chapter['pdfStartPage']) : NaN
      const printedStartPage = typeof chapter['printedStartPage'] === 'string' ? chapter['printedStartPage'].trim() : undefined
      const confidenceValue = typeof chapter['confidence'] === 'string' ? chapter['confidence'].trim().toLowerCase() : 'medium'
      if (!title || !Number.isFinite(pdfStartPage) || pdfStartPage < 1) {
        continue
      }
      resolved.push({
        title,
        pdfStartPage: findDetectedHeadingAnchorPage(title, pdfStartPage, input.pages, {
          radius: 10,
          allowGlobal: true
        }) ?? findTitleAnchorPage(title, pdfStartPage, input.pages, { radius: 10 }) ?? pdfStartPage,
        ...(printedStartPage ? { printedStartPage } : {}),
        source: 'llm',
        confidence: confidenceValue === 'high' ? 0.88 : confidenceValue === 'low' ? 0.55 : 0.72
      })
    }

    return dedupeResolvedChapters(resolved)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
