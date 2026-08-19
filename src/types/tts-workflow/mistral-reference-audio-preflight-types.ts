export type ProbeResult = Readonly<{ exitCode: number, stdout: string, stderr: string }>

export type MistralReferenceAudioProbeRunner = (
  command: string,
  args: readonly string[]
) => Promise<ProbeResult>

export type MistralReferenceAudioProbeStatus = 'ready' | 'runtime-unavailable'
