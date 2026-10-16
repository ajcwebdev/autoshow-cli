import type { CurrentTtsResumePricePlan, PipelineProviderState, PureCurrentTtsRenderPlanOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { buildPureCurrentTtsRenderPlan, planCurrentTtsReadiness, readAudioProjection, sumCosts } from './attempt-planning'
import { prepareCurrentTtsCompletedRecoveryImpl } from './recovery-exact-render'
import { prepareCurrentTtsCompatibleSlotRecoveryImpl } from './recovery-compatible-slots'
import { currentOpenAITtsSlotCost, estimateOpenAITtsSlots } from '../tts-services/tts-openai/openai-tts-pricing'
import { validateOpenAITtsRequest } from '../tts-services/tts-openai/openai-tts-request'

export const planCurrentTtsResumePriceImpl = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      state?: PipelineProviderState | undefined
    }
  ): Promise<CurrentTtsResumePricePlan> => {
    const { rootDir, state, ...planOptions } = options
    const planned = buildPureCurrentTtsRenderPlan(planOptions)
    const readiness = planCurrentTtsReadiness(planOptions)
    const slots = planned.planned.slots
    const requestedSlotLimit = planOptions.ttsOptions.ttsMaxGenerationSlots
    if (
      requestedSlotLimit !== undefined
      && (!Number.isSafeInteger(requestedSlotLimit) || requestedSlotLimit <= 0)
    ) throw UsageError('TTS maximum generation slots must be a positive safe integer.')
    const projection = state ? readAudioProjection(state) : undefined
    const retainedHasPlannedRender = projection?.activeWork?.kind === 'render'
      && projection.activeWork.renderIdentity === readiness.renderIdentity
      && projection.renderHistory.some((render) =>
        render.renderIdentity === readiness.renderIdentity)
    const sameRenderArchive = Boolean(
      projection?.archive
      && projection.selectedSuccess?.renderIdentity === readiness.renderIdentity
    )
    const recovery = state && (retainedHasPlannedRender || sameRenderArchive)
      ? await prepareCurrentTtsCompletedRecoveryImpl({
          rootDir,
          state,
          ...planOptions,
          reconciliationMode: 'report'
        })
      : undefined
    const compatibleRecovery = state && !retainedHasPlannedRender && !sameRenderArchive
      ? await prepareCurrentTtsCompatibleSlotRecoveryImpl({
          rootDir,
          outputDir: rootDir,
          state,
          ...planOptions,
          materialize: false,
          reconciliationMode: 'report'
        })
      : undefined
    const effectiveRecovery = recovery ?? compatibleRecovery
    const recoveredIds = new Set(effectiveRecovery?.kind === 'complete-render'
      ? slots.map((slot) => slot.generationSlotId)
      : effectiveRecovery?.kind === 'partial-slots'
        ? effectiveRecovery.recoveredSlots.map((slot) => slot.value.generationSlotId)
        : [])
    const unresolvedSlots = slots.filter((slot) =>
      !recoveredIds.has(slot.generationSlotId))
    const selectedSlots = requestedSlotLimit === undefined
      ? unresolvedSlots
      : unresolvedSlots.slice(0, requestedSlotLimit)
    if (options.target.service === 'openai') for (const slot of selectedSlots) {
      const controls = planned.planned.turns.find(turn => turn.canonical.turnId === slot.turnIds[0])!.effectiveControls
      validateOpenAITtsRequest(slot.providerText, controls['instructions'] as string | undefined, controls['speed'] as number | undefined)
    }
    const plannedCost = options.target.service !== 'openai' && effectiveRecovery === undefined && requestedSlotLimit === undefined
      ? readiness.plannedCost
      : sumCosts(selectedSlots.map((slot) => currentOpenAITtsSlotCost(options.target, slot, planned.planned.turns, slot === planned.planned.slots[0])))
    return {
      ...(options.target.service === 'openai' ? { openaiEstimate: estimateOpenAITtsSlots(selectedSlots, planned.planned.turns) } : {}),
      readiness,
      plannedCost,
      plannedSlotCount: selectedSlots.length,
      unresolvedSlotCount: unresolvedSlots.length,
      unresolvedCharacterCount: selectedSlots.reduce(
        (count, slot) => count + [...slot.providerText].length,
        0
      ),
      recoveredSlotCount: slots.length - unresolvedSlots.length,
      recoveryKind: effectiveRecovery?.kind ?? 'none',
      reconciliationBlockers: effectiveRecovery?.reconciliationBlockers ?? []
    }
}
