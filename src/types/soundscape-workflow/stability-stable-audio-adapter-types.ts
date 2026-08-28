type StabilityStableAudioEndpoint =
  typeof import('~/cli/commands/process-steps/step-4-tts/soundscape/stability-stable-audio-adapter').STABILITY_STABLE_AUDIO_ENDPOINT

export type StabilitySoundEffectSerializedRequest = {
  path: StabilityStableAudioEndpoint
  body: {
    prompt: string
    duration: number
    output_format: string
  }
}

export type StabilitySoundEffectHttpRequest = (input: {
  method: 'POST'
  path: StabilityStableAudioEndpoint
  headers: Record<string, string>
  body: FormData
  cancellation: AbortSignal
}) => Promise<{ status: number, headers?: Headers | Record<string, string> | undefined, body: Uint8Array }>
