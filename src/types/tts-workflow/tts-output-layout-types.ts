export type TtsOutputLayout = {
  mediaRoot: string
  artifactDir: string
  workDir: string
  slotsDir: string
  journalPath: string
  attemptJsonPath: string
  renderPlanPath: string
  archiveRenderPath: string
  archiveTimelinePath: string
  slotWavPath: (slotHash: string) => string
  slotResultPath: (slotHash: string) => string
}
