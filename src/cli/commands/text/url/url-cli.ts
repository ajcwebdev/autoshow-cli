import type { ProviderSpec, Step2ProviderSelectionFilter, UrlSelectionOptions } from '~/types'
import { collectStep2ProviderSpecs } from '../../command-shared/extract-routing/provider-registry'

export const collectUrlProviderSpecs = (
  options: UrlSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('url', options as Record<string, unknown>, filter)
}
