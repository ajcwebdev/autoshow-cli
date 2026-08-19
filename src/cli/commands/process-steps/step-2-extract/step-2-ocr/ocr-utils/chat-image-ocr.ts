import type { ChatImageOcrBodyInput, ChatImageOcrOptions, ChatImageOcrProfile, DocumentMetadata, HostedOcrImageResult, HostedOcrSchedulerRetryPressureHandler, MappedReasoningPolicy, NormalizedReasoningEffort, OpenAIRestConfig, PageResult } from '~/types'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/openai-client'
import { withOcrPageRequestRetry } from './ocr-retry'
import { assertHostedOcrImageWithinLimits, buildHostedOcrImageResult, readHostedOcrImageDataUrl } from './hosted-ocr-utils'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

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
    requestedReasoningEffort?: NormalizedReasoningEffort | undefined
    effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
  }> => {
  const runImage = async (
    config: OpenAIRestConfig,
    imagePath: string,
    format: DocumentMetadata['format'],
    model: string,
    pageNumber: number,
    pageLabel: string,
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined,
    reasoningPolicy?: MappedReasoningPolicy | undefined
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
          profile.buildBody({
            model,
            messages,
            reasoningPolicy: reasoningPolicy ?? { requested: undefined, effective: 'default' }
          }),
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
    const policy = resolveReasoningPolicy({
      step: 'extract',
      service: profile.service,
      model,
      requestedReasoningEffort: opts.reasoningEffort
    })
    const config = profile.getConfig(baseUrl)
    const result = await runImage(
      config,
      filePath,
      step1Metadata.format,
      model,
      1,
      typeof opts.documentPageNumber === 'number' ? `page ${opts.documentPageNumber}` : 'input image',
      opts.onRetryable,
      policy
    )
    return {
      pages: [result.page],
      extractionMethod: profile.extractionMethod,
      totalPages: 1,
      ...(typeof result.promptTokens === 'number' ? { promptTokens: result.promptTokens } : {}),
      ...(typeof result.completionTokens === 'number' ? { completionTokens: result.completionTokens } : {}),
      ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
      effectiveReasoningEffort: policy.effective
    }
  }
}
