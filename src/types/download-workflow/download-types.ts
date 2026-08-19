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
  | 'whisper-model'
  | 'whisperfile-binary'
  | 'whisper-source'

export type DownloadRequest = {
  url: string
  destination: string
  expectedMinBytes?: number
  sha256?: string
  flowId?: DownloadFlowId
  mode?: 'file' | 'tar-gz'
  stripComponents?: number
  // Override the flow's timeout budget. Rarely needed; the per-flow profile
  // should be the place a new asset class gets its budget.
  stallTimeoutMs?: number
  totalTimeoutMs?: number
}

// Sidecar written next to a `.part` file so a resumed transfer can prove the
// bytes already on disk came from the same URL.
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
