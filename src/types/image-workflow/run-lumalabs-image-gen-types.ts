export type LumalabsOutputFormat =
  typeof import('~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/run-lumalabs-image-gen').LUMALABS_OUTPUT_FORMATS[number]

export type LumalabsImageRef = { url: string } | { data: string, media_type: string }
