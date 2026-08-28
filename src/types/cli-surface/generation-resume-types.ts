import type {
  AdditiveResumeProviderSelection,
  GenerationResumeProviderIdentity,
  PipelineManifest,
  PipelineManifestItem,
  ProviderIdentity
} from '~/types'

export type GenerationResumePreparation<TTarget extends ProviderIdentity, TMetadata> = {
  manifest: PipelineManifest
  item: PipelineManifestItem
  existingEntries: TMetadata[]
  successKeys: Set<string>
  selectedTargets: TTarget[]
  selectedProviders: GenerationResumeProviderIdentity[] | undefined
  resolved: AdditiveResumeProviderSelection<GenerationResumeProviderIdentity>
}
