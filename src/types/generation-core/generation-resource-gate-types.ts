export type GenerationResourceGate = {
  capacity: number
  acquire: () => Promise<() => void>
}

export type GenerationResourceGateOptions = {
  capacity?: number | undefined
}
