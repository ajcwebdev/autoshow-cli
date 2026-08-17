import { describe, expect, test } from 'bun:test'
import {
  buildInworldWebSocketRequests,
  createInworldWebSocketResponseState,
  INWORLD_TTS_WEBSOCKET_URL,
  reduceInworldWebSocketResponse,
  serializeInworldWebSocketRequests,
  synthesizeInworldWebSocket,
  type InworldWebSocketConnection,
  type InworldWebSocketConnector,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-websocket'

describe('Inworld TTS WebSocket adapter', () => {
  test('serializes the documented create and flushed send_text messages exactly', () => {
    const input = { text: 'Hello.', voiceId: 'Dennis', model: 'realtime-tts-2' as const, contextId: 'ctx-1' }
    expect(buildInworldWebSocketRequests(input)).toEqual([
      {
        create: {
          voiceId: 'Dennis',
          modelId: 'inworld-tts-2',
          audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 },
          timestampType: 'WORD',
          timestampTransportStrategy: 'SYNC',
          autoMode: true,
        },
        contextId: 'ctx-1',
      },
      { send_text: { text: 'Hello.', flush_context: {} }, contextId: 'ctx-1' },
    ])
    expect(serializeInworldWebSocketRequests(input).map(request => JSON.parse(request))).toEqual([...buildInworldWebSocketRequests(input)])
    expect(() => buildInworldWebSocketRequests({ ...input, text: 'x'.repeat(1001) })).toThrow('cannot exceed 1000')
  })

  test('reduces matching chunks, alignment, and flush completion', () => {
    let state = createInworldWebSocketResponseState('ctx-1')
    state = reduceInworldWebSocketResponse(state, JSON.stringify({ result: {
      contextId: 'ctx-1',
      status: { code: 0 },
      audioChunk: {
        audioContent: Buffer.from([1, 2]).toString('base64'),
        timestampInfo: { wordAlignment: { words: ['Hello'], wordStartTimeSeconds: [0], wordEndTimeSeconds: [0.2], phoneticDetails: [] } },
      },
    } }))
    state = reduceInworldWebSocketResponse(state, { result: {
      contextId: 'ctx-1',
      audioChunk: {
        audioContent: Buffer.from([3]).toString('base64'),
        timestampInfo: { wordAlignment: { words: ['.'], wordStartTimeSeconds: [0.2], wordEndTimeSeconds: [0.25], phoneticDetails: [] } },
      },
    } })
    state = reduceInworldWebSocketResponse(state, { result: { contextId: 'ctx-1', flushCompleted: {} } })
    expect(state).toMatchObject({ audioBytes: 3, messageCount: 3, terminal: true, terminalKind: 'flushCompleted' })
    expect(state.audioChunks.map(chunk => [...chunk])).toEqual([[1, 2], [3]])
    expect(state.timestampInfo).toEqual({ wordAlignment: {
      words: ['Hello', '.'],
      wordStartTimeSeconds: [0, 0.2],
      wordEndTimeSeconds: [0.2, 0.25],
      phoneticDetails: [],
    } })
  })

  test('runs the full protocol through an injected connector and preserves identity', async () => {
    const sent: string[] = []
    const closed: Array<[number | undefined, string | undefined]> = []
    const responses: unknown[] = [
      { result: { contextId: 'ctx-test', contextCreated: {} } },
      { result: { contextId: 'ctx-test', audioChunk: {
        audioContent: Buffer.from([82, 73, 70, 70]).toString('base64'),
        timestampInfo: { wordAlignment: { words: ['Hello'], wordStartTimeSeconds: [0], wordEndTimeSeconds: [0.1], phoneticDetails: [] } },
      } } },
      { result: { contextId: 'ctx-test', flushCompleted: {} } },
    ]
    const connector: InworldWebSocketConnector = async request => {
      expect(request.url).toBe(INWORLD_TTS_WEBSOCKET_URL)
      expect(request.headers).toEqual({ Authorization: 'Basic local-key', 'X-Request-Id': 'req-test' })
      const connection: InworldWebSocketConnection = {
        send: message => { sent.push(message) },
        receive: async () => responses.shift(),
        close: (code, reason) => { closed.push([code, reason]) },
      }
      return connection
    }
    const result = await synthesizeInworldWebSocket({
      text: 'Hello',
      voiceId: 'Dennis',
      model: 'realtime-tts-2',
      apiKey: 'local-key',
      contextId: 'ctx-test',
      requestId: 'req-test',
      identity: { turnId: 'turn-1', subjectKey: 'narrator' },
      connector,
    })
    expect([...result.audio]).toEqual([82, 73, 70, 70])
    expect(result).toMatchObject({ contextId: 'ctx-test', requestId: 'req-test', timing: { availability: 'timed', turns: [{ turnId: 'turn-1', subjectKey: 'narrator' }] } })
    expect(sent.map(request => JSON.parse(request))).toEqual([
      ...buildInworldWebSocketRequests({ text: 'Hello', voiceId: 'Dennis', model: 'realtime-tts-2', contextId: 'ctx-test' }),
      { close_context: {}, contextId: 'ctx-test' },
    ])
    expect(closed).toEqual([[1000, 'synthesis complete']])
  })

  test('rejects provider errors, malformed responses, wrong contexts, and empty completion', () => {
    const initial = createInworldWebSocketResponseState('ctx-1')
    expect(() => reduceInworldWebSocketResponse(initial, '{')).toThrow('malformed JSON')
    expect(() => reduceInworldWebSocketResponse(initial, { result: { contextId: 'other', contextCreated: {} } })).toThrow('contextId does not match')
    expect(() => reduceInworldWebSocketResponse(initial, { result: { contextId: 'ctx-1', status: { code: 8, message: 'quota exhausted' } } })).toThrow('quota exhausted')
    expect(() => reduceInworldWebSocketResponse(initial, { result: { contextId: 'ctx-1', flushCompleted: {} } })).toThrow('completed without audio')
  })

  test('cancels a stalled receive and closes the context and socket', async () => {
    const sent: string[] = []
    let closed = false
    const controller = new AbortController()
    const connector: InworldWebSocketConnector = async () => ({
      send: message => { sent.push(message) },
      receive: async () => await new Promise<unknown>(() => {}),
      close: () => { closed = true },
    })
    const operation = synthesizeInworldWebSocket({
      text: 'Cancel me', voiceId: 'Dennis', model: 'realtime-tts-2', apiKey: 'key', contextId: 'ctx-cancel', requestId: 'req-cancel', connector, abortSignal: controller.signal,
    })
    await Bun.sleep(0)
    controller.abort(new Error('test cancellation'))
    await expect(operation).rejects.toThrow('test cancellation')
    expect(JSON.parse(sent.at(-1) as string)).toEqual({ close_context: {}, contextId: 'ctx-cancel' })
    expect(closed).toBe(true)
  })
})
