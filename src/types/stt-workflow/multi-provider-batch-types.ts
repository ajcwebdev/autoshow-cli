import type { MistralSttPassController, ProcessSttRunOptions, SttCompletionContextBase } from '~/types'

export type SttMultiProviderBatchContext = SttCompletionContextBase & {
  targetsToRunKeys: Set<string>
  runOptions: ProcessSttRunOptions
  mistralPassController?: MistralSttPassController | undefined
}
