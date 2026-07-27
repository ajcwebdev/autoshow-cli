import type { GenerationResourceGate, ProviderIdentity, SingleFileRunResult, TargetPoolKind, TargetSchedulerConcurrency } from '~/types'

export type BuildSingleArtifactMapOptions<T> = {
  singleKey: string
  multiKeyPrefix: string
  getService: (item: T) => string
  getModel: (item: T) => string
  getFileName: (item: T) => string
}

export type RunTargetsOptionsBase<TTarget extends ProviderIdentity> = {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  concurrency?: TargetSchedulerConcurrency | undefined
  resourceGate?: GenerationResourceGate | undefined
  getTargetPool?: ((target: TTarget) => TargetPoolKind) | undefined
  getTargetPriority?: ((target: TTarget, index: number) => number | undefined) | undefined
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
}

export type SingleFileArtifactNameOptions = {
  singleFileName: string
  multiFilePrefix: string
  extension: string
}
