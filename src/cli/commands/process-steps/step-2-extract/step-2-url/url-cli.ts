import type { ProviderSpec, Step2ProviderSelectionFilter, UrlSelectionOptions } from '~/types'
import { collectStep2ProviderSpecs } from '../step-2-shared/provider-registry'

export const collectUrlProviderSpecs = (
  options: UrlSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('url', options as Record<string, unknown>, filter)
}
