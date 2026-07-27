import * as l from '~/utils/app-logger/app-logger'
import * as v from 'valibot'
import type { LumalabsImageModel, LumalabsImageRef, LumalabsOutputFormat, RetryClass, Step5Metadata } from '~/types'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { classifyFetchRetry, isRetryableStatus, pollUntil, withRetry } from '~/utils/retries'
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

const readJsonOrText = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (text.length === 0) return ''
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'details', 'failure_reason']) {
    const value = record[key]
    if (typeof value === 'string') return value
    if (value !== undefined) return JSON.stringify(value)
  }
  return JSON.stringify(payload)
}

const fetchLumalabsJson = async (
  url: string,
  apiKey: string,
  init: RequestInit
): Promise<{ response: Response, payload: unknown }> => {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  headers.set('authorization', `Bearer ${apiKey}`)

  const response = await fetch(url, {
    ...init,
    headers
  })
  const payload = await readJsonOrText(response)
  return { response, payload }
}

const downloadLumalabsImage = async (
  url: string,
  outputPath: string,
  outputFormat: LumalabsOutputFormat,
  signal?: AbortSignal | undefined
): Promise<void> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: `image/${outputFormat},image/*;q=0.9,*/*;q=0.8` },
    ...(signal ? { signal } : {})
  })
  if (!response.ok) {
    const err = new Error(`Luma Labs image result download failed (${response.status})`) as Error & {
      status: number
      headers: Headers
      stage: string
      retryClass: RetryClass
      retryable: boolean
    }
    err.status = response.status
    err.headers = response.headers
    err.stage = 'result-download'
    err.retryClass = 'runtime_http_read'
    err.retryable = isRetryableStatus(response.status)
    throw err
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw InfraError('Luma Labs image generation returned an empty image', { stage: 'image:lumalabs' })
  }
  await Bun.write(outputPath, bytes)
}

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

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'lumalabs',
    model: options.model,
    status: 'started',
    detail: mode
  })

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
      logMediaGenerationStatus(l, {
        mediaType: 'image',
        provider: 'lumalabs',
        model: options.model,
        status: data.state
      })
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
    async (signal) => await downloadLumalabsImage(resultUrl, outputPath, outputFormat, signal),
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const providerCostCents = estimate?.totalCost

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'lumalabs',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1,
    artifacts: [{ artifact: 'image', path: outputPath }]
  })

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
