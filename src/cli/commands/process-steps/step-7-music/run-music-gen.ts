import type { MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'
import { runMediaFileTargets } from '~/cli/commands/process-steps/media-file-target-runner'
import { CLIUsageError } from '~/utils/error-handler'
import {
  collectMusicTargets,
  getMusicArtifactFileName,
} from './music-targets'

export const runMusicTargets = async (
  targets: MusicTarget[],
  prompt: string,
  outputDir: string,
  options?: Pick<MusicGenOptions, 'musicProviderConcurrency' | 'musicLocalConcurrency' | 'generationResourceGate' | 'hostedConcurrencyCoordinator' | 'concurrencyMode'>,
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const result = await runMediaFileTargets<MusicTarget, Step7MusicMetadata, string>({
    targets,
    prompt,
    outputDir,
    options: {
      providerConcurrency: options?.musicProviderConcurrency,
      localConcurrency: options?.musicLocalConcurrency,
      resourceGate: options?.generationResourceGate,
      hostedConcurrencyCoordinator: options?.hostedConcurrencyCoordinator
    },
    descriptor: {
      stepLabel: 'music',
      noProviderMessage: 'No provider produced music',
      hostedWorkClass: 'music',
      workspacePrefix: '.music-tmp',
      runTarget: async (target, targetPrompt, workspaceDir) =>
        await target.run(targetPrompt, workspaceDir).then(({ musicPath, metadata }) => ({ filePath: musicPath, metadata })),
      getArtifactFileName: getMusicArtifactFileName,
      finalizeMetadata: (metadata, finalFileName, finalPath) => ({
        ...metadata,
        musicFileName: finalFileName,
        musicFileSize: Bun.file(finalPath).size
      })
    }
  })

  return {
    musicPaths: result.paths,
    metadata: result.metadata
  }
}

export const runMusicGen = async (
  prompt: string,
  outputDir: string,
  options: MusicGenOptions
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const targets = collectMusicTargets(options)
  if (targets.length === 0) {
    throw CLIUsageError('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model]')
  }

  return await runMusicTargets(targets, prompt, outputDir, options)
}
