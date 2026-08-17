import { extname } from 'node:path'
import type { PageResult } from '~/types'
import { runFalQueue } from '~/utils/fal-client/fal-queue'
import { ValidationError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'

const imageMimeType = (filePath: string): string => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

type FalGotOcrOutput = { outputs?: unknown }
type FalFlorenceOcrOutput = { results?: unknown }

export const runFalOcr = async (
  filePath: string,
  model: string
): Promise<{ pages: PageResult[], extractionMethod: 'fal-ocr' }> => {
  const apiKey = requireApiKey('FAL_API_KEY', 'ocr:fal', 'fal.ai OCR')
  const bytes = await Bun.file(filePath).arrayBuffer()
  const mimeType = imageMimeType(filePath)
  const input = model === 'fal-ai/florence-2-large/ocr'
    ? { image_url: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}` }
    : {
        input_image_urls: [`data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`],
        do_format: true,
        multi_page: false
      }
  const { output } = await runFalQueue<FalGotOcrOutput | FalFlorenceOcrOutput>({
    apiKey,
    endpointId: model,
    input,
    operationName: 'fal.ai OCR'
  })
  const gotOutputs = (output as FalGotOcrOutput).outputs
  const text = model === 'fal-ai/florence-2-large/ocr'
    ? (output as FalFlorenceOcrOutput).results
    : Array.isArray(gotOutputs) && gotOutputs.every((item): item is string => typeof item === 'string')
      ? (gotOutputs as string[]).join('\n')
      : undefined
  if (typeof text !== 'string') {
    throw ValidationError(`fal.ai ${model === 'fal-ai/florence-2-large/ocr' ? 'Florence OCR' : 'GOT-OCR'} completed without extracted text`, { stage: 'ocr:fal:response' })
  }
  const normalizedText = text.trim()
  if (!normalizedText) throw ValidationError('fal.ai OCR completed without extracted text', { stage: 'ocr:fal:response' })
  return { pages: [{ pageNumber: 0, method: 'ocr', text: normalizedText }], extractionMethod: 'fal-ocr' }
}
