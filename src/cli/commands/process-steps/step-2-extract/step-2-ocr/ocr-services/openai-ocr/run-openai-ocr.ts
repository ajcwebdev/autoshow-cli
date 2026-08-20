import { withOcrCreateRetry, withOcrSchemaRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import type { DocumentMetadata, HostedOcrSchedulerRetryPressureHandler, NormalizedReasoningEffort, OpenAIOcrInputContent, PageResult } from '~/types'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { buildHostedOcrJsonPrompt, createHostedOcrResponseParser, HOSTED_OCR_PAGES_JSON_SCHEMA } from '../../ocr-utils/hosted-ocr-json'
import { InternalError } from '~/utils/error-handler'
import { applyOpenAIResponsesReasoning } from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'

const OPENAI_NATIVE_STRUCTURED_MODELS = new Set([
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
])

const getImageMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'png':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      throw InternalError(`Unsupported OpenAI OCR image format: ${format}`, { stage: 'ocr:openai' })
  }
}

const supportsNativeStructuredOutput = (model: string): boolean =>
  OPENAI_NATIVE_STRUCTURED_MODELS.has(model)

const buildSchemaGuidedPrompt = (expectedPageCount: number): string => [
  buildHostedOcrJsonPrompt(expectedPageCount),
  'Use this exact JSON shape:',
  JSON.stringify(HOSTED_OCR_PAGES_JSON_SCHEMA)
].join('\n\n')

const buildSinglePageTextPrompt = (): string => [
  'Perform OCR on the provided single page.',
  'Return only the visible text from the page.',
  'Do not summarize, explain, translate, or wrap the text in JSON.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty response.'
].join(' ')

const parseOcrResponse = createHostedOcrResponseParser('OpenAI OCR', 'ocr:openai')

const parseSinglePageOcrResponse = (rawText: string): PageResult[] => {
  try {
    return parseOcrResponse(rawText, 1)
  } catch {
    return [{
      pageNumber: 1,
      method: 'ocr' as const,
      text: rawText.trim()
    }]
  }
}

const createInputContent = async (
  filePath: string,
  step1Metadata: DocumentMetadata
): Promise<OpenAIOcrInputContent> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  if (step1Metadata.format === 'pdf') {
    return {
      type: 'input_file',
      filename: 'document.pdf',
      file_data: `data:application/pdf;base64,${base64}`
    }
  }

  return {
    type: 'input_image',
    detail: 'high',
    image_url: `data:${getImageMimeType(step1Metadata.format)};base64,${base64}`
  }
}

const createRequestBody = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  expectedPageCount: number
): Promise<Record<string, unknown>> => {
  const inputContent = await createInputContent(filePath, step1Metadata)
  const nativeStructured = supportsNativeStructuredOutput(model)
  const singlePageText = expectedPageCount === 1

  const requestBody: Record<string, unknown> = {
    model,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: singlePageText
            ? buildSinglePageTextPrompt()
            : nativeStructured
            ? buildHostedOcrJsonPrompt(expectedPageCount)
            : buildSchemaGuidedPrompt(expectedPageCount)
        },
        inputContent
      ]
    }]
  }

  if (singlePageText) {
    requestBody['text'] = {
      verbosity: 'low'
    }
  } else if (nativeStructured) {
    requestBody['text'] = {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ocr_pages',
        schema: HOSTED_OCR_PAGES_JSON_SCHEMA,
        strict: true
      }
    }
  } else {
    requestBody['text'] = {
      verbosity: 'low'
    }
  }

  return requestBody
}

export const runOpenAIOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: {
    baseUrl?: string | undefined
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  } = {}
): Promise<{
  pages: PageResult[]
  extractionMethod: 'openai-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}> => {
  const policy = resolveReasoningPolicy({
    step: 'extract',
    service: 'openai',
    model,
    requestedReasoningEffort: options.reasoningEffort
  })
  const expectedPageCount = Math.max(1, step1Metadata.pageCount)
  const { baseUrl, onRetryable } = options
  const config = getOpenAIClientConfig(baseUrl)

  return await withOcrSchemaRetry({
    operationName: 'openai-ocr',
    request: async () => {
      const requestBody = await createRequestBody(filePath, step1Metadata, model, expectedPageCount)
      applyOpenAIResponsesReasoning(requestBody, policy.effective)
      return await withOcrCreateRetry(
        'openai-ocr',
        async (signal) => await createOpenAIResponse(config, requestBody, { signal }),
        { onRetryable }
      )
    },
    parse: (response) => {
      const rawText = extractOpenAIResponseText(response) ?? ''
      const usage = {
        ...(typeof response.usage?.input_tokens === 'number' ? { promptTokens: response.usage.input_tokens } : {}),
        ...(typeof response.usage?.output_tokens === 'number' ? { completionTokens: response.usage.output_tokens } : {}),
        ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
        effectiveReasoningEffort: policy.effective
      }

      if (!rawText.trim()) {
        if (expectedPageCount === 1) {
          return {
            pages: [{ pageNumber: 1, method: 'ocr' as const, text: '' }],
            extractionMethod: 'openai-ocr' as const,
            totalPages: 1,
            ...usage
          }
        }
        throw new OcrStructuredResponseError('OpenAI OCR returned no text output.', rawText)
      }

      const pages = expectedPageCount === 1
        ? parseSinglePageOcrResponse(rawText)
        : parseOcrResponse(rawText, expectedPageCount)

      return {
        pages,
        extractionMethod: 'openai-ocr' as const,
        totalPages: pages.length,
        ...usage
      }
    },
    retryLogMetadata: () => ({ provider: 'openai', pageCount: expectedPageCount })
  })
}
