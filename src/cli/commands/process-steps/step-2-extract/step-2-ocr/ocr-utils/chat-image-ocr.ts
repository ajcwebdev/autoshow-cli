import type { DocumentMetadata, ExtractionOptions, HostedOcrImageResult, HostedOcrSchedulerRetryPressureHandler, HostedOcrService, OpenAIChatCompletionResponse, OpenAIRestConfig, PageResult } from '~/types'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'
import { withOcrPageRequestRetry } from './ocr-retry'
import { assertHostedOcrImageWithinLimits, buildHostedOcrImageResult, readHostedOcrImageDataUrl, runHostedOcrDocument } from './hosted-ocr-utils'

type ChatImageOcrBodyInput = {
  model: string
  messages: Array<{
    role: 'user'
    content: Array<
      | { type: 'text', text: string }
      | { type: 'image_url', image_url: { url: string } }
    >
  }>
}

type ChatImageOcrProfile<TExtractionMethod extends string> = {
  service: HostedOcrService
  extractionMethod: TExtractionMethod
  tempDirPrefix: string
  providerLabel: string
  maxImageBytes: number
  imageLimitLabel: string
  supportedMimeTypes: Partial<Record<DocumentMetadata['format'], string>>
  prompt: string
  errorMessagePrefix: string
  getConfig: (baseUrl?: string) => OpenAIRestConfig
  buildBody: (input: ChatImageOcrBodyInput) => Record<string, unknown>
  checkResponse?: ((response: OpenAIChatCompletionResponse, rawText: string, pageLabel: string) => void) | undefined
}

type ChatImageOcrOptions = Pick<ExtractionOptions, 'dpi' | 'password' | 'outputDir' | 'ocrPreparationCache' | 'ocrConcurrency' | 'ocrConcurrencyMode' | 'hostedOcrScheduler'>

export const createChatImageOcrRunner = <TExtractionMethod extends string>(
  profile: ChatImageOcrProfile<TExtractionMethod>
): (
    filePath: string,
    step1Metadata: DocumentMetadata,
    model: string,
    opts: ChatImageOcrOptions,
    baseUrl?: string
  ) => Promise<{
    pages: PageResult[]
    extractionMethod: TExtractionMethod
    totalPages: number
    promptTokens?: number
    completionTokens?: number
  }> => {
  const runImage = async (
    config: OpenAIRestConfig,
    imagePath: string,
    format: DocumentMetadata['format'],
    model: string,
    pageNumber: number,
    pageLabel: string,
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
  ): Promise<HostedOcrImageResult> => {
    await assertHostedOcrImageWithinLimits(imagePath, pageLabel, {
      providerLabel: profile.providerLabel,
      maxBytes: profile.maxImageBytes,
      limitLabel: profile.imageLimitLabel
    })
    const imageUrl = await readHostedOcrImageDataUrl(imagePath, format, {
      providerLabel: profile.providerLabel,
      supportedMimeTypes: profile.supportedMimeTypes
    })

    return await withOcrPageRequestRetry(
      `${profile.extractionMethod} ${pageLabel}`,
      async (signal) => {
        const messages: ChatImageOcrBodyInput['messages'] = [{
          role: 'user',
          content: [
            { type: 'text', text: profile.prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
        const response = await createOpenAIChatCompletion(
          config,
          profile.buildBody({ model, messages }),
          { signal, errorMessagePrefix: profile.errorMessagePrefix }
        )
        const rawText = extractOpenAIChatCompletionText(response) ?? ''
        profile.checkResponse?.(response, rawText, pageLabel)

        return buildHostedOcrImageResult(pageNumber, rawText, {
          ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
          ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
        })
      },
      { onRetryable }
    )
  }

  return async (filePath, step1Metadata, model, opts, baseUrl) => {
    const config = profile.getConfig(baseUrl)
    return await runHostedOcrDocument(filePath, step1Metadata, opts, {
      service: profile.service,
      extractionMethod: profile.extractionMethod,
      tempDirPrefix: profile.tempDirPrefix,
      providerLabel: profile.providerLabel,
      model,
      runImage: async (imagePath, format, pageNumber, pageLabel, onRetryable) =>
        await runImage(config, imagePath, format, model, pageNumber, pageLabel, onRetryable)
    })
  }
}
