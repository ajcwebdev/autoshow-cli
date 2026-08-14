import { CLIUsageError, ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

export const FISH_API_BASE_URL = 'https://api.fish.audio/v1'

export type FishTtsRequest = Readonly<{
  text: string
  reference_id?: string | undefined
  references?: readonly Readonly<{ audio: Uint8Array | string, text: string }>[] | undefined
  format?: 'wav' | 'mp3' | 'opus' | 'flac' | undefined
  mp3_bitrate?: number | undefined
  latency?: 'normal' | 'balanced' | undefined
  model?: string | undefined
}>

export type FishVoiceDesignRequest = Readonly<{
  text: string
  voice_description: string
}>

export type FishVoiceDesignResponse = Readonly<{
  audio: string
  format?: string | undefined
  sample_rate?: number | undefined
  duration?: number | undefined
}>

export type FishModelRecord = Readonly<{
  _id: string
  title: string
  description?: string | undefined
  type?: string | undefined
  state?: 'ready' | 'processing' | 'failed' | string | undefined
  created_at?: string | undefined
  updated_at?: string | undefined
  author?: Readonly<{ _id: string, name?: string }> | undefined
}>

export type FishCreateModelRequest = Readonly<{
  title: string
  description?: string | undefined
  type?: 'tts' | string | undefined
  voices: readonly Uint8Array[]
  texts?: readonly string[] | undefined
}>

export type FishClientOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
}>

type FishOperationOptions = Readonly<{
  signal?: AbortSignal | undefined
  onAccepted?: ((response: Response) => void | Promise<void>) | undefined
}>

export const createFishClient = (options: FishClientOptions) => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('Fish Audio API key is required.')
  }

  const baseUrl = (options.baseUrl ?? FISH_API_BASE_URL).replace(/\/+$/, '')
  const customFetch = options.fetchImpl ?? fetch

  const operationSignal = (signal?: AbortSignal | null): AbortSignal => {
    const timeout = AbortSignal.timeout(MEDIA_GENERATION_TIMEOUT_MS)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
  }

  const headers = (contentType = 'application/json'): Record<string, string> => ({
    Authorization: `Bearer ${apiKey}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  })

  const throwResponseError = async (response: Response, operation: string): Promise<never> => {
    const captured = await readRestResponseText(response)
    const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
    throw ProviderError(`Fish Audio ${operation} failed (${response.status}): ${extractRestErrorMessage(payload, captured.text, response.status)}`, {
      status: response.status,
      headers: response.headers,
      stage: `fish:${operation}`,
      retryable: isRetryableStatus(response.status)
    })
  }

  const requestJson = async <T>(path: string, requestOptions: RequestInit = {}, operation = 'management request'): Promise<T> => {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const requestHeaders = new Headers(requestOptions.headers)
    for (const [key, value] of Object.entries(headers(typeof requestOptions.body === 'string' ? 'application/json' : undefined))) {
      if (!requestHeaders.has(key)) requestHeaders.set(key, value)
    }
    const response = await customFetch(url, {
      ...requestOptions,
      headers: requestHeaders,
      signal: operationSignal(requestOptions.signal),
    })

    if (!response.ok) {
      await throwResponseError(response, operation)
    }

    return await readJsonResponse(response, `Fish Audio ${operation} response`) as T
  }

  return {
    async synthesizeTts(req: FishTtsRequest, operationOptions: FishOperationOptions = {}): Promise<{ audioBuffer: ArrayBuffer, contentType: string, status: number, headers: Headers }> {
      const url = `${baseUrl}/tts`
      const payload = {
        text: req.text,
        ...(req.reference_id ? { reference_id: req.reference_id } : {}),
        ...(req.references ? { references: req.references } : {}),
        format: req.format ?? 'wav',
        ...(req.latency ? { latency: req.latency } : {}),
        ...(req.model ? { model: req.model } : {}),
      }

      const response = await customFetch(url, {
        method: 'POST',
        headers: headers('application/json'),
        body: JSON.stringify(payload),
        signal: operationSignal(operationOptions.signal),
      })

      if (!response.ok) {
        await throwResponseError(response, 'TTS create')
      }

      await operationOptions.onAccepted?.(response)
      const audioBuffer = await response.arrayBuffer()
      if (audioBuffer.byteLength === 0) {
        throw ValidationError('Fish Audio TTS returned an empty audio response.', { stage: 'fish:TTS response' })
      }
      const contentType = response.headers.get('content-type') ?? 'audio/wav'
      return { audioBuffer, contentType, status: response.status, headers: response.headers }
    },

    async voiceDesign(req: FishVoiceDesignRequest): Promise<FishVoiceDesignResponse> {
      return requestJson<FishVoiceDesignResponse>('/voice-design', {
        method: 'POST',
        body: JSON.stringify(req),
      }, 'voice design')
    },

    async listModels(params: { page_size?: number, page_number?: number } = {}): Promise<{ items: FishModelRecord[], total: number }> {
      const query = new URLSearchParams()
      if (params.page_size) query.set('page_size', String(params.page_size))
      if (params.page_number) query.set('page_number', String(params.page_number))
      const queryString = query.toString() ? `?${query.toString()}` : ''
      const res = await requestJson<{ items?: FishModelRecord[], total?: number } | FishModelRecord[]>(`/model${queryString}`, {
        method: 'GET',
      }, 'model catalog')
      if (Array.isArray(res)) {
        return { items: res, total: res.length }
      }
      return { items: res.items ?? [], total: res.total ?? (res.items?.length ?? 0) }
    },

    async getModel(modelId: string): Promise<FishModelRecord> {
      return requestJson<FishModelRecord>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'GET',
      }, 'model inspection')
    },

    async createModel(req: FishCreateModelRequest): Promise<FishModelRecord> {
      if (req.voices.length === 0) {
        throw ValidationError('Fish Audio model creation requires at least one non-empty voice sample.', { stage: 'fish:model create' })
      }
      if (req.voices.some(voice => voice.byteLength === 0)) {
        throw ValidationError('Fish Audio model creation does not accept empty voice samples.', { stage: 'fish:model create' })
      }
      const formData = new FormData()
      formData.append('title', req.title)
      if (req.description) formData.append('description', req.description)
      formData.append('type', req.type ?? 'tts')
      req.voices.forEach((voiceBuffer, idx) => {
        formData.append('voices', new Blob([Uint8Array.from(voiceBuffer)], { type: 'audio/wav' }), `sample_${idx}.wav`)
      })
      if (req.texts) {
        req.texts.forEach((txt) => formData.append('texts', txt))
      }

      const url = `${baseUrl}/model`
      const response = await customFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: operationSignal(),
      })

      if (!response.ok) {
        await throwResponseError(response, 'model create')
      }

      return await readJsonResponse(response, 'Fish Audio model create response') as FishModelRecord
    },

    async updateModel(modelId: string, updates: { title?: string, description?: string }): Promise<FishModelRecord> {
      return requestJson<FishModelRecord>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }, 'model update')
    },

    async deleteModel(modelId: string): Promise<{ success: boolean }> {
      return requestJson<{ success: boolean }>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
      }, 'model delete')
    }
  }
}

export type FishClient = ReturnType<typeof createFishClient>
