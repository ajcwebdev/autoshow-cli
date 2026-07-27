import type { MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'
import { runSingleFileTargets } from '~/cli/commands/process-steps/target-runner'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError } from '~/utils/error-handler'
import {
  collectMusicTargets,
  getMusicArtifactFileName,
} from './music-targets'

export const runMusicTargets = async (
  targets: MusicTarget[],
  prompt: string,
  outputDir: string,
  options?: Pick<MusicGenOptions, 'musicProviderConcurrency' | 'musicLocalConcurrency' | 'generationResourceGate'>,
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const successes = await runSingleFileTargets<MusicTarget, Step7MusicMetadata>({
    targets,
    outputDir,
    stepLabel: 'music',
    noProviderMessage: 'No provider produced music',
    concurrency: {
      provider: options?.musicProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      local: options?.musicLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY
    },
    resourceGate: options?.generationResourceGate,
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir).then(({ musicPath, metadata }) => ({ filePath: musicPath, metadata })),
    workspacePrefix: '.music-tmp',
    getArtifactFileName: getMusicArtifactFileName,
    finalizeMetadata: (metadata, finalFileName, finalPath) => {
      return {
        ...metadata,
        musicFileName: finalFileName,
        musicFileSize: Bun.file(finalPath).size,
      }
    },
  })

  return {
    musicPaths: successes.map((entry) => entry.filePath),
    metadata: successes.map((entry) => entry.metadata),
  }
}

export const runMusicGen = async (
  prompt: string,
  outputDir: string,
  options: MusicGenOptions
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const targets = collectMusicTargets(options)
  if (targets.length === 0) {
    throw CLIUsageError('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model].')
  }

  return await runMusicTargets(targets, prompt, outputDir, options)
}
