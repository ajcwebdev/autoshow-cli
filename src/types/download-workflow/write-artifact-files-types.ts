import type { Step1Metadata, Step2Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, SttProviderSuccess } from '~/types'

export type BuildWriteArtifactFilesContext = {
  step1Metadata: Step1Metadata
  renderedInternalArtifacts: Record<string, string>
  showNoteInternalArtifacts: Record<string, string>
  step2Entries: Step2Metadata[]
  successfulSttProviders: SttProviderSuccess[]
  step3Results: Step3Metadata[]
  step4Metadata: Step4Metadata[] | null
  step5Metadata: Step5Metadata[] | null
  step6Metadata: Step6VideoMetadata[] | null
  step7Metadata: Step7MusicMetadata[] | null
}
