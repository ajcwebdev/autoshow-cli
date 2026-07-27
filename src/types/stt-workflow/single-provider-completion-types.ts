import type { MistralSttPassController, SttCompletionContextBase } from '~/types'

export type SttSingleProviderCompletionContext = SttCompletionContextBase & {
  mistralPassController?: MistralSttPassController | undefined
}
