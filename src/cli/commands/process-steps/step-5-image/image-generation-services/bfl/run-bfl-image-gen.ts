import * as v from 'valibot'
import type { BflImageModel, BflOutputFormat, Step5Metadata } from '~/types'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { downloadGeneratedImage, extractImageErrorMessage, readJsonOrText, runPolledJob, withImageProviderHeaders } from '~/utils/polled-job-client/polled-job'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'
import { ensureBflImageGenSetup, getBflBaseUrl } from './bfl-image-gen'
import { normalizeImageOutputFormat } from '../../image-utils/image-target-validation'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

export const BFL_OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const
const BflAsyncResponseSchema = v.object({
  id: v.string(),
  polling_url: v.string(),
  cost: v.optional(v.nullable(v.number()), undefined),
  input_mp: v.optional(v.nullable(v.number()), undefined),
  output_mp: v.optional(v.nullable(v.number()), undefined)
})

const BflPollResponseSchema = v.object({
  status: v.string(),
  result: v.optional(v.nullable(v.object({
    sample: v.optional(v.string(), undefined)
  })), undefined),
  cost: v.optional(v.nullable(v.number()), undefined),
  error: v.optional(v.unknown(), undefined),
  details: v.optional(v.unknown(), undefined)
})

export const normalizeBflImageSize = (
  size: string | undefined
): { width: number, height: number } | undefined => {
  if (size === undefined || size.length === 0) {
    return undefined
  }

  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim())
  if (!match) {
    throw UsageError(`Invalid --size value "${size}" for BFL. Expected WIDTHxHEIGHT, e.g. 1024x1024.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) {
    throw UsageError(`Invalid --size value "${size}" for BFL. Width and height must each be at least 64 pixels.`)
  }

  return { width, height }
}

export const normalizeBflImageOutputFormat = (format: string | undefined): BflOutputFormat =>
  normalizeImageOutputFormat(format, {
    allowed: BFL_OUTPUT_FORMATS,
    fallback: 'jpeg',
    providerLabel: 'BFL',
    expected: 'jpeg, png, or webp'
  })

export const getBflImageExtension = (format: string | undefined): string => {
  const outputFormat = normalizeBflImageOutputFormat(format)
  return outputFormat === 'jpeg' ? 'jpg' : outputFormat
}

export const runBflImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: BflImageModel, imageSize?: string | undefined, outputFormat?: string | undefined, inputs?: string[] | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = await ensureBflImageGenSetup()
  const dimensions = normalizeBflImageSize(options.imageSize)
  const outputFormat = normalizeBflImageOutputFormat(options.outputFormat)
  const inputs = options.inputs ?? []
  const mode = inputs.length > 0 ? 'edit' : 'generation'
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`

  const estimate = estimateImageCosts({ bflImageModels: [options.model], imageSize: options.imageSize })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logGenStatus('image', 'bfl', options.model, 'started', mode)

  const startTime = Date.now()
  const inputFields = Object.fromEntries(
    await Promise.all(inputs.map(async (input, index) => [
      index === 0 ? 'input_image' : `input_image_${index + 1}`,
      await imageReferenceToUrlOrDataUrl(input)
    ] as const))
  )
  const body = {
    prompt,
    output_format: outputFormat,
    ...inputFields,
    ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {})
  }

  const { created: createData, result: pollData } = await runPolledJob({
    operationName: 'bfl-image-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    create: {
      url: `${getBflBaseUrl()}/v1/${encodeURIComponent(options.model)}`,
      init: withImageProviderHeaders({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }, { 'x-key': apiKey }),
      schema: BflAsyncResponseSchema,
      context: 'BFL image generation create response',
      stage: 'image:bfl',
      errorMessage: 'BFL image request failed',
      readResponse: readJsonOrText,
      formatErrorBody: (payload) => extractImageErrorMessage(payload) ?? 'Unknown error'
    },
    poll: (created) => ({
      url: created.polling_url,
      init: withImageProviderHeaders({ method: 'GET' }, { 'x-key': apiKey }),
      schema: BflPollResponseSchema,
      context: 'BFL image generation poll response',
      stage: 'image:bfl',
      errorMessage: 'BFL image status query failed',
      readResponse: readJsonOrText,
      formatErrorBody: (payload) => extractImageErrorMessage(payload) ?? 'Unknown error'
    }),
    onPoll: (data) => logGenStatus('image', 'bfl', options.model, data.status),
    isDone: (data) => data.status.toLowerCase() === 'ready',
    isFailed: (data) => {
      const status = data.status.toLowerCase()
      if (status === 'error' || status === 'failed') {
        return { failed: true, reason: extractImageErrorMessage(data) ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })

  const sampleUrl = pollData.result?.sample
  if (!sampleUrl) {
    throw ValidationError('BFL image generation completed without result.sample', { stage: 'image:bfl' })
  }

  await downloadGeneratedImage({
    url: sampleUrl,
    outputPath,
    outputFormat,
    providerLabel: 'BFL',
    stage: 'image:bfl',
    operationName: 'bfl-image-result-download'
  })

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const providerCostCredits = typeof pollData.cost === 'number'
    ? pollData.cost
    : typeof createData.cost === 'number'
      ? createData.cost
      : undefined
  const providerCostCents = providerCostCredits ?? estimate?.totalCost

  logGenCompleted('image', 'bfl', options.model, processingTime, [outputPath])

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'bfl',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: imageFile.size,
      imageWidth: dimensions?.width,
      imageHeight: dimensions?.height,
      requestMode: mode,
      ...(providerCostCents !== undefined ? {
        providerCostCents,
        providerCostSource: providerCostCredits !== undefined ? 'provider_quote' : 'registry_fallback'
      } : {})
    }
  }
}
