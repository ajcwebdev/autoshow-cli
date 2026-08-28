import type { InworldTtsModel, InworldWebSocketConnection, InworldWebSocketConnector, InworldWebSocketRequestInput, InworldWebSocketResponseState, InworldWebSocketSynthesisResult, JsonObject, TtsTimingIdentity } from '~/types'
import { UsageError, InfraError, InternalError, ProviderError, ValidationError } from '~/utils/error-handler'
import { normalizeInworldTimestampInfo, resolveInworldTtsApiModelId } from './inworld-tts-request'

export const INWORLD_TTS_WEBSOCKET_URL = 'wss://api.inworld.ai/tts/v1/voice:streamBidirectional'
const INWORLD_TTS_WEBSOCKET_MAX_TEXT_LENGTH = 1000

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 120_000
const MAX_RESPONSE_MESSAGES = 10_000
const MAX_AUDIO_BYTES = 100 * 1024 * 1024

const record = (value: unknown): Readonly<JsonObject> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<JsonObject> : undefined
const nonempty = (value: string, label: string): string => {
  const result = value.trim()
  if (!result) throw UsageError(`Inworld WebSocket ${label} cannot be blank.`)
  return result
}

export const buildInworldWebSocketRequests = (input: InworldWebSocketRequestInput): readonly Readonly<JsonObject>[] => {
  const text = nonempty(input.text, 'text')
  if (Array.from(text).length > INWORLD_TTS_WEBSOCKET_MAX_TEXT_LENGTH) {
    throw UsageError(`Inworld WebSocket text cannot exceed ${INWORLD_TTS_WEBSOCKET_MAX_TEXT_LENGTH} characters.`)
  }
  const contextId = nonempty(input.contextId, 'contextId')
  return [
    {
      create: {
        voiceId: nonempty(input.voiceId, 'voiceId'),
        modelId: resolveInworldTtsApiModelId(input.model),
        audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 },
        timestampType: 'WORD',
        timestampTransportStrategy: 'SYNC',
        autoMode: true,
      },
      contextId,
    },
    { send_text: { text, flush_context: {} }, contextId },
  ]
}

export const serializeInworldWebSocketRequests = (input: InworldWebSocketRequestInput): readonly string[] => buildInworldWebSocketRequests(input).map(request => JSON.stringify(request))

export const createInworldWebSocketResponseState = (contextId: string): InworldWebSocketResponseState => ({
  contextId: nonempty(contextId, 'contextId'),
  audioChunks: [],
  timestampInfo: undefined,
  messageCount: 0,
  audioBytes: 0,
  terminal: false,
})

const parseMessage = (message: unknown): Readonly<JsonObject> => {
  let value = message
  if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
    const bytes = message instanceof ArrayBuffer ? new Uint8Array(message) : new Uint8Array(message.buffer, message.byteOffset, message.byteLength)
    value = new TextDecoder().decode(bytes)
  }
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      throw ValidationError('Inworld WebSocket returned malformed JSON.', { stage: 'tts:inworld-websocket', retryable: false })
    }
  }
  const parsed = record(value)
  if (!parsed) throw ValidationError('Inworld WebSocket returned a malformed response.', { stage: 'tts:inworld-websocket', retryable: false })
  return parsed
}

const decodeAudio = (value: unknown): Uint8Array => {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw ValidationError('Inworld WebSocket returned malformed audioContent.', { stage: 'tts:inworld-websocket', retryable: false })
  }
  const audio = new Uint8Array(Buffer.from(value, 'base64'))
  if (audio.byteLength === 0) throw ValidationError('Inworld WebSocket returned empty audioContent.', { stage: 'tts:inworld-websocket', retryable: false })
  return audio
}

const appendArray = (left: unknown, right: unknown): unknown[] => [
  ...(Array.isArray(left) ? left : []),
  ...(Array.isArray(right) ? right : []),
]

const mergeTimestampInfo = (current: unknown, next: unknown): unknown => {
  if (next === undefined) return current
  const nextInfo = record(next)
  if (!nextInfo) throw ValidationError('Inworld WebSocket returned malformed timestampInfo.', { stage: 'tts:inworld-websocket', retryable: false })
  const currentInfo = record(current)
  const nextAlignment = record(nextInfo['wordAlignment'])
  if (!nextAlignment) return { ...(currentInfo ?? {}), ...nextInfo }
  const currentAlignment = record(currentInfo?.['wordAlignment'])
  return {
    ...(currentInfo ?? {}),
    ...nextInfo,
    wordAlignment: {
      ...(currentAlignment ?? {}),
      ...nextAlignment,
      words: appendArray(currentAlignment?.['words'], nextAlignment['words']),
      wordStartTimeSeconds: appendArray(currentAlignment?.['wordStartTimeSeconds'], nextAlignment['wordStartTimeSeconds']),
      wordEndTimeSeconds: appendArray(currentAlignment?.['wordEndTimeSeconds'], nextAlignment['wordEndTimeSeconds']),
      phoneticDetails: appendArray(currentAlignment?.['phoneticDetails'], nextAlignment['phoneticDetails']),
    },
  }
}

const errorMessage = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  const error = record(value)
  return typeof error?.['message'] === 'string' && error['message'].trim() ? error['message'].trim() : 'Unknown provider error'
}

export const reduceInworldWebSocketResponse = (
  state: InworldWebSocketResponseState,
  message: unknown,
): InworldWebSocketResponseState => {
  if (state.terminal) throw InternalError('Inworld WebSocket received a response after completion.', { stage: 'tts:inworld-websocket', retryable: false })
  if (state.messageCount >= MAX_RESPONSE_MESSAGES) throw InfraError(`Inworld WebSocket exceeded ${MAX_RESPONSE_MESSAGES} response messages.`, { stage: 'tts:inworld-websocket', retryable: false })
  const payload = parseMessage(message)
  if (payload['error'] !== undefined) throw ProviderError(`Inworld WebSocket provider error: ${errorMessage(payload['error'])}`, { stage: 'tts:inworld-websocket' })
  const result = record(payload['result'])
  if (!result) throw ValidationError('Inworld WebSocket response is missing result.', { stage: 'tts:inworld-websocket', retryable: false })
  if (result['contextId'] !== state.contextId) throw ValidationError('Inworld WebSocket response contextId does not match the request.', { stage: 'tts:inworld-websocket', retryable: false })
  const status = result['status'] === undefined ? undefined : record(result['status'])
  if (result['status'] !== undefined && !status) throw ValidationError('Inworld WebSocket returned malformed status.', { stage: 'tts:inworld-websocket', retryable: false })
  const statusCode = status?.['code'] ?? 0
  if (typeof statusCode !== 'number' || !Number.isInteger(statusCode)) throw ValidationError('Inworld WebSocket returned malformed status code.', { stage: 'tts:inworld-websocket', retryable: false })
  if (statusCode !== 0) throw ProviderError(`Inworld WebSocket provider error (${statusCode}): ${errorMessage(status?.['message'])}`, { stage: 'tts:inworld-websocket', status: statusCode })

  const audioChunkValue = result['audioChunk']
  const audioChunk = audioChunkValue === undefined ? undefined : record(audioChunkValue)
  if (audioChunkValue !== undefined && !audioChunk) throw ValidationError('Inworld WebSocket returned malformed audioChunk.', { stage: 'tts:inworld-websocket', retryable: false })
  const audio = audioChunk?.['audioContent'] === undefined ? undefined : decodeAudio(audioChunk['audioContent'])
  if (audioChunk && audio === undefined && audioChunk['timestampInfo'] === undefined) throw ValidationError('Inworld WebSocket audioChunk contains neither audioContent nor timestampInfo.', { stage: 'tts:inworld-websocket', retryable: false })
  const audioBytes = state.audioBytes + (audio?.byteLength ?? 0)
  if (audioBytes > MAX_AUDIO_BYTES) throw InfraError(`Inworld WebSocket audio exceeded ${MAX_AUDIO_BYTES} bytes.`, { stage: 'tts:inworld-websocket', retryable: false })
  const terminalKind = Object.hasOwn(result, 'contextClosed')
    ? 'contextClosed' as const
    : Object.hasOwn(result, 'flushCompleted') ? 'flushCompleted' as const : undefined
  const next = {
    ...state,
    audioChunks: audio ? [...state.audioChunks, audio] : state.audioChunks,
    timestampInfo: mergeTimestampInfo(state.timestampInfo, audioChunk?.['timestampInfo']),
    messageCount: state.messageCount + 1,
    audioBytes,
    terminal: terminalKind !== undefined,
    ...(terminalKind ? { terminalKind } : {}),
  }
  if (next.terminal && next.audioBytes === 0) throw ValidationError('Inworld WebSocket completed without audio.', { stage: 'tts:inworld-websocket', retryable: false })
  return next
}

const abortError = (signal: AbortSignal): Error => signal.reason instanceof Error ? signal.reason : InfraError('Inworld WebSocket synthesis was cancelled.', { stage: 'tts:inworld-websocket', retryable: false })

const waitFor = async <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw abortError(signal)
  return await new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(abortError(signal))
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

const createBunInworldWebSocketConnector: InworldWebSocketConnector = async ({ url, headers, signal }) => {
  if (typeof Bun === 'undefined') throw InternalError('The default Inworld WebSocket connector requires Bun; inject a connector in other runtimes.', { stage: 'tts:inworld-websocket', retryable: false })
  const BunWebSocket = WebSocket as unknown as new (url: string, options: { headers: Readonly<Record<string, string>> }) => WebSocket
  const socket = new BunWebSocket(url, { headers })
  await waitFor(new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(InfraError('Inworld WebSocket connection failed.', { stage: 'tts:inworld-websocket' })), { once: true })
  }), signal).catch(error => {
    socket.close()
    throw error
  })

  const queued: unknown[] = []
  const waiting: Array<{ resolve: (message: unknown) => void, reject: (error: Error) => void }> = []
  let closed: Error | undefined
  socket.addEventListener('message', event => {
    const receiver = waiting.shift()
    if (receiver) receiver.resolve(event.data)
    else queued.push(event.data)
  })
  socket.addEventListener('error', () => {
    closed = InfraError('Inworld WebSocket transport failed.', { stage: 'tts:inworld-websocket' })
    for (const receiver of waiting.splice(0)) receiver.reject(closed)
  })
  socket.addEventListener('close', () => {
    closed ??= InfraError('Inworld WebSocket closed before synthesis completed.', { stage: 'tts:inworld-websocket' })
    for (const receiver of waiting.splice(0)) receiver.reject(closed)
  })
  return {
    send: message => socket.send(message),
    receive: async () => {
      const message = queued.shift()
      if (message !== undefined) return message
      if (closed) throw closed
      return await new Promise<unknown>((resolve, reject) => waiting.push({ resolve, reject }))
    },
    close: (code, reason) => socket.close(code, reason),
  }
}

export const synthesizeInworldWebSocket = async (input: Readonly<{
  text: string
  voiceId: string
  model: InworldTtsModel
  apiKey: string
  contextId?: string | undefined
  requestId?: string | undefined
  timeoutMs?: number | undefined
  identity?: TtsTimingIdentity | undefined
  abortSignal?: AbortSignal | undefined
  connector?: InworldWebSocketConnector | undefined
}>): Promise<InworldWebSocketSynthesisResult> => {
  const apiKey = nonempty(input.apiKey, 'API key')
  const contextId = input.contextId === undefined ? crypto.randomUUID() : nonempty(input.contextId, 'contextId')
  const requestId = input.requestId === undefined ? crypto.randomUUID() : nonempty(input.requestId, 'requestId')
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) throw UsageError(`Inworld WebSocket timeoutMs must be between 1 and ${MAX_TIMEOUT_MS}.`)
  const requests = serializeInworldWebSocketRequests({ text: input.text, voiceId: input.voiceId, model: input.model, contextId })
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = input.abortSignal ? AbortSignal.any([input.abortSignal, timeout]) : timeout
  const connector = input.connector ?? createBunInworldWebSocketConnector
  let connection: InworldWebSocketConnection | undefined
  let state = createInworldWebSocketResponseState(contextId)
  try {
    connection = await waitFor(connector({
      url: INWORLD_TTS_WEBSOCKET_URL,
      headers: {
        Authorization: apiKey.startsWith('Basic ') ? apiKey : `Basic ${apiKey}`,
        'X-Request-Id': requestId,
      },
      signal,
    }), signal)
    for (const request of requests) await waitFor(Promise.resolve(connection.send(request)), signal)
    while (!state.terminal) state = reduceInworldWebSocketResponse(state, await waitFor(connection.receive(), signal))
    const audio = new Uint8Array(state.audioBytes)
    let offset = 0
    for (const chunk of state.audioChunks) {
      audio.set(chunk, offset)
      offset += chunk.byteLength
    }
    return {
      audio,
      contextId,
      requestId,
      timestampInfo: state.timestampInfo,
      ...(input.identity ? { timing: normalizeInworldTimestampInfo({ text: input.text.trim(), timestampInfo: state.timestampInfo, identity: input.identity }) } : {}),
    }
  } finally {
    if (connection) {
      if (state.terminalKind !== 'contextClosed') {
        try { await connection.send(JSON.stringify({ close_context: {}, contextId })) } catch {}
      }
      try { await connection.close(1000, 'synthesis complete') } catch {}
    }
  }
}
