import { ProviderError, ValidationError } from '~/utils/error-handler'
import { requireProvidedApiKey } from '~/utils/validate/env-utils'
import {
  buildFishGlobalTimeline,
  emptyFishTimestampStreamState,
  parseFishSseFrame,
  reduceFishTimestampStreamEvent,
  splitFishSseFrames,
} from './fish-timestamp-stream'
import type {
  FishClientOptions,
  FishCreateModelRequest,
  FishGlobalTimelineSegment,
  FishModelRecord,
  FishOperationOptions,
  FishTimestampAlignmentSnapshot,
  FishTimestampStreamState,
  FishTtsRequest,
  FishVoiceDesignCandidate,
  FishVoiceDesignRequest,
  FishVoiceDesignResponse,
} from '~/types'
import { extractRestErrorMessage, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

export const FISH_API_BASE_URL = 'https://api.fish.audio/v1'

export const createFishClient = (options: FishClientOptions) => {
  const apiKey = requireProvidedApiKey(options.apiKey, 'FISH_API_KEY', 'tts:fish', 'Fish Audio')

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
      }
      const requestHeaders = headers('application/json')
      if (req.model) requestHeaders['model'] = req.model

      const response = await customFetch(url, {
        method: 'POST',
        headers: requestHeaders,
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

    async synthesizeTtsWithTimestamps(req: FishTtsRequest, operationOptions: FishOperationOptions = {}): Promise<{
      audioBuffer: ArrayBuffer
      contentType: string
      status: number
      headers: Headers
      timeline: readonly FishGlobalTimelineSegment[]
      alignments: readonly FishTimestampAlignmentSnapshot[]
    }> {
      const url = `${baseUrl}/tts/stream/with-timestamp`
      const payload = {
        text: req.text,
        ...(req.reference_id ? { reference_id: req.reference_id } : {}),
        ...(req.references ? { references: req.references } : {}),
        format: req.format ?? 'wav',
        ...(req.latency ? { latency: req.latency } : {}),
      }
      const requestHeaders = headers('application/json')
      if (req.model) requestHeaders['model'] = req.model
      const signal = operationSignal(operationOptions.signal)
      const response = await customFetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal,
      })
      if (!response.ok) {
        await throwResponseError(response, 'TTS timestamp stream')
      }
      await operationOptions.onAccepted?.(response)
      if (!response.body) {
        throw ValidationError('Fish Audio timestamp stream returned no response body.', { stage: 'fish:timestamp-stream' })
      }
      const decoder = new TextDecoder()
      let buffer = ''
      let state: FishTimestampStreamState = emptyFishTimestampStreamState()
      const reader = response.body.getReader()
      try {
        while (true) {
          signal.throwIfAborted()
          const { done, value } = await reader.read()
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
          const { frames, rest } = splitFishSseFrames(buffer)
          buffer = rest
          for (const frame of frames) {
            const event = parseFishSseFrame(frame)
            if (event) state = reduceFishTimestampStreamEvent(state, event)
          }
          if (done) {
            const trailing = parseFishSseFrame(buffer)
            if (trailing) state = reduceFishTimestampStreamEvent(state, trailing)
            break
          }
        }
      } finally {
        reader.releaseLock()
      }
      const audio = Buffer.concat(state.audioChunks.map(chunk => Buffer.from(chunk)))
      if (audio.byteLength === 0) {
        throw ValidationError('Fish Audio timestamp stream returned empty audio.', { stage: 'fish:timestamp-stream' })
      }
      const alignments = [...state.alignmentByChunk.values()].sort((left, right) => left.chunkSeq - right.chunkSeq)
      return {
        audioBuffer: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength),
        contentType: response.headers.get('content-type') ?? 'text/event-stream',
        status: response.status,
        headers: response.headers,
        timeline: buildFishGlobalTimeline(state.alignmentByChunk),
        alignments,
      }
    },

    async voiceDesign(req: FishVoiceDesignRequest): Promise<FishVoiceDesignResponse> {
      const url = `${baseUrl}/voice-design`
      const requestHeaders = headers('application/json')
      requestHeaders['model'] = 'voice-design-1'
      const response = await customFetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          instruction: req.instruction,
          ...(req.reference_text ? { reference_text: req.reference_text } : {}),
          ...(req.language ? { language: req.language } : {}),
          n: req.n ?? 1,
          ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
        }),
        signal: operationSignal(),
      })
      if (!response.ok) {
        await throwResponseError(response, 'voice design')
      }
      const payload = await readJsonResponse(response, 'Fish Audio voice design response') as { candidates?: unknown }
      const candidates = Array.isArray(payload.candidates) ? payload.candidates.flatMap((raw, fallbackIndex): FishVoiceDesignCandidate[] => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
        const item = raw as Record<string, unknown>
        const audio = typeof item['audio_base64'] === 'string' ? item['audio_base64'] : undefined
        const id = typeof item['id'] === 'string' && item['id'].trim() ? item['id'] : `fish-candidate-${fallbackIndex}`
        const index = Number.isInteger(item['index']) ? item['index'] as number : fallbackIndex
        const sampleRate = typeof item['sample_rate'] === 'number' ? item['sample_rate'] : undefined
        const durationMs = typeof item['duration_ms'] === 'number' ? item['duration_ms'] : undefined
        if (!audio || sampleRate === undefined || durationMs === undefined) return []
        return [{
          id,
          index,
          audio_base64: audio,
          sample_rate: sampleRate,
          duration_ms: durationMs,
          ...(typeof item['text'] === 'string' ? { text: item['text'] } : {}),
          ...(typeof item['instruct'] === 'string' ? { instruct: item['instruct'] } : {}),
          ...(typeof item['language'] === 'string' ? { language: item['language'] } : {}),
        }]
      }) : []
      if (candidates.length === 0) {
        throw ValidationError('Fish Audio Voice Design returned no usable candidates.', { stage: 'fish:voice design' })
      }
      return { candidates }
    },

    async listModels(params: { page_size?: number, page_number?: number, self?: boolean, title?: string } = {}): Promise<{ items: FishModelRecord[], total: number }> {
      const query = new URLSearchParams()
      if (params.page_size) query.set('page_size', String(params.page_size))
      if (params.page_number) query.set('page_number', String(params.page_number))
      if (params.self === true) query.set('self', 'true')
      if (params.self === false) query.set('self', 'false')
      if (params.title) query.set('title', params.title)
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
