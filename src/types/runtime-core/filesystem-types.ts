export type WalkPathKind = 'file' | 'directory' | 'any'


export type WalkPathsOptions = {
  kind?: WalkPathKind
  maxDepth?: number
}
