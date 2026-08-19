export type SttModelMatch =
  | { equals: string, contains?: never }
  | { equals?: never, contains: string }

export type ExpectedProvider = {
  service: string
  model: string
  local: boolean
  origin: 'default' | 'explicit' | 'all-shortcut'
}

export type SttExtractRunExpectation = {
  transcriptMatch: string | RegExp
  target: ExpectedProvider
  modelMatch: SttModelMatch
  expectPrompt: boolean
  resolvedStep2: boolean
  providerStates: boolean
  splitSegmentsDir: string | false
}
