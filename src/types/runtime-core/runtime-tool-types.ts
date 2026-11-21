export const RUNTIME_TOOL_IDS = [
  'ffmpeg',
  'ffprobe',
  'yt-dlp',
  'mutool',
  'ebook-convert',
  'tesseract',
  'qpdf',
  'magick',
  'convert',
  'identify',
  'pango-view',
  'fc-match',
  'fc-cache',
  'cmake',
  'pkgconf',
  'pkg-config',
  'ninja',
  'meson',
  'python3',
  'bun',
  'deno'
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
  realpath?: (path: string) => string
  which?: (command: string) => string | null
  platform?: NodeJS.Platform
}
