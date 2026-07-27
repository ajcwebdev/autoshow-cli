export type LlamaServerState = {
  pid: number
  host: string
  port: number
  target: string | null
  modelId: string | null
  modelPath: string | null
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export type LocalLlmServerResourceOptions = {
  lockRoot?: string
}
