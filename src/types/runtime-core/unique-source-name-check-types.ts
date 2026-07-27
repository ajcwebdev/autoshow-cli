export type SourceNameViolationKind = 'file' | 'directory' | 'index'

export type SourceNameViolation = {
  kind: SourceNameViolationKind
  name: string
  paths: string[]
}

export type SourceNameCheckOptions = {
  sourceRoot?: string
  allowedIndexPath?: string
}
