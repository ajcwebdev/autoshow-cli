import type { SttTarget, VideoMetadata, YtDlpVideoInfo } from '~/types'

export type SttAcquireArtifactOptions = {
  source: { url?: string, filePath?: string }
  targets: SttTarget[]
  outputDir?: string | undefined
}

export type ResolvedSttSource = {
  metadata: VideoMetadata
  sourceVideoInfo?: YtDlpVideoInfo | undefined
}
