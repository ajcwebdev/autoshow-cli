export const RUNTIME_TOOL_IDS = [
  'ffmpeg',
  'ffprobe',
  'yt-dlp',
  'mutool',
  'ebook-convert',
  'calibre-acsm-fulfill',
  'tesseract',
  'qpdf'
] as const

export type RuntimeToolId = typeof RUNTIME_TOOL_IDS[number]

export type RuntimeToolSource = 'override' | 'managed' | 'path'

export type ResolvedRuntimeTool = {
  id: RuntimeToolId
  path: string
  source: RuntimeToolSource
}

export type ResolveRuntimeToolOptions = {
  overrideBinDir?: string
  exists?: (path: string) => boolean
  which?: (command: string) => string | null
  platform?: NodeJS.Platform
}
