import type {
  ActualPipelineInputsBase,
  ExtractionMetadata,
  PartialExtractionMetadata,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata
} from '~/types'

export type RunStepInput = Pick<ActualPipelineInputsBase<unknown>,
  'step2' | 'partialStep2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' | 'ttsCharacterCount'
>

export type RunStepVisitors = {
  stt: (metadata: Step2Metadata, model: string) => void
  extract: (metadata: ExtractionMetadata) => void
  partialExtract: (metadata: PartialExtractionMetadata) => void
  llm: (metadata: Step3Metadata) => void
  tts: (metadata: Step4Metadata, characterCount: number) => void
  image: (metadata: Step5Metadata) => void
  video: (metadata: Step6VideoMetadata) => void
  music: (metadata: Step7MusicMetadata) => void
}

export type ClassifiedStep2 =
  | { kind: 'stt', metadata: Step2Metadata }
  | { kind: 'extract', metadata: ExtractionMetadata }
