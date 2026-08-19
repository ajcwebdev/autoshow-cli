export type ManifestProviderSelector = {
  service: string
  model?: string | null | undefined
  operation?: string | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  artifactDir?: string | undefined
}
