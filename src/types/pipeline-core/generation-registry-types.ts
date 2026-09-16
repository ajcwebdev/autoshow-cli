import type { MusicGenOptions, MusicProvider, MusicTarget, ImageGenOptions, ImageProvider, ImageTarget, VideoGenOptions, VideoMode, VideoProvider, VideoTarget } from '~/types'

export type GenerationModality = 'image' | 'video' | 'music'

/**
 * Selection facts for one generation provider. Flag names, config surfaces, pricing selections and
 * resume fields are all derived from these entries rather than re-declared per consumer.
 */
export type GenerationSelectionEntry<TService extends string = string> = {
  readonly modality: GenerationModality
  readonly service: TService
  readonly flagName: string
  readonly runtimeModelsKey: string
  /** Credential label used in the missing-key error; the provider id and stage are derived from service and modality. */
  readonly credentialDescription: string
}

export type GenerationProviderTargetsOf<TEntries extends readonly GenerationSelectionEntry[]> = {
  readonly [Entry in TEntries[number] as Entry['service']]: Entry['flagName']
}

export type GenerationSelectionDescriptorOf<TEntries extends readonly GenerationSelectionEntry[]> = {
  readonly providerTargets: GenerationProviderTargetsOf<TEntries>
  readonly selections: {
    readonly [Entry in TEntries[number] as Entry['service']]: { readonly modelsKey: Entry['runtimeModelsKey'] }
  }
}

export type GenerationAllShortcutFlag = 'all-image' | 'all-video' | 'all-music'

/** A selection entry plus the model surface derived from it: supported models, validator, all-shortcut. */
export type GenerationModelEntry<TService extends string = string> = GenerationSelectionEntry<TService> & {
  readonly supportedModels: readonly string[]
  readonly validateModel: (value: string) => string
  readonly allShortcut: GenerationAllShortcutFlag
}

/** A selection entry plus everything needed to validate and dispatch that provider's targets. */
export type GenerationProviderEntry<TService extends string, TOptions, TTarget, TContext> =
  GenerationModelEntry<TService> & {
    readonly collectTargets: (options: TOptions, context: TContext) => TTarget[]
  }

export type ImageProviderEntry = GenerationProviderEntry<ImageProvider, ImageGenOptions, ImageTarget, void>
export type VideoProviderEntry = GenerationProviderEntry<VideoProvider, VideoGenOptions, VideoTarget, VideoMode>
export type MusicProviderEntry = GenerationProviderEntry<MusicProvider, MusicGenOptions, MusicTarget, void>

/** Pairs one hand-maintained `SUPPORTED_*` array with the registry service whose models it mirrors. */
export type SupportedModelSource = {
  readonly step: import('~/types').ModelCategory
  readonly service: string
  readonly arrayName: string
  readonly models: readonly string[]
}
