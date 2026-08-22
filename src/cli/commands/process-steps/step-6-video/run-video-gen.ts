import type { Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { runMediaFileTargets } from '~/cli/commands/process-steps/media-file-target-runner'
import { UsageError } from '~/utils/error-handler'
import {
  collectVideoTargets,
  getVideoArtifactFileName,
} from './video-targets'

export const runVideoTargets = async (
  targets: VideoTarget[],
  prompt: string | undefined,
  outputDir: string,
  options?: Pick<VideoGenOptions, 'videoProviderConcurrency' | 'videoLocalConcurrency' | 'generationResourceGate' | 'hostedConcurrencyCoordinator' | 'concurrencyMode'>,
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const result = await runMediaFileTargets<VideoTarget, Step6VideoMetadata, string | undefined>({
    targets,
    prompt,
    outputDir,
    options: {
      providerConcurrency: options?.videoProviderConcurrency,
      localConcurrency: options?.videoLocalConcurrency,
      resourceGate: options?.generationResourceGate,
      hostedConcurrencyCoordinator: options?.hostedConcurrencyCoordinator
    },
    descriptor: {
      stepLabel: 'video',
      noProviderMessage: 'No provider produced video',
      hostedWorkClass: 'video',
      workspacePrefix: '.video-tmp',
      runTarget: async (target, targetPrompt, workspaceDir) =>
        await target.run(targetPrompt, workspaceDir).then(({ videoPath, metadata }) => ({ filePath: videoPath, metadata })),
      getArtifactFileName: getVideoArtifactFileName,
      finalizeMetadata: (metadata, finalFileName, finalPath) => ({
        ...metadata,
        videoFileName: finalFileName,
        videoFileSize: Bun.file(finalPath).size
      })
    }
  })

  return {
    videoPaths: result.paths,
    metadata: result.metadata
  }
}

export const runVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: VideoGenOptions
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const targets = collectVideoTargets(options)
  if (targets.length === 0) {
    throw UsageError('Specify a video generation provider with --provider gemini|grok|ltx|replicate|lumalabs|fal[=model]')
  }
  return await runVideoTargets(targets, prompt, outputDir, options)
}
