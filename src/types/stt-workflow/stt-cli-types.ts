import type { ProcessingOptions } from '~/types'

export type SttDiarizationFlagOptions = Pick<
  ProcessingOptions,
  'diarizationSpeakerCount' | 'diarization' | 'nativeSubtitles' | 'deepinfraSttResponseFormat' | 'grokSttVerbatim' | 'supadataChunkSize'
>
