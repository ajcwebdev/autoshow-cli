export type WalkPathKind = 'file' | 'directory' | 'any'

export type DirectoryEntry = {
  name: string
  isFile: () => boolean
  isDirectory: () => boolean
}

export type WalkPathsOptions = {
  kind?: WalkPathKind
  maxDepth?: number
}
