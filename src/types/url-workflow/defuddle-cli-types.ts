export type DefuddleCliSource = 'runtime' | 'path'

export type ResolvedDefuddleCli = {
  path: string
  source: DefuddleCliSource
}
