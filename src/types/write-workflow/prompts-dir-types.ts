export type PromptExampleFormat = 'json' | 'markdown'

export type PromptExamples = {
  json: string
  markdown: string
}

export type LeafPrompt = {
  description: string
  expectedInputTokens: number
  expectedOutputTokens: number
  instruction: string
  examples: PromptExamples
  structuredPreset?: string | undefined
}

export type PromptEntry = LeafPrompt | {
  description: string
  includes: string[]
}

export type PromptsRegistry = Record<string, PromptEntry>


export type ResolvedLeafPrompt = {
  name: string
  entry: LeafPrompt
}
