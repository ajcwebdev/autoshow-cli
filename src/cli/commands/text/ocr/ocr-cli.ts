import type { OcrSelectionOptions, ProviderSpec, Step2ProviderSelectionFilter } from '~/types'
import { assertNoRemovedOcrSelections } from './ocr-engine-selection'
import { collectStep2ProviderSpecs } from '../../command-shared/extract-routing/provider-registry'

export const collectOcrProviderSpecs = (
  options: OcrSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  assertNoRemovedOcrSelections(options)
  return collectStep2ProviderSpecs('ocr', options, filter)
}
