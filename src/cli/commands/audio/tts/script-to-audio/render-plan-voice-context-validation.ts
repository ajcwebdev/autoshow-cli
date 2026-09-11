import type { ProviderRenderPlan } from '~/types'
import type { ProviderResolvedDialogueTurn } from '~/types/tts-workflow/voice-and-dialogue-types'
import { UsageError } from '~/utils/error-handler'
import { computeVoiceContextKey } from './contract-identity'

export const validateRenderPlanVoiceContext = (plan: ProviderRenderPlan, turns: ProviderResolvedDialogueTurn[]): void => {
  if (plan.voiceContext.kind === 'approved-snapshot') {
    const snapshotId = plan.voiceContext.snapshotId
    if (
      turns.some((turn) => turn.voice.kind !== 'approved-snapshot' || turn.voice.snapshotId !== snapshotId)
      || plan.voiceContextKey !== computeVoiceContextKey(plan.voiceContext)
    ) {
      throw UsageError('Approved provider render voice context key does not match its snapshot.')
    }
  } else {
    const transientTurns = turns.map((turn) => {
      if (turn.voice.kind !== 'transient-provider-voice') {
        throw UsageError('Transient provider render context requires only transient voice bindings.')
      }
      return { turnId: turn.turnId, bindingIdentityHash: turn.voice.identityHash }
    })
    const declaredBindingIdentities = [...plan.voiceContext.bindingIdentityHashes].sort()
    const actualBindingIdentities = transientTurns.map((turn) => turn.bindingIdentityHash).sort()
    if (
      declaredBindingIdentities.length !== actualBindingIdentities.length
      || declaredBindingIdentities.some((identity, index) => identity !== actualBindingIdentities[index])
    ) {
      throw UsageError('Provider render transient binding identities must exactly match its turn bindings.')
    }
    if (plan.voiceContextKey !== computeVoiceContextKey({ kind: 'transient', turns: transientTurns })) {
      throw UsageError('Transient provider render voice context key does not match its exact turn bindings.')
    }
  }
}
