import type { BatchRuntimeOptions } from './batch-options-types'
import type { HostedConcurrencyRuntimeOptions } from '../cli-surface/cli-types'

export type SttRuntimeOptions = {
  whisperModels: string[] | undefined
  whisperModel: string
  whisperfileModels: string[] | undefined
  whisperfileModel: string | undefined
  deepinfraSttModels: string[] | undefined
  deepinfraSttModel: string | undefined
  groqSttModels: string[] | undefined
  groqSttModel: string | undefined
  grokSttModels: string[] | undefined
  grokSttModel: string | undefined
  deepgramSttModels: string[] | undefined
  deepgramSttModel: string | undefined
  sonioxSttModels: string[] | undefined
  sonioxSttModel: string | undefined
  speechmaticsSttModels: string[] | undefined
  speechmaticsSttModel: string | undefined
  revSttModels: string[] | undefined
  revSttModel: string | undefined
  mistralSttModels: string[] | undefined
  mistralSttModel: string | undefined
  assemblyaiSttModels: string[] | undefined
  assemblyaiSttModel: string | undefined
  gladiaSttModels: string[] | undefined
  gladiaSttModel: string | undefined
  happyscribeSttModels: string[] | undefined
  happyscribeSttModel: string | undefined
  happyscribeOrganizationId: string | undefined
  supadataSttModels: string[] | undefined
  supadataSttModel: string | undefined
  scrapecreatorsSttModels: string[] | undefined
  scrapecreatorsSttModel: string | undefined
  geminiSttModels: string[] | undefined
  geminiSttModel: string | undefined
  togetherSttModels: string[] | undefined
  togetherSttModel: string | undefined
  supadataLang: string | undefined
  scrapecreatorsLang: string | undefined
  diarizationSpeakerCount: number | undefined
  sttProviderConcurrency: number
  sttLocalConcurrency: number
  sttSegmentConcurrency: number
  sttPreflightConcurrency: number
  reverbVerbatimicity: number
  split: boolean
}

export type SttExtractionOptions = SttRuntimeOptions & HostedConcurrencyRuntimeOptions & Pick<BatchRuntimeOptions, 'batchConcurrency'> & {
  outputRootDir: string
  useReverb: boolean
  youtubeCaptions: boolean
  step2SelectionOrigins: Partial<Record<string, 'default' | 'explicit' | 'all-shortcut'>>
  prompts: string[]
  promptMd: boolean
}

export type SttRuntimeOptionKey = keyof SttRuntimeOptions
