export type ElevenLabsSoundEffectHttpRequest = (input: {
  method: 'POST'
  path: '/v1/sound-generation'
  query: { output_format: string }
  headers: Record<string, string>
  body: Record<string, unknown>
  cancellation: AbortSignal
}) => Promise<{ status: number, headers?: Headers | Record<string, string> | undefined, body: Uint8Array }>
