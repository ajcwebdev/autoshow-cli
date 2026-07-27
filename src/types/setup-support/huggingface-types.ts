export type HuggingFaceFileEntry = {
  path: string
  type?: string
  size?: number
}

export type HuggingFaceDownloadOptions = {
  repoId: string
  revision?: string
  token: string
  destination: string
  allowPatterns?: string[]
  requiredFiles?: string[]
  fetchImpl?: typeof fetch
  maxAttempts?: number
  retryDelayMs?: number
}
