import { isRecord } from '~/utils/rest-client'
import { UsageError } from '~/utils/error-handler'
import type { GenerationResumeConfig, GenerationResumePreparation, PipelineManifest, ProviderIdentity, ResumeTarget } from '~/types'
import { getConfiguredProviderKey } from './generation-resume-preparation'

export const buildUpdatedGenerationCostTiming = (
  currentMetadata: Record<string, unknown>,
  actual: unknown,
  actualTiming: unknown
): Record<string, unknown> => ({
  cost: {
    ...(isRecord(currentMetadata['cost']) ? currentMetadata['cost'] : {}),
    actual
  },
  timing: {
    ...(isRecord(currentMetadata['timing']) ? currentMetadata['timing'] : {}),
    actual: actualTiming
  }
})

export const reconcileGenerationBatchSummary = async (
  config: { kind: PipelineManifest['command'], stepLabel: string },
  manifestUpdater: (
    update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
  ) => Promise<PipelineManifest>
): Promise<void> => {
  await manifestUpdater((manifest) => {
    if (manifest.command !== config.kind || manifest.scope !== 'batch') {
      throw UsageError(`Canonical ${config.stepLabel} batch manifest changed incompatibly during resume summary reconciliation.`)
    }

    const ok = manifest.items.filter((item) => item.status === 'full').length
    const partial = manifest.items.filter((item) => item.status === 'incomplete' || item.status === 'skipped').length
    const fail = manifest.items.filter((item) => item.status === 'failed').length
    const currentSource = isRecord(manifest.source) ? manifest.source : {}
    const currentSummary = isRecord(currentSource['summary']) ? currentSource['summary'] : {}
    const requestedProviders = [...new Map(manifest.items.flatMap((item) =>
      item.providers.flatMap((provider) => typeof provider.model === 'string'
        ? [[`${provider.service}\u0000${provider.model}`, { service: provider.service, model: provider.model }] as const]
        : [])
    )).values()]

    return {
      ...manifest,
      source: {
        ...currentSource,
        selectedCount: manifest.items.length,
        summary: {
          ...currentSummary,
          ok,
          partial,
          fail,
          ...(Array.isArray(currentSummary['requestedProviders'])
            ? {}
            : { requestedProviders })
        }
      }
    }
  })
}

export const reconcileGenerationManifest = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  newMetadata: TMetadata[],
  targetsToRun: TTarget[],
  input: string,
  itemIndex: number,
  manifestUpdater: (update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>) => Promise<PipelineManifest>
) => {
  const { existingEntries, successKeys, resolved } = prep
  const getProviderKey = (provider: ProviderIdentity): string => getConfiguredProviderKey(config, provider)
  const mergedMetadata = [...existingEntries, ...newMetadata]

  const mergedSuccessKeys = new Set([
    ...successKeys,
    ...newMetadata.map(config.getSuccessKey)
  ])
  const stillMissing = resolved.requestedProviders.filter(
    (provider) => !mergedSuccessKeys.has(getProviderKey(provider))
  )
  await manifestUpdater((latestManifest) => {
    const latestItem = latestManifest.items[itemIndex]
    if (
      !latestItem
      || latestManifest.command !== config.kind
      || latestManifest.scope !== target.scope
      || (target.scope === 'single' && latestManifest.items.length !== 1)
    ) {
      throw UsageError(`Canonical ${config.stepLabel} manifest changed incompatibly during resume.`)
    }
    const rebuiltMetadata = config.rebuildRunMetadata
      ? config.rebuildRunMetadata(mergedMetadata, latestItem.metadata, input)
      : {}
    const nextProviders = config.reconcileProviderStates
      ? config.reconcileProviderStates({
          currentProviders: latestItem.providers,
          requestedProviders: resolved.requestedProviders,
          targetsToRun,
          existingEntries,
          newEntries: newMetadata,
          mergedEntries: mergedMetadata,
          completedProviderKeys: mergedSuccessKeys
        })
      : (() => {
          const nextProviderByKey = new Map(latestItem.providers.flatMap((provider) =>
            typeof provider.model === 'string'
              ? [[getProviderKey(provider as ProviderIdentity), provider] as const]
              : []
          ))
          for (const provider of resolved.requestedProviders) {
            const key = getProviderKey(provider)
            const current = nextProviderByKey.get(key)
            const succeeded = mergedSuccessKeys.has(key)
            nextProviderByKey.set(key, {
              service: provider.service,
              model: provider.model,
              artifactDir: current?.artifactDir ?? '.',
              status: succeeded ? 'succeeded' : 'missing',
              attempts: Math.max(current?.attempts ?? 0, succeeded ? 1 : 0),
              options: current?.options ?? {},
              metadata: current?.metadata ?? {},
              ...(succeeded ? {} : current?.error ? { error: current.error } : {})
            })
          }
          return [...nextProviderByKey.values()]
        })()
    const nextItem = {
      ...latestItem,
      input: config.kind === 'tts' ? latestItem.input : input,
      status: stillMissing.length > 0 ? 'incomplete' as const : 'full' as const,
      metadata: {
        ...latestItem.metadata,
        ...rebuiltMetadata,
        [config.metadataKey]: config.serializeEntries
          ? config.serializeEntries(mergedMetadata)
          : mergedMetadata
      },
      providers: nextProviders
    }
    return {
      ...latestManifest,
      items: target.scope === 'batch'
        ? latestManifest.items.map((entry, index) => index === itemIndex ? nextItem : entry)
        : [nextItem]
    }
  })

  return { mergedSuccessKeys, stillMissing }
}
