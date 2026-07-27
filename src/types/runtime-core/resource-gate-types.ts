export type ResourceGate = {
  capacity: number
  acquire: () => Promise<() => void>
}

export type ResourceGateOptions = {
  capacity?: number | undefined
}
