export type SafeArtifactDirectory = Readonly<{
  path: string
  relativePath: string
}>

export type ImmutableArtifactFile = Readonly<{
  path: string
  relativePath: string
  sha256: string
  created: boolean
}>

export type ContainedArtifactFile = Readonly<{
  path: string
  relativePath: string
  bytes: Buffer
  sha256: string
}>

export type ReservedInvocationAttemptDirectory = SafeArtifactDirectory & Readonly<{
  attempt: number
  invocationId: string
  claimRelativePath: string
  release: () => Promise<void>
}>
