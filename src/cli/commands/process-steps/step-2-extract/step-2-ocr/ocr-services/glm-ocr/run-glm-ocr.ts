import { httpResponseError, httpResponseOptions, isRecord } from '~/utils/rest-client'
import { extname } from 'node:path'
import type { DocumentMetadata, HostedOcrSchedulerRetryPressureHandler, NormalizedReasoningEffort, PageResult } from '~/types'
import { GlmOcrResponseSchema } from '~/types'
import { withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { validateData } from '~/utils/validate/validation'
import { ensureGlmApiKey, resolveGlmBaseUrl } from './glm'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'


const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const getMimeType = (filePath: string, format: DocumentMetadata['format']): string => {
  if (format === 'pdf') return 'application/pdf'
  if (format === 'png') return 'image/png'
  if (format === 'jpg') return 'image/jpeg'

  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

const buildPagesFromLayoutDetails = (layoutDetails: Array<Array<Record<string, unknown>>>): PageResult[] => {
  return layoutDetails.map((pageItems, index) => ({
    pageNumber: index + 1,
    method: 'ocr',
    text: pageItems
      .map((item) => cleanString(item['content']))
      .filter((value): value is string => typeof value === 'string')
      .join('\n\n')
      .trim()
  }))
}

export const runGlmOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: {
    onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
  } = {}
): Promise<{
  pages: PageResult[]
  extractionMethod: 'glm-ocr'
  markdown: string
  totalPages?: number
  promptTokens?: number
  completionTokens?: number
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}> => {
  const policy = resolveReasoningPolicy({
    step: 'extract',
    service: 'glm',
    model,
    requestedReasoningEffort: options.reasoningEffort
  })
  const apiKey = ensureGlmApiKey('GLM OCR', 'ocr:glm')
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = getMimeType(filePath, step1Metadata.format)

  const payload = await withOcrCreateRetry('glm-ocr', async (signal) => {
    const bodyObj: Record<string, unknown> = {
      model,
      file: `data:${mimeType};base64,${base64}`
    }
    const response = await fetch(`${resolveGlmBaseUrl()}/layout_parsing`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyObj),
      signal: signal ?? null
    })

    const rawText = await response.text()
    let parsedPayload: unknown = null
    try {
      parsedPayload = JSON.parse(rawText) as unknown
    } catch {
      parsedPayload = rawText
    }

    if (!response.ok) {
      const message = isRecord(parsedPayload)
        ? cleanString(parsedPayload['message']) ?? cleanString(parsedPayload['error'])
        : undefined
      throw httpResponseError(
        `GLM OCR request failed (${response.status} ${response.statusText})${message ? `: ${message}` : ''}`,
        httpResponseOptions(response, {
          stage: 'ocr:glm',
          retryClass: 'runtime_http_create_conservative',
          retryable: response.status === 425 || response.status === 429,
          metadata: { provider: 'glm' }
        })
      )
    }

    return parsedPayload
  }, { onRetryable: options.onRetryable })

  const validated = validateData(GlmOcrResponseSchema, payload, 'GLM OCR response')
  const markdown = validated.md_results.trim()
  const pagesFromLayout = Array.isArray(validated.layout_details)
    ? buildPagesFromLayoutDetails(validated.layout_details as Array<Array<Record<string, unknown>>>)
    : []
  const pages = pagesFromLayout.length > 0
    ? pagesFromLayout
    : [{
        pageNumber: 1,
        method: 'ocr' as const,
        text: markdown
      }]

  return {
    pages,
    extractionMethod: 'glm-ocr',
    markdown,
    ...(typeof validated.data_info?.num_pages === 'number' ? { totalPages: validated.data_info.num_pages } : {}),
    ...(typeof validated.usage?.prompt_tokens === 'number' ? { promptTokens: validated.usage.prompt_tokens } : {}),
    ...(typeof validated.usage?.completion_tokens === 'number' ? { completionTokens: validated.usage.completion_tokens } : {}),
    ...(policy.requested !== undefined ? { requestedReasoningEffort: policy.requested } : {}),
    effectiveReasoningEffort: policy.effective
  }
}
