/** Logical CPU count for best-effort worker sizing where affinity-aware precision is not required. */
export const logicalCpuCount = (): number =>
  Math.max(1, navigator.hardwareConcurrency)
