export const logicalCpuCount = (): number =>
  Math.max(1, navigator.hardwareConcurrency)
