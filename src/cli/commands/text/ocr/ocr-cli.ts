import type { OcrSelectionOptions, ProviderSpec, Step2ProviderSelectionFilter } from '~/types'
import { collectStep2ProviderSpecs } from '../../command-shared/extract-routing/provider-registry'

export const collectOcrProviderSpecs = (
  options: OcrSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('ocr', options, filter)
}
