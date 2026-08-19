export type FfmpegCommand = { tool: 'ffmpeg', args: string[] }

export type DialogueSlice = {
  panelNumber: number
  turnIds: string[]
  sourceRangeMs: { start: number, end: number }
  finalRangeMs: { start: number, end: number }
}
