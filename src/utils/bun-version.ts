export const SUPPORTED_BUN_VERSION = '1.4.0'

export const isSupportedBunVersion = (runtimeVersion: string = Bun.version): boolean =>
  runtimeVersion === SUPPORTED_BUN_VERSION
