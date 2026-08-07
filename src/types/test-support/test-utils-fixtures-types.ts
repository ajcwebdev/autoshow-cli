export type MockWavOptions = {
  sampleRate?: number | undefined
  channels?: number | undefined
  bitsPerSample?: 16 | undefined
  samples?: number | undefined
}

export type SyntheticWavOptions = {
  durationSeconds: number
  amplitude: number
  frequencyHz: number
  sampleRate?: number | undefined
}

export type ResolvedWavHeaderOptions = {
  sampleRate: number
  channels: number
  bitsPerSample: 16
}

export type OutputMetadataSummary = {
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
}

export type MusicExpectedLyricsSource = 'provided' | 'generated' | 'none'

export type MusicServiceModelCase = {
  model: string
  prompt: string
  extraArgs?: string[]
  expectedLyricsSource?: MusicExpectedLyricsSource
  commandTimeoutMs?: number
  testTimeoutMs?: number
}

export type TtsExtraArgs = readonly string[] | ((model: string) => readonly string[] | Promise<readonly string[]>)

export type VideoTestService = 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'
