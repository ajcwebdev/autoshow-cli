import { basename } from 'node:path'
import type { GeminiContent, GeminiFetchOptions, GeminiFile, GeminiGenerateContentResponse, GeminiGeneratedVideo, GeminiInlineMedia, GeminiPart, GeminiVideo, GeminiVideoImageMedia, GeminiVideoOperation, GeminiVideoReferenceImage } from '~/types'
import { buildCaptureMetadata, redactPayloadPreview } from '~/utils/bounded-capture'
import { AppError, AppProviderError, InfraError, ValidationError } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { createProviderRestClient, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { pollUntil } from '~/utils/retries'
import { isObjectLike } from '~/utils/value-helpers'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com'
const GEMINI_API_VERSION = 'v1beta'
const GEMINI_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024

export class GeminiRestError extends AppProviderError {
  override readonly status: number
  override readonly headers: Headers
  body: unknown
  bodyBytes?: number | undefined
  bodyTruncated?: boolean | undefined
  bodyPreview?: string | undefined

  constructor(message: string, status: number, headers: Headers, body: unknown) {
    super(message, { status, headers, stage: 'gemini' })
    this.name = 'GeminiRestError'
    this.status = status
    this.headers = headers
    this.body = body
  }
}

const buildGeminiUrl = (path: string, params?: Record<string, string>): string => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const url = new URL(`${GEMINI_API_BASE_URL}/${normalizedPath}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const buildV1BetaUrl = (path: string, params?: Record<string, string>): string =>
  buildGeminiUrl(`${GEMINI_API_VERSION}/${path}`, params)

const formatGeminiErrorMessage = (body: unknown, status: number): string => {
  if (isObjectLike(body) && isObjectLike(body['error'])) {
    const error = body['error']
    const message = typeof error['message'] === 'string' ? error['message'] : JSON.stringify(body)
    const code = typeof error['code'] === 'number' ? error['code'] : status
    return `Gemini API request failed with status ${code}: ${sanitizeLogText(message)}`
  }
  if (typeof body === 'string' && body.length > 0) {
    return `Gemini API request failed with status ${status}: ${sanitizeLogText(body)}`
  }
  return `Gemini API request failed with status ${status}`
}

const requestGemini = createProviderRestClient<GeminiFetchOptions, GeminiRestError>({
  buildRequest: (options) => options,
  errorMessagePrefix: () => 'Gemini API request failed',
  formatErrorMessage: ({ parsedBody, response }) => formatGeminiErrorMessage(parsedBody, response.status),
  createError: ({ response, parsedBody, message }) =>
    new GeminiRestError(message, response.status, response.headers, redactPayloadPreview(parsedBody)),
  diagnostics: 'parsed-body'
})

const geminiFetch = async (url: string, init: RequestInit): Promise<Response> =>
  await requestGemini({ url, init })

const geminiJsonRequest = async (
  apiKey: string,
  path: string,
  init: {
    method: 'GET' | 'POST' | 'DELETE'
    body?: unknown
    abortSignal?: AbortSignal | undefined
  }
): Promise<{ json: unknown, headers: Headers, status: number }> => {
  const url = buildV1BetaUrl(path)
  const headers = new Headers()
  headers.set('x-goog-api-key', apiKey)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await geminiFetch(url, {
    method: init.method,
    headers,
    ...(init.body !== undefined ? { body: typeof init.body === 'string' ? init.body : JSON.stringify(init.body) } : {}),
    ...(init.abortSignal ? { signal: init.abortSignal } : {})
  })
  return {
    json: await readJsonResponse(response, 'Gemini API response', { invalidJsonMessagePrefix: 'Gemini API' }),
    headers: response.headers,
    status: response.status
  }
}

const geminiBinaryRequest = async (
  apiKey: string,
  path: string,
  query?: Record<string, string>
): Promise<{ bytes: Uint8Array, headers: Headers, status: number }> => {
  const url = buildV1BetaUrl(path, query)
  const response = await geminiFetch(url, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey
    }
  })
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    headers: response.headers,
    status: response.status
  }
}

const normalizeGeminiModelPath = (model: string): string => {
  if (!model || model.includes('..') || model.includes('?') || model.includes('&')) {
    throw ValidationError('invalid Gemini model parameter', { stage: 'gemini:rest' })
  }
  return model.startsWith('models/') || model.startsWith('tunedModels/')
    ? model
    : `models/${model}`
}

const encodePath = (path: string): string =>
  path.split('/').map((part) => encodeURIComponent(part)).join('/')

export const geminiFileDataPart = (uri: string, mimeType: string): GeminiPart => ({
  fileData: {
    fileUri: uri,
    mimeType
  }
})

export const geminiUserContent = (parts: Array<GeminiPart | string>): GeminiContent => ({
  role: 'user',
  parts: parts.map((part) => typeof part === 'string' ? { text: part } : part)
})

const normalizeGeminiContents = (
  contents: string | GeminiPart | GeminiContent | Array<string | GeminiPart | GeminiContent>
): GeminiContent[] => {
  if (typeof contents === 'string') {
    return [geminiUserContent([contents])]
  }
  if (isObjectLike(contents) && Array.isArray(contents['parts'])) {
    return [contents as GeminiContent]
  }
  if (!Array.isArray(contents)) {
    return [geminiUserContent([contents as GeminiPart])]
  }
  if (contents.length > 0 && isObjectLike(contents[0]) && Array.isArray((contents[0] as Record<string, unknown>)['parts'])) {
    return contents as GeminiContent[]
  }
  return [geminiUserContent(contents as Array<string | GeminiPart>)]
}

const extractGeminiResponseText = (response: GeminiGenerateContentResponse): string | undefined => {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  let text = ''
  let found = false
  for (const part of parts) {
    if (part.thought === true || typeof part.text !== 'string') {
      continue
    }
    found = true
    text += part.text
  }
  return found ? text : undefined
}

export const geminiGenerateContent = async (
  apiKey: string,
  params: {
    model: string
    contents: string | GeminiPart | GeminiContent | Array<string | GeminiPart | GeminiContent>
    generationConfig?: Record<string, unknown> | undefined
    tools?: unknown[] | undefined
    systemInstruction?: string | GeminiContent | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<GeminiGenerateContentResponse> => {
  const body: Record<string, unknown> = {
    contents: normalizeGeminiContents(params.contents)
  }
  if (params.generationConfig) {
    body['generationConfig'] = params.generationConfig
  }
  if (params.tools) {
    body['tools'] = params.tools
  }
  if (params.systemInstruction) {
    body['systemInstruction'] = typeof params.systemInstruction === 'string'
      ? { parts: [{ text: params.systemInstruction }] }
      : params.systemInstruction
  }
  const modelPath = normalizeGeminiModelPath(params.model)
  const { json, headers, status } = await geminiJsonRequest(apiKey, `${encodePath(modelPath)}:generateContent`, {
    method: 'POST',
    body,
    ...(params.abortSignal ? { abortSignal: params.abortSignal } : {})
  })
  const response = isObjectLike(json) ? json as GeminiGenerateContentResponse : {}
  response.text = extractGeminiResponseText(response)
  response.sdkHttpResponse = { headers, status }
  return response
}

export const geminiPredictLongRunning = async (
  apiKey: string,
  params: {
    model: string
    prompt?: string | undefined
    numberOfVideos: number
    durationSeconds: number
    resolution: string
    aspectRatio?: string | undefined
    image?: GeminiVideoImageMedia | undefined
    lastFrame?: GeminiInlineMedia | undefined
    referenceImages?: GeminiVideoReferenceImage[] | undefined
    video?: GeminiInlineMedia | undefined
  }
): Promise<GeminiVideoOperation> => {
  const body: Record<string, unknown> = {
    instances: [{
      ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
      ...(params.image ? { image: params.image } : {}),
      ...(params.lastFrame ? { lastFrame: params.lastFrame } : {}),
      ...(params.referenceImages && params.referenceImages.length > 0 ? { referenceImages: params.referenceImages } : {}),
      ...(params.video ? { video: params.video } : {})
    }],
    parameters: {
      sampleCount: params.numberOfVideos,
      durationSeconds: params.durationSeconds,
      resolution: params.resolution,
      ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {})
    }
  }
  const modelPath = normalizeGeminiModelPath(params.model)
  const { json } = await geminiJsonRequest(apiKey, `${encodePath(modelPath)}:predictLongRunning`, {
    method: 'POST',
    body
  })
  return normalizeGeminiVideoOperation(json)
}

export const geminiGetOperation = async (
  apiKey: string,
  operationName: string
): Promise<GeminiVideoOperation> => {
  const { json } = await geminiJsonRequest(apiKey, encodePath(operationName), {
    method: 'GET'
  })
  return normalizeGeminiVideoOperation(json)
}

const normalizeGeminiVideoOperation = (value: unknown): GeminiVideoOperation => {
  const raw = isObjectLike(value) ? value : {}
  const operation: GeminiVideoOperation = {
    ...(typeof raw['name'] === 'string' ? { name: raw['name'] } : {}),
    ...(typeof raw['done'] === 'boolean' ? { done: raw['done'] } : {}),
    ...(raw['metadata'] !== undefined ? { metadata: raw['metadata'] } : {}),
    ...(raw['error'] !== undefined ? { error: raw['error'] } : {})
  }
  const response = isObjectLike(raw['response']) ? raw['response'] : undefined
  // Raw Gemini REST provenance: https://ai.google.dev/gemini-api/docs/veo and the Google Gen AI SDK's ML Developer API converters at https://github.com/googleapis/js-genai/blob/4489991a7c40b22dff75348748048b0b14ac687e/src/converters/_models_converters.ts.
  const generateVideoResponse = response && isObjectLike(response['generateVideoResponse'])
    ? response['generateVideoResponse']
    : undefined
  if (generateVideoResponse) {
    const samples = Array.isArray(generateVideoResponse['generatedSamples'])
      ? generateVideoResponse['generatedSamples']
      : []
    operation.response = {
      generatedVideos: samples
        .map((sample): GeminiGeneratedVideo | undefined => {
          if (!isObjectLike(sample)) return undefined
          if (isObjectLike(sample['video'])) {
            const video = normalizeGeminiVideo(sample['video'])
            return video ? { video } : undefined
          }
          return undefined
        })
        .filter((video): video is GeminiGeneratedVideo => video !== undefined),
      ...(generateVideoResponse['raiMediaFilteredCount'] !== undefined ? { raiMediaFilteredCount: generateVideoResponse['raiMediaFilteredCount'] } : {}),
      ...(generateVideoResponse['raiMediaFilteredReasons'] !== undefined ? { raiMediaFilteredReasons: generateVideoResponse['raiMediaFilteredReasons'] } : {})
    }
  }
  return operation
}

const normalizeGeminiVideo = (raw: Record<string, unknown>): GeminiVideo | undefined => {
  const uri = typeof raw['uri'] === 'string' ? raw['uri'] : undefined
  const videoBytes = typeof raw['encodedVideo'] === 'string' ? raw['encodedVideo'] : undefined
  if (uri === undefined && videoBytes === undefined) return undefined
  return {
    ...(uri !== undefined ? { uri } : {}),
    ...(videoBytes !== undefined ? { videoBytes } : {}),
    ...(typeof raw['encoding'] === 'string' ? { mimeType: raw['encoding'] } : {})
  }
}

export const geminiUploadFile = async (
  apiKey: string,
  filePath: string,
  config: {
    mimeType: string
    displayName?: string | undefined
    name?: string | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<GeminiFile> => {
  const file = Bun.file(filePath)
  const sizeBytes = file.size
  const uploadFileName = basename(filePath)
  const fileMetadata: Record<string, unknown> = {
    mimeType: config.mimeType,
    sizeBytes: String(sizeBytes),
    ...(config.displayName ? { displayName: config.displayName } : {}),
    ...(config.name ? { name: config.name.startsWith('files/') ? config.name : `files/${config.name}` } : {})
  }
  const startUrl = buildGeminiUrl('upload/v1beta/files')
  const startResponse = await geminiFetch(startUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-header-content-length': String(sizeBytes),
      'x-goog-upload-header-content-type': config.mimeType,
      ...(uploadFileName ? { 'x-goog-upload-file-name': uploadFileName } : {})
    },
    body: JSON.stringify({ file: fileMetadata }),
    ...(config.abortSignal ? { signal: config.abortSignal } : {})
  })
  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw InfraError('Failed to get Gemini upload URL. Server did not return x-goog-upload-url.', { stage: 'gemini:rest' })
  }

  let offset = 0
  let finalResponse: Response | undefined
  while (offset < sizeBytes) {
    const chunkSize = Math.min(GEMINI_UPLOAD_CHUNK_BYTES, sizeBytes - offset)
    const command = offset + chunkSize >= sizeBytes ? 'upload, finalize' : 'upload'
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer()
    finalResponse = await geminiFetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'x-goog-upload-command': command,
        'x-goog-upload-offset': String(offset),
        'x-goog-upload-file-name': uploadFileName,
        'content-length': String(chunkSize)
      },
      body: chunk,
      ...(config.abortSignal ? { signal: config.abortSignal } : {})
    })
    offset += chunkSize
    const uploadStatus = finalResponse.headers.get('x-goog-upload-status')
    if (uploadStatus !== 'active') {
      break
    }
  }

  if (!finalResponse) {
    throw InfraError('Gemini Files API upload did not upload any content.', { stage: 'gemini:rest' })
  }
  const uploadStatus = finalResponse.headers.get('x-goog-upload-status')
  const captured = await readRestResponseText(finalResponse)
  const parsed = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
  if (uploadStatus !== 'final') {
    throw InfraError('Failed to upload Gemini file: upload status is not finalized.', { stage: 'gemini:rest' })
  }
  if (captured.truncated) {
    throw new AppError(`Gemini Files API upload response exceeded the ${captured.retainedBytes.toLocaleString()} byte response capture limit`, {
      kind: 'validation',
      status: finalResponse.status,
      metadata: buildCaptureMetadata(captured)
    })
  }
  if (typeof parsed === 'string') {
    throw new AppError(`Gemini Files API upload returned invalid JSON: ${sanitizeLogText(parsed.slice(0, 500))}`, {
      kind: 'validation',
      status: finalResponse.status,
      metadata: buildCaptureMetadata(captured)
    })
  }
  if (isObjectLike(parsed) && isObjectLike(parsed['file'])) {
    return parsed['file'] as GeminiFile
  }
  throw ValidationError('Gemini Files API upload did not return file metadata.', { stage: 'gemini:rest' })
}

const getGeminiFileState = (file: unknown): string | undefined => {
  if (!isObjectLike(file)) {
    return undefined
  }
  const state = file['state']
  if (typeof state === 'string') {
    return state.toUpperCase()
  }
  if (isObjectLike(state) && typeof state['name'] === 'string') {
    return state['name'].toUpperCase()
  }
  return undefined
}

const geminiGetFile = async (
  apiKey: string,
  name: string
): Promise<GeminiFile> => {
  const { json } = await geminiJsonRequest(apiKey, `files/${encodeURIComponent(extractGeminiFileName(name))}`, {
    method: 'GET'
  })
  return isObjectLike(json) ? json as GeminiFile : {}
}

const GEMINI_FILE_ACTIVATION_DEADLINE_MS = 120_000
const GEMINI_FILE_ACTIVATION_INTERVAL_MS = 1_000

/**
 * Waits for an uploaded Files API object to become usable. This was a hand-written
 * `while (Date.now() < deadline)` loop duplicated byte-for-byte in the Gemini OCR and STT
 * services: silent, un-abortable, and running inside an outer retry attempt that could
 * not cancel it. One copy, on the central poll loop, with a real abort signal.
 */
export const waitForGeminiFileActive = async (
  apiKey: string,
  fileName: string,
  options: { stage: string, abortSignal?: AbortSignal | undefined }
): Promise<void> => {
  await pollUntil<GeminiFile>({
    operationName: `gemini-file-activation:${extractGeminiFileName(fileName)}`,
    pollFn: async () => await geminiGetFile(apiKey, fileName),
    isDone: (file) => {
      const state = getGeminiFileState(file)
      return state === undefined || state === 'ACTIVE'
    },
    isFailed: (file) => getGeminiFileState(file) === 'FAILED'
      ? { failed: true, reason: `Gemini Files API upload failed for ${fileName}`, metadata: { fileName, stage: options.stage } }
      : { failed: false },
    describeResult: (file) => ({ fileName, state: getGeminiFileState(file) ?? 'unknown' }),
    intervalMs: GEMINI_FILE_ACTIVATION_INTERVAL_MS,
    deadlineMs: GEMINI_FILE_ACTIVATION_DEADLINE_MS,
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  })
}

export const geminiDeleteFile = async (
  apiKey: string,
  name: string
): Promise<void> => {
  await geminiJsonRequest(apiKey, `files/${encodeURIComponent(extractGeminiFileName(name))}`, {
    method: 'DELETE'
  })
}

export const geminiDownloadFile = async (
  apiKey: string,
  file: string | GeminiVideo | GeminiGeneratedVideo,
  downloadPath: string
): Promise<void> => {
  const inlineVideoBytes = extractInlineVideoBytes(file)
  if (inlineVideoBytes) {
    await Bun.write(downloadPath, Buffer.from(inlineVideoBytes, 'base64'))
    return
  }
  const name = extractGeminiFileNameFromFile(file)
  const response = await geminiBinaryRequest(apiKey, `files/${encodeURIComponent(name)}:download`, { alt: 'media' })
  await Bun.write(downloadPath, response.bytes)
}

const extractInlineVideoBytes = (file: string | GeminiVideo | GeminiGeneratedVideo): string | undefined => {
  if (typeof file === 'string') {
    return undefined
  }
  if ('videoBytes' in file && typeof file.videoBytes === 'string') {
    return file.videoBytes
  }
  if ('video' in file && isObjectLike(file.video) && typeof file.video['videoBytes'] === 'string') {
    return file.video['videoBytes']
  }
  return undefined
}

const extractGeminiFileNameFromFile = (file: string | GeminiVideo | GeminiGeneratedVideo): string => {
  if (typeof file === 'string') {
    return extractGeminiFileName(file)
  }
  if ('uri' in file && typeof file.uri === 'string') {
    return extractGeminiFileName(file.uri)
  }
  if ('video' in file && isObjectLike(file.video) && typeof file.video['uri'] === 'string') {
    return extractGeminiFileName(file.video['uri'])
  }
  throw ValidationError('Could not extract Gemini file name from generated media.', { stage: 'gemini:rest' })
}

const extractGeminiFileName = (name: string): string => {
  if (name.startsWith('https://')) {
    const suffix = name.split('files/')[1]
    const match = suffix?.match(/^[A-Za-z0-9_-]+/)
    if (!match) {
      throw ValidationError(`Could not extract Gemini file name from URI ${name}`, { stage: 'gemini:rest' })
    }
    return match[0] as string
  }
  if (name.startsWith('files/')) {
    return name.slice('files/'.length)
  }
  return name
}
