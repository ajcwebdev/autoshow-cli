export type FishTtsRequest = Readonly<{
  text: string
  reference_id?: string | readonly string[] | undefined
  references?: readonly Readonly<{ audio: Uint8Array | string, text: string }>[] | undefined
  format?: 'wav' | 'mp3' | 'opus' | 'flac' | undefined
  mp3_bitrate?: number | undefined
  latency?: 'normal' | 'balanced' | 'low' | undefined
  model?: string | undefined
}>

export type FishVoiceDesignRequest = Readonly<{
  instruction: string
  reference_text?: string | undefined
  language?: string | undefined
  n?: number | undefined
  seed?: number | undefined
}>

export type FishVoiceDesignCandidate = Readonly<{
  id: string
  index: number
  audio_base64: string
  sample_rate: number
  duration_ms: number
  text?: string | undefined
  instruct?: string | undefined
  language?: string | undefined
}>

export type FishVoiceDesignResponse = Readonly<{
  candidates: readonly FishVoiceDesignCandidate[]
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

export type FishOperationOptions = Readonly<{
  signal?: AbortSignal | undefined
  onAccepted?: ((response: Response) => void | Promise<void>) | undefined
}>
