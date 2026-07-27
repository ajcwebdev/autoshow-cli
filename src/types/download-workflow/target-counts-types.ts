export type RuntimeModelOptions =
  ReturnType<typeof import('~/cli/commands/process-steps/step-1-download/download-targets/options/download-model-options').readRuntimeModelOptions>

export type TargetCounts = {
  hostedOcrTargetCount: number
  hostedLlmTargetCount: number
  hostedTtsTargetCount: number
  hostedImageTargetCount: number
  hostedVideoTargetCount: number
  hostedMusicTargetCount: number
}
