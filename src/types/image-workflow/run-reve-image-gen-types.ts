export type ReveOutputFormat =
  typeof import('~/cli/commands/process-steps/step-5-image/image-generation-services/reve/run-reve-image-gen').REVE_OUTPUT_FORMATS[number]

export type ReveDimensions = {
  width: number
  height: number
}
