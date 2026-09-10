export const SUPPORTED_BUN_VERSION = '1.4.2'

export const isSupportedBunVersion = (runtimeVersion: string = Bun.version): boolean =>
  runtimeVersion === SUPPORTED_BUN_VERSION
