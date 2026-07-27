import type { CaptionCue, TranscriptionResult } from '~/types'

export type TranscriptCueSource = 'extract-evidence-words' | 'extract-evidence-segments' | 'extract-result-segments' | 'transcript-text'

export type TranscriptCue = CaptionCue & {
  speaker?: string | undefined
}


export type LoadedTranscription = {
  result: TranscriptionResult
  source: 'result-json' | 'transcript-text'
  sourcePath: string
  provider?: string | undefined
  model?: string | undefined
}

export type TranscriptVideoSource = {
  audioPath: string
  audioDisplayPath?: string | undefined
  transcription: LoadedTranscription
  title: string
  label: string
  extractRunDir?: string | undefined
  cleanup?: (() => Promise<void>) | undefined
}
