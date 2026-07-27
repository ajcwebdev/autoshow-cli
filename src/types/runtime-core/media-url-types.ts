export type MaterializedMediaInput = {
  input: string
  path: string
  basename: string
  isRemote: boolean
  cleanup: () => Promise<void>
}
