import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import { readEnv } from '~/utils/validate/env-utils'
import {
  buildHappyScribeOrganizationResolutionError,
  resolveHappyScribeOrganizationSelection
} from './happyscribe'

const GENERIC_ESTIMATE_NOTE = 'Happy Scribe preflight uses the published $0.01/min AI rate; exact billed cents and credits are captured only on real runs.'

export const buildHappyScribeRegistryEstimate = (
  model: string,
  durationSeconds: number
): number => computeBilledSttCost('happyscribe', model, durationSeconds).cost

export const resolveHappyScribePriceNotes = async (
  options: {
    preferredOrganizationId?: string | undefined
  }
): Promise<string[]> => {
  const notes = [GENERIC_ESTIMATE_NOTE]
  if (!readEnv('HAPPYSCRIBE_API_KEY')) {
    notes.push('HAPPYSCRIBE_API_KEY is not set; organization-scoped pricing checks were skipped.')
    return notes
  }

  try {
    const selection = await resolveHappyScribeOrganizationSelection({
      preferredOrganizationId: options.preferredOrganizationId
    })
    if (!selection.selected) {
      notes.push(`${buildHappyScribeOrganizationResolutionError(selection).message} Price output remains a generic estimate until execution.`)
      return notes
    }

    if (selection.selected.currency && selection.selected.currency !== 'usd') {
      notes.push(`Happy Scribe organization ${selection.selected.id}${selection.selected.name ? ` (${selection.selected.name})` : ''} reports currency ${selection.selected.currency}; v1 execution supports exact-cost capture only for usd organizations.`)
    }
  } catch (error) {
    notes.push(`Happy Scribe organization lookup was skipped during pricing (${error instanceof Error ? error.message : String(error)}).`)
  }

  return notes
}
