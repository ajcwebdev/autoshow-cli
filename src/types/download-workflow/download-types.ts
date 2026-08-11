export type DownloadFlowId =
  | 'uv-release'
  | 'yt-dlp-binary'
  | 'ffmpeg-source'
  | 'lame-source'
  | 'mupdf-source'
  | 'calibre-dmg'
  | 'acsm-calibre-plugin'
  | 'leptonica-source'
  | 'tesseract-source'
  | 'tessdata'
  | 'qpdf-source'
  | 'whisper-model'
  | 'whisperfile-binary'
  | 'llama-tarball'
  | 'llamafile-binary'
  | 'whisper-source'
  | 'reverb-source'
  | 'reverb-model'

export type DownloadRequest = {
  url: string
  destination: string
  expectedMinBytes?: number
  sha256?: string
  flowId?: DownloadFlowId
  mode?: 'file' | 'tar-gz' | 'tar-xz' | 'zip'
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
