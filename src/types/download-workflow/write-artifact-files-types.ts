import type { Step1Metadata, Step2Metadata, Step3Metadata, SttProviderSuccess } from '~/types'

export type BuildWriteArtifactFilesContext = {
  step1Metadata: Step1Metadata
  renderedInternalArtifacts: Record<string, string>
  showNoteInternalArtifacts: Record<string, string>
  step2Entries: Step2Metadata[]
  successfulSttProviders: SttProviderSuccess[]
  step3Results: Step3Metadata[]
}
