export type InstallDmgAppOptions = {
  url: string
  sha256: string
  appName: string
  destinationAppPath: string
  validateApp?: (appPath: string) => Promise<void>
  forceRedownload?: boolean
}
