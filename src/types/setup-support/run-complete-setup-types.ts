export type SetupPlatform = 'darwin' | 'linux' | 'unknown'

export type ConcurrentSetupTask = {
  label: string
  run: () => Promise<void>
}
