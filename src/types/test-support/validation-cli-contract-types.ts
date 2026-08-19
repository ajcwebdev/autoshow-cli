export type HelpResult = { exitCode: number, stdout: string, stderr: string }

export type DocumentedFlag = {
  heading: string | undefined
  line: number
  name: string
}

export type ScannerState = {
  currentLine: number
  currentH2: string | undefined
  inFence: boolean
}

export type FlagTableRows = {
  flags: DocumentedFlag[]
  nextLine: number
}

export type ResolvedFlagOptions =
  ReturnType<typeof import('~/cli/options/option-resolution/build-options-from-flags').buildOptsFromFlags>

export type MatrixCase = {
  label: string
  flags: Record<string, unknown>
  explicitFlags?: Set<string>
}

export type SelectorCase = {
  args: string[]
  selectorFlag: string
  target: string
  expectedValue: string | true
  normalize: 'generic' | 'write'
  targets: Record<string, string>
}
