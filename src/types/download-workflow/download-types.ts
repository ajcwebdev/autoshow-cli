export type DownloadFlowId =
  | 'yt-dlp-binary'
  | 'ffmpeg-source'
  | 'lame-source'
  | 'mupdf-source'
  | 'calibre-dmg'
  | 'leptonica-source'
  | 'tesseract-source'
  | 'tessdata'
  | 'libjpeg-turbo-source'
  | 'qpdf-source'
  | 'whisperfile-binary'

export type DownloadRequest = {
  url: string
  destination: string
  expectedMinBytes?: number
  sha256?: string
  flowId?: DownloadFlowId
  mode?: 'file' | 'tar-gz'
  stripComponents?: number
  stallTimeoutMs?: number
  totalTimeoutMs?: number
}

export type PartialDownloadMetadata = {
  url: string
}

export type DownloadTimeouts = {
  stallTimeoutMs: number
  totalTimeoutMs: number
}

export type DownloadWatchdog = {
  signal: AbortSignal
  progress: () => void
  stop: () => void
  timeoutMessage: () => string | undefined
}
