import type { ProviderRenderPlan } from '~/types'
import type { ProviderResolvedDialogueTurn } from '~/types/tts-workflow/voice-and-dialogue-types'
import { UsageError } from '~/utils/error-handler'
import { validatePreparedProviderText, validateProviderVoiceRef } from './contract-validation-capability'
import { assertUnique, validateTypedSettings } from './contract-validation-primitives'

export const validateRenderPlanTurns = (plan: ProviderRenderPlan): ProviderResolvedDialogueTurn[] => {
  const turns = plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)
  if (turns.length === 0) throw UsageError('Provider render plan requires speakable resolved turns.')
  if (plan.nodes.some(node => node.kind === 'overlap' && (!node.groupId.trim() || node.turns.length < 2))) throw UsageError('Provider render overlap nodes require a stable group ID and at least two resolved turns.')
  assertUnique(turns.map((turn) => turn.turnId), 'Provider render turn IDs')
  for (const turn of turns) {
    if (!turn.turnId.trim() || !turn.sourceSegmentId.trim() || !turn.subjectKey.trim() || !turn.originalSpeakerLabel.trim() || !turn.canonicalText.trim()) {
      throw UsageError('Provider render turn identity and canonical text must not be empty.')
    }
    validatePreparedProviderText(turn.providerText)
    if (turn.providerText.canonicalText !== turn.canonicalText) {
      throw UsageError('Prepared provider text must bind the exact canonical turn text.')
    }
    validateTypedSettings(turn.providerControls, 'Provider turn controls')
    if (turn.providerDelivery) validateTypedSettings(turn.providerDelivery, 'Provider turn delivery')
    validateProviderVoiceRef(turn.voice.providerVoice)
    if (turn.voice.providerVoice.provider !== plan.provider || turn.voice.providerModel !== plan.model) {
      throw UsageError('Resolved voice binding does not match the provider render target.')
    }
    if (turn.voice.settingsSchema !== turn.voice.synthesisSettings.settingsSchema) {
      throw UsageError('Resolved voice settings schema does not match its synthesis settings payload.')
    }
    validateTypedSettings(turn.voice.synthesisSettings, 'Resolved voice synthesis settings')
  }

  return turns
}
