import { extname } from 'node:path'
import type { DocumentMetadata, HostedOcrSchedulerRetryPressureHandler, PageResult } from '~/types'
import { MistralOcrResponseSchema } from '~/types'
import { withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { requireApiKey } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const imageMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

export const runMistralOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: { baseURL?: string | undefined, onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined } = {}
): Promise<{ pages: PageResult[], extractionMethod: 'mistral-ocr' }> => {
  const baseURL = options.baseURL ?? MISTRAL_DEFAULT_BASE_URL
  const onRetryable = options.onRetryable
  const apiKey = requireApiKey('MISTRAL_API_KEY', 'ocr:mistral', 'Mistral OCR')

  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const rawPayload: unknown = step1Metadata.format === 'pdf'
    ? await withOcrCreateRetry('mistral-ocr', async (signal) => await mistralJsonRequest({
        apiKey,
        baseURL,
        path: '/ocr',
        signal,
        errorMessagePrefix: 'Mistral OCR failed',
        body: {
          model,
          document: {
            type: 'document_url',
            document_url: `data:application/pdf;base64,${base64}`
          },
          include_image_base64: false
        }
      }), { onRetryable })
    : await withOcrCreateRetry('mistral-ocr', async (signal) => await mistralJsonRequest({
        apiKey,
        baseURL,
        path: '/ocr',
        signal,
        errorMessagePrefix: 'Mistral OCR failed',
        body: {
          model,
          document: {
            type: 'image_url',
            image_url: `data:${imageMimeType(filePath)};base64,${base64}`
          },
          include_image_base64: false
        }
      }), { onRetryable })

  const payload = validateData(MistralOcrResponseSchema, rawPayload, 'Mistral OCR response')
  const pages: PageResult[] = payload.pages.map(page => ({
    pageNumber: page.index,
    method: 'ocr',
    text: page.markdown
  }))

  return { pages, extractionMethod: 'mistral-ocr' }
}
