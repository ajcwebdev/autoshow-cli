import type { HostedConcurrencyCoordinator, MediaFileTargetDescriptor, ProviderIdentity, ResourceGate } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { runSingleFileTargets } from './target-runner'

export const runMediaFileTargets = async <TTarget extends ProviderIdentity, TMetadata, TPrompt>(input: {
  descriptor: MediaFileTargetDescriptor<TTarget, TMetadata, TPrompt>
  targets: TTarget[]
  prompt: TPrompt
  outputDir: string
  options?: {
    providerConcurrency?: number | undefined
    localConcurrency?: number | undefined
    resourceGate?: ResourceGate | undefined
    hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  } | undefined
}): Promise<{ paths: string[], metadata: TMetadata[] }> => {
  const successes = await runSingleFileTargets<TTarget, TMetadata>({
    targets: input.targets,
    outputDir: input.outputDir,
    stepLabel: input.descriptor.stepLabel,
    noProviderMessage: input.descriptor.noProviderMessage,
    concurrency: {
      provider: input.options?.providerConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      local: input.options?.localConcurrency ?? DEFAULT_CLI_CONCURRENCY
    },
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
    metadata: successes.map(entry => ({
      ...entry.metadata,
      ...(input.options?.hostedConcurrencyCoordinator ? { hostedConcurrency: input.options.hostedConcurrencyCoordinator.snapshot() } : {})
    }))
  }
}
