import type { ProviderSpec, RuntimeOptions, Step2ProviderSelectionFilter } from '~/types'
import { collectStep2ProviderSpecs } from '../step-2-shared/provider-registry'

export const collectUrlProviderSpecs = (
  options: Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends' | 'step2SelectionOrigins'>,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('url', options as Record<string, unknown>, filter)
}
