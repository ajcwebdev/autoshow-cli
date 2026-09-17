import { assertRequiredImageModel } from '~/utils/required-image-model'
import type { ImageGenOptions, ImageTarget, Step5Metadata } from '~/types'
import { runMediaArtifactFileTargets } from '~/cli/commands/command-shared/media-file-target-runner'
import { UsageError } from '~/utils/error-handler'
import {
  collectImageTargets,
  getImageArtifactFileNames,
} from './image-generation-targets'

export const runImageTargets = async (
  targets: ImageTarget[],
  prompt: string,
  outputDir: string,
  options: ImageGenOptions
): Promise<{ imagePaths: string[], metadata: Step5Metadata[] }> => {
  for (const target of targets) assertRequiredImageModel(target.model, target.service)
  const result = await runMediaArtifactFileTargets<ImageTarget, Step5Metadata, string>({
    targets,
    prompt,
    outputDir,
    options: {
      providerConcurrency: options.imageProviderConcurrency,
      resourceGate: options.generationResourceGate,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator
    },
    descriptor: {
      stepLabel: 'image',
      noProviderMessage: 'No provider produced images',
      hostedWorkClass: 'image',
      workspacePrefix: '.image-tmp',
      // Image targets emit one or more files and name them from the source extension, so finalize even for a lone target.
      finalizeSingleTarget: true,
      artifactFailureStage: 'image:run',
      runTarget: async (target, targetPrompt, workspaceDir) =>
        await target.run(targetPrompt, workspaceDir, options).then(({ imagePaths, metadata }) => ({ filePaths: imagePaths, metadata })),
      getArtifactFileNames: getImageArtifactFileNames,
      finalizeMetadata: (metadata, finalFileNames, finalPaths) => ({
        ...metadata,
        imageCount: finalPaths.length,
        imageFileNames: finalFileNames,
        imageFileSize: Bun.file(finalPaths[0] as string).size
      })
    }
  })

  return {
    imagePaths: result.paths,
    metadata: result.metadata
  }
}

export const runImageGen = async (
  prompt: string,
  outputDir: string,
  options: ImageGenOptions
): Promise<{ imagePaths: string[], metadata: Step5Metadata[] }> => {
  const targets = collectImageTargets(options)
  if (targets.length === 0) {
    throw UsageError('Specify an image generation provider with --provider gemini|openai|grok|replicate|lumalabs|fal[=model]')
  }

  return await runImageTargets(targets, prompt, outputDir, options)
}
