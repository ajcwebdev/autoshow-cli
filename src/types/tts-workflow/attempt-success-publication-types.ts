import type {
  AttemptContext,
  AudioMixPlan,
  AudioTransformLedger,
  CompactAudioArchiveSlot,
  CompactTargetRender,
  FinalAudioObservation,
  FinalTimeline,
  ProviderBatchResult,
  ProviderRenderResult,
  WrittenJson,
} from '~/types'

export type SuccessPublicationInput = {
  ctx: AttemptContext
  resultFile: WrittenJson<ProviderRenderResult>
  batchResultFiles: Array<WrittenJson<ProviderBatchResult>>
  audioRunRoot: string
  finalPath: string
  finalAudio: FinalAudioObservation
  finalAudioSha256: string
  reportedOutputPath: string
  reportedOutputSha256: string
  mixPlan: AudioMixPlan
  mixPlanFile: WrittenJson<AudioMixPlan>
  ledger: AudioTransformLedger
  ledgerFile: WrittenJson<AudioTransformLedger>
  timeline: FinalTimeline
  compactSlots: CompactAudioArchiveSlot[]
  compactRender: CompactTargetRender
}
