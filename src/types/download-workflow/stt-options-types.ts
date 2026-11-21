import type { BatchRuntimeOptions, HostedConcurrencyRuntimeOptions, ModelCostFilterRuntimeOptions } from '~/types'

export type SttRuntimeOptions = {
  sttAudioProfile?: 'default' | 'lossless' | undefined
  whisperfileModels: string[] | undefined
  deepinfraSttModels: string[] | undefined
  grokSttModels: string[] | undefined
  deepgramSttModels: string[] | undefined
  sonioxSttModels: string[] | undefined
  speechmaticsSttModels: string[] | undefined
  mistralSttModels: string[] | undefined
  assemblyaiSttModels: string[] | undefined
  gladiaSttModels: string[] | undefined
  scrapecreatorsSttModels: string[] | undefined
  geminiSttModels: string[] | undefined
  togetherSttModels: string[] | undefined
  openaiSttModels: string[] | undefined
  cloudflareSttModels: string[] | undefined
  scrapecreatorsLang: string | undefined
  grokSttVerbatim?: boolean | undefined
  /** Per-provider --stt-filler-words values; adapters receive the selected provider's value on its target. */
  sttFillerWordsByProvider?: Readonly<Record<string, boolean>> | undefined
  /** Per-provider --stt-number-format values; adapters receive the selected provider's value on its target. */
  sttNumberFormatByProvider?: Readonly<Record<string, 'written' | 'spoken'>> | undefined
  deepinfraSttResponseFormat?: string | undefined
  captionExportFlags?: Record<string, unknown> | undefined
  nativeSubtitles?: boolean | undefined
  diarization?: boolean | undefined
  diarizationSpeakerCount: number | undefined
  sttProviderConcurrency: number
  sttLocalConcurrency: number
  sttSegmentConcurrency: number
  sttPreflightConcurrency: number
  split: boolean
}

export type SttExtractionOptions = SttRuntimeOptions & HostedConcurrencyRuntimeOptions & ModelCostFilterRuntimeOptions & Pick<BatchRuntimeOptions, 'batchConcurrency'> & {
  outputRootDir: string
  youtubeCaptions: boolean
  step2SelectionOrigins: Partial<Record<string, 'default' | 'explicit' | 'all-shortcut'>>
  prompts: string[]
  promptMd: boolean
}

export type SttRuntimeOptionKey = keyof SttRuntimeOptions
