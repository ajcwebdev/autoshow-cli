import type { DraftTreatmentCommandOptions } from '~/types'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/comic-argument-defaults'
import { estimateTokens, logLlmTokenEstimate } from '../../comic-utils/comic-price-llm-estimates'
import { priceLine } from '../../comic-utils/price-estimate-logging'
import { readTreatmentCatalogInputs } from './treatment-catalog-merge'
import { TREATMENT_DRAFT_MAX_ATTEMPTS, TREATMENT_OUTPUT_UNITS_FIXED, TREATMENT_OUTPUT_UNITS_PER_PANEL } from './treatment-defaults'
import { buildTreatmentDraftPrompt } from './treatment-llm-prompt'
import { loadTreatmentSource } from './treatment-source-loader'

export const estimateDraftTreatmentPrice = async (options: DraftTreatmentCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const source = await loadTreatmentSource(options.treatmentPath)
  const catalogs = await readTreatmentCatalogInputs()
  const prompt = buildTreatmentDraftPrompt({
    source,
    panelRange: options.panelRange,
    voicePacing: options.voicePacing,
    speakers: options.speakers,
    existingCharacterKeys: catalogs.characters.characters.map(character => character.key),
    existingLocationKeys: catalogs.locations?.locations.map(location => location.key) ?? [],
  })
  const panelCount = options.panelRange.maximum
  const outputUnitsPerCall = TREATMENT_OUTPUT_UNITS_FIXED + TREATMENT_OUTPUT_UNITS_PER_PANEL * panelCount
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-treatment',
    model,
    'treatmentFile',
    options.treatmentPath,
    estimateTokens(prompt),
    {
      maximumCalls: TREATMENT_DRAFT_MAX_ATTEMPTS,
      outputUnitsPerCall,
      basisNote: `Treatment estimate: input units ~ chars / 4 over the full prompt including the treatment text, no cache discount, output ${TREATMENT_OUTPUT_UNITS_FIXED} fixed units plus ${TREATMENT_OUTPUT_UNITS_PER_PANEL} units per panel across ${panelCount} panel${panelCount === 1 ? '' : 's'} (the range maximum); maximum calls ${TREATMENT_DRAFT_MAX_ATTEMPTS} including one retry that appends validator errors`,
      metadata: {
        stage: 'draft-treatment',
        panelCount,
        panelRange: `${options.panelRange.minimum}-${options.panelRange.maximum}`,
        voicePacing: options.voicePacing,
        pageCount: source.pageCount,
        sourceKind: source.kind,
        speakers: [...options.speakers],
      },
    }
  )
  priceLine('Comic - Price Estimate: draft-treatment: price mode makes no provider call and writes no catalog, script, or run artifacts.', {
    stage: 'draft-treatment',
    llmCalls: 0,
    writes: 0,
    totalCost: 0,
  })
}
