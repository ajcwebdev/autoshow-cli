import { CLIUsageError } from '~/utils/error-handler'

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

export const createFishClient = (options: FishClientOptions) => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw CLIUsageError('Fish Audio API key is required.')
  }

  const baseUrl = (options.baseUrl ?? FISH_API_BASE_URL).replace(/\/+$/, '')
  const customFetch = options.fetchImpl ?? fetch

  const headers = (contentType = 'application/json'): Record<string, string> => ({
    Authorization: `Bearer ${apiKey}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  })

  const requestJson = async <T>(path: string, requestOptions: RequestInit = {}): Promise<T> => {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const response = await customFetch(url, {
      ...requestOptions,
      headers: {
        ...headers(typeof requestOptions.body === 'string' ? 'application/json' : undefined),
        ...(requestOptions.headers as Record<string, string> ?? {}),
      },
    })

    if (!response.ok) {
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {
        // ignore body read error
      }
      throw CLIUsageError(`Fish Audio API request failed [${response.status} ${response.statusText}]: ${bodyText || 'No error details provided.'}`)
    }

    return response.json() as Promise<T>
  }

  return {
    async synthesizeTts(req: FishTtsRequest): Promise<{ audioBuffer: ArrayBuffer, contentType: string }> {
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
      })

      if (!response.ok) {
        let bodyText = ''
        try { bodyText = await response.text() } catch {}
        throw CLIUsageError(`Fish Audio TTS failed [${response.status} ${response.statusText}]: ${bodyText || 'Unknown error'}`)
      }

      const audioBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') ?? 'audio/wav'
      return { audioBuffer, contentType }
    },

    async voiceDesign(req: FishVoiceDesignRequest): Promise<FishVoiceDesignResponse> {
      return requestJson<FishVoiceDesignResponse>('/voice-design', {
        method: 'POST',
        body: JSON.stringify(req),
      })
    },

    async listModels(params: { page_size?: number, page_number?: number } = {}): Promise<{ items: FishModelRecord[], total: number }> {
      const query = new URLSearchParams()
      if (params.page_size) query.set('page_size', String(params.page_size))
      if (params.page_number) query.set('page_number', String(params.page_number))
      const queryString = query.toString() ? `?${query.toString()}` : ''
      const res = await requestJson<{ items?: FishModelRecord[], total?: number } | FishModelRecord[]>(`/model${queryString}`, {
        method: 'GET',
      })
      if (Array.isArray(res)) {
        return { items: res, total: res.length }
      }
      return { items: res.items ?? [], total: res.total ?? (res.items?.length ?? 0) }
    },

    async getModel(modelId: string): Promise<FishModelRecord> {
      return requestJson<FishModelRecord>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'GET',
      })
    },

    async createModel(req: FishCreateModelRequest): Promise<FishModelRecord> {
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
      })

      if (!response.ok) {
        let bodyText = ''
        try { bodyText = await response.text() } catch {}
        throw CLIUsageError(`Fish Audio create model failed [${response.status} ${response.statusText}]: ${bodyText || 'Unknown error'}`)
      }

      return response.json() as Promise<FishModelRecord>
    },

    async updateModel(modelId: string, updates: { title?: string, description?: string }): Promise<FishModelRecord> {
      return requestJson<FishModelRecord>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
    },

    async deleteModel(modelId: string): Promise<{ success: boolean }> {
      return requestJson<{ success: boolean }>(`/model/${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
      })
    }
  }
}

export type FishClient = ReturnType<typeof createFishClient>
