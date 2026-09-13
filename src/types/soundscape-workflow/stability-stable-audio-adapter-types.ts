export type StabilitySoundEffectSerializedRequest = {
  path: string
  body: {
    prompt: string
    duration: number
    output_format: string
  }
}

export type StabilitySoundEffectHttpRequest = (input: {
  method: 'POST' | 'GET'
  path: string
  headers: Record<string, string>
  body?: FormData | undefined
  cancellation: AbortSignal
}) => Promise<{ status: number, headers?: Headers | Record<string, string> | undefined, body: Uint8Array }>
