import type { DocumentMetadata, ExtractionOptions, HostedOcrImageResult, HostedOcrSchedulerRetryPressureHandler, OpenAIRestConfig, PageResult } from '~/types'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { assertHostedOcrImageWithinLimits, buildHostedOcrImageResult, readHostedOcrImageDataUrl, runHostedOcrDocument } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-utils'
import {
  DEEPINFRA_OCR_IMAGE_BYTES,
  getDeepinfraOcrClientConfig
} from './deepinfra-ocr'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'

const DEEPINFRA_OCR_MAX_TOKENS = 4092
const DEEPINFRA_OCR_IMAGE_MIME_TYPES: Partial<Record<DocumentMetadata['format'], string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided page image.',
  'Return only the text visible on the page.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty string.'
].join(' ')

const runDeepinfraOcrImage = async (
  config: OpenAIRestConfig,
  imagePath: string,
  format: DocumentMetadata['format'],
  model: string,
  pageNumber: number,
  pageLabel: string,
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
): Promise<HostedOcrImageResult> => {
  await assertHostedOcrImageWithinLimits(imagePath, pageLabel, {
    providerLabel: 'DeepInfra OCR',
    maxBytes: DEEPINFRA_OCR_IMAGE_BYTES,
    limitLabel: '20 MB'
  })
  const imageUrl = await readHostedOcrImageDataUrl(imagePath, format, {
    providerLabel: 'DeepInfra OCR',
    supportedMimeTypes: DEEPINFRA_OCR_IMAGE_MIME_TYPES
  })
  return await withOcrPageRequestRetry(
    `deepinfra-ocr ${pageLabel}`,
    async (signal) => {
      const response = await createOpenAIChatCompletion(config, {
        model,
        max_tokens: DEEPINFRA_OCR_MAX_TOKENS,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildOcrPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
      }, { signal, errorMessagePrefix: 'DeepInfra OCR request failed' })
      const rawText = extractOpenAIChatCompletionText(response) ?? ''

      return buildHostedOcrImageResult(pageNumber, rawText, {
        ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
        ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
      })
    },
    { onRetryable }
  )
}

export const runDeepinfraOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'outputDir' | 'ocrPreparationCache' | 'ocrConcurrency' | 'ocrConcurrencyMode' | 'hostedOcrScheduler'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'deepinfra-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const config = getDeepinfraOcrClientConfig()
  return await runHostedOcrDocument(filePath, step1Metadata, opts, {
    service: 'deepinfra',
    extractionMethod: 'deepinfra-ocr',
    tempDirPrefix: 'autoshow-deepinfra-ocr-',
    providerLabel: 'DeepInfra OCR',
    model,
    runImage: async (imagePath, format, pageNumber, pageLabel, onRetryable) =>
      await runDeepinfraOcrImage(config, imagePath, format, model, pageNumber, pageLabel, onRetryable)
  })
}
