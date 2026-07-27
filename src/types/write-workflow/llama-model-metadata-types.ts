export type LlamaSetupModelMetadataEntry = {
  requestedModel: string
  repo: string
  downloadedAt: string
}

export type LlamaSetupModelMetadata = {
  version: 1
  models: Record<string, LlamaSetupModelMetadataEntry>
}
