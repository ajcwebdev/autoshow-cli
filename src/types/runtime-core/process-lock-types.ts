export type ProcessLockOptions = {
  lockRoot?: string
  staleMs?: number
  waitMs?: number
  heartbeatMs?: number
  /** Cancels the acquisition wait, so Ctrl-C is not swallowed by a two-hour hold. */
  abortSignal?: AbortSignal | undefined
}

export type ProcessLockOwner = {
  ownerId?: string | undefined
  lockName?: string | undefined
  pid?: number | undefined
  hostname?: string | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
}


export type ActiveProcessLockOwner = {
  ownerId: string
  lockName: string
  pid: number
  hostname: string
  createdAt: string
  updatedAt: string
}

export type HeartbeatHealth = {
  failureCount: number
  lastFailureAt?: string | undefined
  lastError?: string | undefined
}

export type ProcessLockOwnerReadResult = {
  owner: ProcessLockOwner | null
  ownerPath: string
  parseError?: string | undefined
}

export type ProcessLockDirIdentity = {
  dev: number
  ino: number
}
