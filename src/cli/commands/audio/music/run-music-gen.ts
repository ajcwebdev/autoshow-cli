import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'
import { runMediaFileTargets } from '~/cli/commands/command-shared/media-file-target-runner'
import { UsageError } from '~/utils/error-handler'
import {
  collectMusicTargets,
  getMusicArtifactFileName,
} from './music-targets'

export const runMusicTargets = async (
  targets: MusicTarget[],
  prompt: string,
  outputDir: string,
  options?: Pick<MusicGenOptions, 'musicProviderConcurrency' | 'generationResourceGate' | 'hostedConcurrencyCoordinator' | 'concurrencyMode'>,
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const result = await runMediaFileTargets<MusicTarget, Step7MusicMetadata, string>({
    targets,
    prompt,
    outputDir,
    options: {
      providerConcurrency: options?.musicProviderConcurrency,
      resourceGate: options?.generationResourceGate,
      hostedConcurrencyCoordinator: options?.hostedConcurrencyCoordinator
    },
    descriptor: {
      stepLabel: 'music',
      noProviderMessage: 'No provider produced music',
      hostedWorkClass: 'music',
      workspacePrefix: '.music-tmp',
      runTarget: async (target, targetPrompt, workspaceDir) => {
        const { musicPath, metadata } = await target.run(targetPrompt, workspaceDir)
        // Scope sidecars by model even for a single target so additive resume keeps their names stable.
        const stem = getMusicArtifactFileName(target, false).replace(/\.mp3$/, '')
        const promoted = { ...metadata }
        if (metadata.generatedTextFileName) {
          promoted.generatedTextFileName = `${stem}.txt`
          await copyFile(join(workspaceDir, metadata.generatedTextFileName), join(outputDir, promoted.generatedTextFileName))
        }
        if (metadata.additionalAudioFileNames) {
          promoted.additionalAudioFileNames = []
          for (const [index, name] of metadata.additionalAudioFileNames.entries()) {
            const finalName = `${stem}-part-${index + 2}.mp3`
            await copyFile(join(workspaceDir, name), join(outputDir, finalName))
            promoted.additionalAudioFileNames.push(finalName)
          }
        }
        return { filePath: musicPath, metadata: promoted }
      },
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
    throw UsageError('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model]')
  }

  return await runMusicTargets(targets, prompt, outputDir, options)
}
