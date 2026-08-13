export type ResourceGate = {
  capacity: number
  acquire: () => Promise<() => void>
  runWithGate?: <T>(fn: () => Promise<T>) => Promise<T>
}

export type ResourceGateOptions = {
  capacity?: number | undefined
}
