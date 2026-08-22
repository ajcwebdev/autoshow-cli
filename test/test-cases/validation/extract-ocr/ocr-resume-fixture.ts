import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { logIncompleteOcrRunSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-runner'
import type { DocumentMetadata, HostedOcrRun, OcrProviderState, OcrTarget, PageResult, ProcessDocumentOutput, ResumeTarget } from '~/types'

export const requestedTargets: OcrTarget[] = [
  { service: 'tesseract', model: 'tesseract' },
  { service: 'mistral', model: 'mistral-ocr' },
  { service: 'anthropic', model: 'claude-sonnet-5' }
]
export const tesseractTarget = requestedTargets[0] as OcrTarget
export const mistralTarget = requestedTargets[1] as OcrTarget
export const anthropicTarget = requestedTargets[2] as OcrTarget

export const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 4,
  format: 'pdf',
  fileSize: 12_345
}

export const hostedRun = (pages: PageResult[], extras: Partial<HostedOcrRun> = {}): HostedOcrRun => ({
  pages,
  extractionMethod: 'openai-ocr',
  ocrService: 'openai',
  ocrModel: 'test-model',
  ...extras
})

export const pageCachePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.json`)

export const pageTextPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.txt`)

export const writeCachedPage = async (
  dir: string,
  pageNumber: number,
  totalPages: number,
  run: HostedOcrRun = hostedRun([{ pageNumber, method: 'ocr', text: `page ${pageNumber}` }], { totalPages: 1 })
): Promise<void> => {
  await mkdir(join(dir, 'page-results'), { recursive: true })
  await Bun.write(pageCachePath(dir, pageNumber), JSON.stringify({
    version: 2,
    mode: 'single-page',
    totalPages,
    pageNumber,
    sourceFile: 'input.pdf',
    run
  }, null, 2) + '\n')
}

export const providerState = (
  target: OcrTarget,
  status: OcrProviderState['status'],
  lastError: OcrProviderState['lastError'] = { message: `${target.service} failed` }
): OcrProviderState => ({
  service: target.service,
  model: target.model,
  artifactDir: `providers/${target.service}-${target.model}`,
  status,
  attempts: status === 'succeeded' ? 1 : 2,
  ...(status === 'failed' ? { lastError } : {})
})

export const ocrResumeTarget = (dir: string): ResumeTarget => ({
  kind: 'extract',
  extractRoute: 'document',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

export const summaryExtraction = (
  overrides: Partial<ProcessDocumentOutput>
): Parameters<typeof logIncompleteOcrRunSummary>[0] => ({
  outputDir: '/tmp/autoshow-ocr-output',
  completionStatus: 'incomplete',
  requestedProviders: requestedTargets,
  step2Metadata: [{
    extractionMethod: 'mutool+tesseract',
    totalPages: 1,
    ocrPages: 1,
    textPages: 0,
    processingTime: 10,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 12,
    inputFamily: 'pdf'
  }],
  missingProviders: [],
  blockedProviders: [],
  providerStates: [],
  step2Errors: [],
  ...overrides
} as Parameters<typeof logIncompleteOcrRunSummary>[0])
