export type PreparedLocalSttInput = {
  audioPath: string
  cleanup: () => Promise<void>
}
