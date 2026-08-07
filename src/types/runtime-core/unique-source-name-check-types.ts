export type SourceNameViolationKind = 'file' | 'directory' | 'index'

export type SourceNameViolation = {
  kind: SourceNameViolationKind
  name: string
  paths: string[]
}
