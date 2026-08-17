import type { HostedConcurrencyRuntimeOptions, HostedConcurrencyWorkClass, ProviderIdentity, ResourceGate, SingleFileRunResult, TargetPoolKind, TargetSchedulerConcurrency } from '~/types'

export type BuildSingleArtifactMapOptions<T> = {
  singleKey: string
  multiKeyPrefix: string
  getService: (item: T) => string
  getModel: (item: T) => string
  getFileName: (item: T) => string
}

export type RunTargetsOptionsBase<TTarget extends ProviderIdentity> = HostedConcurrencyRuntimeOptions & {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  concurrency?: TargetSchedulerConcurrency | undefined
  resourceGate?: ResourceGate | undefined
  getResourceGate?: ((target: TTarget) => ResourceGate | undefined) | undefined
  getTargetPool?: ((target: TTarget) => TargetPoolKind) | undefined
  getTargetPriority?: ((target: TTarget, index: number) => number | undefined) | undefined
  useWorkspaceForSingleTarget?: boolean | undefined
  preserveWorkspaceOnFailure?: boolean | undefined
  hostedWorkClass?: HostedConcurrencyWorkClass | undefined
}

export type RunSingleFileTargetsOptions<TTarget extends ProviderIdentity, TMetadata> = RunTargetsOptionsBase<TTarget> & {
  workspacePrefix: string
  runTarget: (target: TTarget, workspaceDir: string) => Promise<SingleFileRunResult<TMetadata>>
  getArtifactFileName: (target: TTarget, singleTarget: boolean) => string
  finalizeMetadata: (metadata: TMetadata, finalFileName: string, finalPath: string) => TMetadata
}

export type RunTargetsOptions<TTarget extends ProviderIdentity, TResult> = RunTargetsOptionsBase<TTarget> & {
  getWorkspaceDir: (outputDir: string, target: TTarget) => string
  runTarget: (target: TTarget, workspaceDir: string) => Promise<TResult>
  finalizeTarget: (target: TTarget, result: TResult, singleTarget: boolean) => Promise<TResult>
  onTargetFailure?: ((target: TTarget, error: unknown, workspaceDir: string) => Promise<void>) | undefined
}

export type SingleFileArtifactNameOptions = {
  singleFileName: string
  multiFilePrefix: string
  extension: string
}
