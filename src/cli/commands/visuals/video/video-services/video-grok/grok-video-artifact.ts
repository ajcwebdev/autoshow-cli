import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, hasRuntimeTool } from '~/utils/runtime-paths'
import { ValidationError } from '~/utils/error-handler'

export const requireGrokVideoDecoder = (): void => {
  if (!hasRuntimeTool('ffmpeg')) {
    throw ValidationError('Grok video output validation requires FFmpeg. Run autoshow setup before generating video.', { stage: 'video:grok' })
  }
}

/** Decode the purchased video before reporting success; retain failed bytes for recovery. */
export const validateGrokVideoArtifact = async (path: string): Promise<void> => {
  const result = await exec(getFfmpegBinary(), ['-v', 'error', '-xerror', '-i', path, '-map', '0:v:0', '-f', 'null', '-'])
  if (result.exitCode !== 0) {
    throw ValidationError('Grok video output could not be decoded as a video; downloaded bytes were preserved.', { stage: 'video:grok' })
  }
}
