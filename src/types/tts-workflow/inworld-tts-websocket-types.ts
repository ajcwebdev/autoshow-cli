import type { InworldTtsModel, NormalizedTiming } from '~/types'

export type InworldWebSocketConnection = Readonly<{
  send: (message: string) => void | Promise<void>
  receive: () => Promise<unknown>
  close: (code?: number, reason?: string) => void | Promise<void>
}>

export type InworldWebSocketConnector = (input: Readonly<{
  url: string
  headers: Readonly<Record<string, string>>
  signal: AbortSignal
}>) => Promise<InworldWebSocketConnection>

export type InworldWebSocketRequestInput = Readonly<{
  text: string
  voiceId: string
  model: InworldTtsModel
  contextId: string
}>

export type InworldWebSocketResponseState = Readonly<{
  contextId: string
  audioChunks: readonly Uint8Array[]
  timestampInfo: unknown
  messageCount: number
  audioBytes: number
  terminal: boolean
  terminalKind?: 'flushCompleted' | 'contextClosed' | undefined
}>

export type InworldWebSocketSynthesisResult = Readonly<{
  audio: Uint8Array
  contextId: string
  requestId: string
  timestampInfo: unknown
  timing?: NormalizedTiming<'take-audio-ms'> | undefined
}>
