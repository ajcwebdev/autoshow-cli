export type MemoryPressureLevel = 'warning' | 'critical'

export type MemoryPressureCacheEviction = {
  released: boolean
  entries: number
}

export type MemoryPressureCache = {
  name: string
  clear: (level: MemoryPressureLevel) => MemoryPressureCacheEviction
}
