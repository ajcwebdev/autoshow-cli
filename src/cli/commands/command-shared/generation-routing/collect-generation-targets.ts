import type { GenerationProviderEntry, ProviderIdentity } from '~/types'

/**
 * Fans a run out across the registered providers for one modality. Providers are added by
 * registering an entry, not by editing a spread of static imports at the call site.
 */
export const collectGenerationTargets = <TService extends string, TOptions, TTarget extends ProviderIdentity, TContext>(
  entries: readonly GenerationProviderEntry<TService, TOptions, TTarget, TContext>[],
  options: TOptions,
  context: TContext
): TTarget[] => entries.flatMap(entry => entry.collectTargets(options, context))

