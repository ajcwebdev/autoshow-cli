import * as v from 'valibot'
import type { LumalabsImageModel, LumalabsImageRef, LumalabsOutputFormat, Step5Metadata } from '~/types'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { downloadGeneratedImage, extractImageErrorMessage, fetchImageProviderJson } from '~/cli/commands/process-steps/step-5-image/image-utils/polled-image-http'
import { classifyFetchRetry, pollUntil, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { imageReferenceToInlineDataPart, isHttpUrl } from '../../image-utils/image-inputs'
import { ensureLumalabsImageGenSetup, getLumalabsBaseUrl } from './lumalabs-image-gen'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

export const LUMALABS_ASPECT_RATIOS = ['16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '2:1', '1:2'] as const
export const LUMALABS_OUTPUT_FORMATS = ['png', 'jpeg'] as const

const LumalabsGenerationSchema = v.object({
  id: v.string(),
  state: v.string(),
  failure_code: v.optional(v.nullable(v.string()), undefined),
  failure_reason: v.optional(v.nullable(v.string()), undefined),
  output: v.optional(v.nullable(v.array(v.object({
    type: v.optional(v.string(), undefined),
    url: v.string()
  }))), undefined)
})

export const normalizeLumalabsAspectRatio = (aspectRatio: string | undefined): string | undefined => {
  if (aspectRatio === undefined || aspectRatio.length === 0) {
    return undefined
  }

  if ((LUMALABS_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
    return aspectRatio
  }

  throw CLIUsageError(`Invalid --image-aspect-ratio value "${aspectRatio}" for Luma Labs. Supported values: ${LUMALABS_ASPECT_RATIOS.join(', ')}.`)
}

export const normalizeLumalabsImageOutputFormat = (format: string | undefined): LumalabsOutputFormat => {
  if (format === undefined || format.length === 0) {
    return 'png'
  }

  const normalized = format.toLowerCase()
  if ((LUMALABS_OUTPUT_FORMATS as readonly string[]).includes(normalized)) {
    return normalized as LumalabsOutputFormat
  }

  throw CLIUsageError(`Invalid --image-format value "${format}" for Luma Labs. Expected png or jpeg.`)
}

export const getLumalabsImageExtension = (format: string | undefined): string => {
  const outputFormat = normalizeLumalabsImageOutputFormat(format)
  return outputFormat === 'jpeg' ? 'jpg' : outputFormat
}

const toImageRef = async (input: string): Promise<LumalabsImageRef> => {
  if (isHttpUrl(input)) {
    return { url: input }
  }
  const inline = (await imageReferenceToInlineDataPart(input)).inlineData
  if (!inline?.data || !inline.mimeType) {
    throw ValidationError(`Unable to read image reference "${input}" for Luma Labs`, { stage: 'image:lumalabs' })
  }
  return { data: inline.data, media_type: inline.mimeType }
}

const extractErrorMessage = (payload: unknown): string | undefined =>
  extractImageErrorMessage(payload, ['failure_reason'])

const fetchLumalabsJson = async (
  url: string,
  apiKey: string,
  init: RequestInit
): Promise<{ response: Response, payload: unknown }> =>
  await fetchImageProviderJson(url, init, { authorization: `Bearer ${apiKey}` })

export const runLumalabsImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: LumalabsImageModel, aspectRatio?: string | undefined, outputFormat?: string | undefined, inputs?: string[] | undefined, baseUrl?: string | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = await ensureLumalabsImageGenSetup()
  const aspectRatio = normalizeLumalabsAspectRatio(options.aspectRatio)
  const outputFormat = normalizeLumalabsImageOutputFormat(options.outputFormat)
  const inputs = options.inputs ?? []
  const mode = inputs.length > 0 ? 'edit' : 'generation'
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`

  const estimate = estimateImageCosts({ lumalabsImageModel: options.model })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logGenStatus('image', 'lumalabs', options.model, 'started', mode)

  const startTime = Date.now()
  const imageRefs = await Promise.all(inputs.map(toImageRef))
  const body: Record<string, unknown> = {
    prompt,
    model: options.model,
    output_format: outputFormat,
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(mode === 'edit'
      ? {
        type: 'image_edit',
        source: imageRefs[0],
        ...(imageRefs.length > 1 ? { image_ref: imageRefs.slice(1) } : {})
      }
      : {
        type: 'image',
        ...(imageRefs.length > 0 ? { image_ref: imageRefs } : {})
      })
  }

  const { response: createResponse, payload: createPayload } = await fetchLumalabsJson(
    `${getLumalabsBaseUrl(options.baseUrl)}/generations`,
    apiKey,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  )

  if (!createResponse.ok) {
    throw InfraError(`Luma Labs image request failed (${createResponse.status}): ${extractErrorMessage(createPayload) ?? 'Unknown error'}`, { stage: 'image:lumalabs', status: createResponse.status })
  }

  const createData = validateData(LumalabsGenerationSchema, createPayload, 'Luma Labs image generation create response')

  const pollData = await pollUntil({
    operationName: 'lumalabs-image-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const { response, payload } = await fetchLumalabsJson(`${getLumalabsBaseUrl(options.baseUrl)}/generations/${encodeURIComponent(createData.id)}`, apiKey, { method: 'GET' })
      if (!response.ok) {
        throw InfraError(`Luma Labs image status query failed (${response.status}): ${extractErrorMessage(payload) ?? 'Unknown error'}`, { stage: 'image:lumalabs', status: response.status })
      }
      const data = validateData(LumalabsGenerationSchema, payload, 'Luma Labs image generation poll response')
      logGenStatus('image', 'lumalabs', options.model, data.state)
      return data
    },
    isDone: (data) => data.state.toLowerCase() === 'completed',
    isFailed: (data) => {
      if (data.state.toLowerCase() === 'failed') {
        const reason = data.failure_reason ?? data.failure_code ?? 'Unknown error'
        return { failed: true, reason }
      }
      return { failed: false }
    }
  })

  const resultUrl = pollData.output?.[0]?.url
  if (!resultUrl) {
    throw ValidationError('Luma Labs image generation completed without an output URL', { stage: 'image:lumalabs' })
  }

  await withRetry(
    { retryClass: 'runtime_http_read', operationName: 'lumalabs-image-result-download' },
    async (signal) => await downloadGeneratedImage({
      url: resultUrl, outputPath, outputFormat, providerLabel: 'Luma Labs', stage: 'image:lumalabs', signal
    }),
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const providerCostCents = estimate?.totalCost

  logGenCompleted('image', 'lumalabs', options.model, processingTime, [outputPath])

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'lumalabs',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined,
      imageFormat: outputFormat,
      requestMode: mode,
      ...(providerCostCents !== undefined ? {
        providerCostCents,
        providerCostSource: 'registry_fallback'
      } : {})
    }
  }
}
