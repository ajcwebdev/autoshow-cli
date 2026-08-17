import type { Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { runSingleFileTargets } from '~/cli/commands/process-steps/target-runner'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError } from '~/utils/error-handler'
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
  const successes = await runSingleFileTargets<VideoTarget, Step6VideoMetadata>({
    targets,
    outputDir,
    stepLabel: 'video',
    noProviderMessage: 'No provider produced video',
    concurrency: {
      provider: options?.videoProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      local: options?.videoLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY
    },
    resourceGate: options?.generationResourceGate,
    hostedConcurrencyCoordinator: options?.hostedConcurrencyCoordinator,
    hostedWorkClass: 'video',
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir).then(({ videoPath, metadata }) => ({ filePath: videoPath, metadata })),
    workspacePrefix: '.video-tmp',
    getArtifactFileName: getVideoArtifactFileName,
    finalizeMetadata: (metadata, finalFileName, finalPath) => {
      return {
        ...metadata,
        videoFileName: finalFileName,
        videoFileSize: Bun.file(finalPath).size,
      }
    },
  })

  return {
    videoPaths: successes.map((entry) => entry.filePath),
    metadata: successes.map((entry) => ({
      ...entry.metadata,
      ...(options?.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {})
    })),
  }
}

export const runVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: VideoGenOptions
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const targets = collectVideoTargets(options)
  if (targets.length === 0) {
    throw CLIUsageError('Specify a video generation provider with --provider gemini|minimax|grok|ltx|replicate|lumalabs|fal[=model]')
  }
  return await runVideoTargets(targets, prompt, outputDir, options)
}
