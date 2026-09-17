import type { HostedConcurrencyCoordinator, MediaArtifactTargetDescriptor, MediaFileTargetDescriptor, ProviderIdentity, ResourceGate } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { runMediaArtifactTargets, runSingleFileTargets } from './target-runner'

type MediaRunOptions = {
  providerConcurrency?: number | undefined
  localConcurrency?: number | undefined
  resourceGate?: ResourceGate | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
} | undefined

const resolveConcurrency = (options: MediaRunOptions) => ({
  provider: options?.providerConcurrency ?? DEFAULT_CLI_CONCURRENCY,
  local: options?.localConcurrency ?? DEFAULT_CLI_CONCURRENCY
})

const withHostedConcurrency = <TMetadata,>(metadata: TMetadata, options: MediaRunOptions): TMetadata => ({
  ...metadata,
  ...(options?.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {})
})

export const runMediaFileTargets = async <TTarget extends ProviderIdentity, TMetadata, TPrompt>(input: {
  descriptor: MediaFileTargetDescriptor<TTarget, TMetadata, TPrompt>
  targets: TTarget[]
  prompt: TPrompt
  outputDir: string
  options?: MediaRunOptions
}): Promise<{ paths: string[], metadata: TMetadata[] }> => {
  const successes = await runSingleFileTargets<TTarget, TMetadata>({
    targets: input.targets,
    outputDir: input.outputDir,
    stepLabel: input.descriptor.stepLabel,
    noProviderMessage: input.descriptor.noProviderMessage,
    concurrency: resolveConcurrency(input.options),
    resourceGate: input.options?.resourceGate,
    hostedConcurrencyCoordinator: input.options?.hostedConcurrencyCoordinator,
    hostedWorkClass: input.descriptor.hostedWorkClass,
    runTarget: async (target, workspaceDir) => await input.descriptor.runTarget(target, input.prompt, workspaceDir),
    workspacePrefix: input.descriptor.workspacePrefix,
    getArtifactFileName: input.descriptor.getArtifactFileName,
    finalizeMetadata: input.descriptor.finalizeMetadata
  })

  return {
    paths: successes.map(entry => entry.filePath),
    metadata: successes.map(entry => withHostedConcurrency(entry.metadata, input.options))
  }
}

/** Same descriptor shape as `runMediaFileTargets`, for modalities whose targets emit more than one artifact. */
export const runMediaArtifactFileTargets = async <TTarget extends ProviderIdentity, TMetadata, TPrompt>(input: {
  descriptor: MediaArtifactTargetDescriptor<TTarget, TMetadata, TPrompt>
  targets: TTarget[]
  prompt: TPrompt
  outputDir: string
  options?: MediaRunOptions
}): Promise<{ paths: string[], metadata: TMetadata[] }> => {
  const successes = await runMediaArtifactTargets<TTarget, TMetadata>({
    targets: input.targets,
    outputDir: input.outputDir,
    stepLabel: input.descriptor.stepLabel,
    noProviderMessage: input.descriptor.noProviderMessage,
    concurrency: resolveConcurrency(input.options),
    resourceGate: input.options?.resourceGate,
    hostedConcurrencyCoordinator: input.options?.hostedConcurrencyCoordinator,
    hostedWorkClass: input.descriptor.hostedWorkClass,
    runTarget: async (target, workspaceDir) => await input.descriptor.runTarget(target, input.prompt, workspaceDir),
    workspacePrefix: input.descriptor.workspacePrefix,
    getArtifactFileNames: input.descriptor.getArtifactFileNames,
    finalizeMetadata: input.descriptor.finalizeMetadata,
    finalizeSingleTarget: input.descriptor.finalizeSingleTarget,
    artifactFailureStage: input.descriptor.artifactFailureStage
  })

  return {
    paths: successes.flatMap(entry => entry.filePaths),
    metadata: successes.map(entry => withHostedConcurrency(entry.metadata, input.options))
  }
}
