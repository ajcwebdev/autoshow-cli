import type { Step2TimingMetadata } from '~/types'

export type TimedTextRangeBase<TTime = number> = {
  start: TTime
  end: TTime
  text: string
}

export type SecondsTimedTextRangeBase = {
  startSeconds: number
  endSeconds: number
  text: string
}

export type TranscriptionSegment = TimedTextRangeBase<string> & {
  speaker?: string | undefined
}

export type TranscriptionEvidenceSegment = SecondsTimedTextRangeBase & {
  speaker?: string | undefined
  confidence?: number | undefined
}

export type TranscriptionEvidenceWord = SecondsTimedTextRangeBase & {
  normalized: string
  speaker?: string | undefined
  confidence?: number | undefined
  timingSource: 'native' | 'interpolated'
}

export type TranscriptionEvidenceCapabilities = {
  hasNativeWordTiming: boolean
  hasConfidence: boolean
  hasSpeakerLabels: boolean
}

export type TranscriptionEvidenceTimingQuality = 'native_word' | 'segment_interpolated' | 'coarse'

export type TranscriptionEvidence = {
  segments?: TranscriptionEvidenceSegment[] | undefined
  words?: TranscriptionEvidenceWord[] | undefined
  capabilities?: Partial<TranscriptionEvidenceCapabilities> | undefined
  timingQuality?: TranscriptionEvidenceTimingQuality | undefined
  rawResponse?: unknown
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  evidence?: TranscriptionEvidence | undefined
}

export type DiarizationOptions = {
  enabled?: boolean | undefined
  speakerCount?: number | undefined
}

export type Step2RuntimeMetadata = {
  mode: 'fresh' | 'resumed'
  stage: 'created' | 'polling' | 'completed' | 'cleanup-pending' | 'cleanup-complete'
  remoteJobId: string
  remoteAssetId?: string | undefined
  remoteAssetUrl?: string | undefined
  createCompletedAt?: string | undefined
  lastPollAt?: string | undefined
  completedAt?: string | undefined
  cleanupCompletedAt?: string | undefined
  cleanup?: {
    remoteJobDeleted?: boolean | undefined
    remoteAssetDeleted?: boolean | undefined
  } | undefined
}

export type Step2Metadata = {
  transcriptionService: 'whisper' | 'whisperfile' | 'reverb' | 'deepgram' | 'deepinfra' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'grok' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'scrapecreators' | 'gemini-stt' | 'together' | 'youtube-captions'
  transcriptionModel: string
  processingTime: number
  tokenCount: number
  captionKind?: 'manual' | 'auto' | undefined
  captionLanguage?: string | undefined
  captionFormat?: 'vtt' | undefined
  timings?: Step2TimingMetadata | undefined
  runtime?: Step2RuntimeMetadata | undefined
  billing?: {
    creditsUsed?: number | undefined
    creditRateCents?: number | undefined
    inputTokens?: number | undefined
    outputTokens?: number | undefined
    totalTokens?: number | undefined
    audioInputTokens?: number | undefined
    textInputTokens?: number | undefined
    totalCost?: number | undefined
    source?: 'response-header' | 'fallback-estimate' | 'provider_usage' | 'provider_quote' | 'registry_fallback' | undefined
    mode?: 'url' | 'duration' | 'order' | 'token' | 'segment_sum' | undefined
  } | undefined
}
