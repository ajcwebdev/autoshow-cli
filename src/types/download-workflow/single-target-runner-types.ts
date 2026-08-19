import type {
  AggregatedPriceEstimate,
  BatchChildRunContext,
  BatchItem,
  MistralSttPassController,
  SingleTargetClassifiedInput,
  SttBatchCoordinator
} from '~/types'

export type SingleTargetRunOptions = {
  sttBatchCoordinator?: SttBatchCoordinator | undefined
  mistralSttPassController?: MistralSttPassController | undefined
  batchChildContext?: BatchChildRunContext | undefined
}

export type SingleTargetExecutionContext = {
  item: string
  baseDir: string
  input: SingleTargetClassifiedInput
  preflightEstimate?: AggregatedPriceEstimate | undefined
  runOptions?: SingleTargetRunOptions | undefined
  batchItem?: BatchItem | undefined
}
