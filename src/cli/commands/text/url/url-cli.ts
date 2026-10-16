import type { ProviderSpec, Step2ProviderSelectionFilter, UrlSelectionOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { URL_ARTICLE_BACKENDS } from '../../command-shared/extract-routing/provider-registry'
import { collectStep2ProviderSpecs } from '../../command-shared/extract-routing/provider-registry'

export const collectUrlProviderSpecs = (
  options: UrlSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const backends = [options.urlBackend, ...(options.urlBackends ?? [])].filter(value => value !== undefined)
  for (const backend of backends) {
    if (!(URL_ARTICLE_BACKENDS as readonly unknown[]).includes(backend)) throw UsageError(`URL provider ${backend} is excluded or unsupported. Select an active URL provider explicitly.`)
  }
  return collectStep2ProviderSpecs('url', options as Record<string, unknown>, filter)
}
