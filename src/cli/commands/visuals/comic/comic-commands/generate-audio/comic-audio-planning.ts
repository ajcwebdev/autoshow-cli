import type { CliCommandContext, ComicRecoveryFlags, CurrentTtsResumePricePlan, StepEstimate } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { createResourceGate } from '~/utils/resource-gate'
import { UsageError } from '~/utils/error-handler'
import { canonicalTargetKey, hashCanonicalTtsValue } from '../../../../audio/tts/script-to-audio/contract-identity'
import { planCurrentTtsResumePrice } from '../../../../audio/tts/script-to-audio/current-render-attempt'
import { validateTtsRenderInputsForTargets } from '../../../../audio/tts/run-tts'
import { collectTtsTargets } from '../../../../audio/tts/tts-targets'
import { createHostedTtsChunkScheduler } from '../../../../audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { createSoundscapePlan, DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '../../../../audio/tts/soundscape/soundscape-planner'
import { planComicSoundscapePrice } from '../../comic-utils/comic-soundscape-workflow'
import { flattenTurns, resolveComicAudioInvocation } from './comic-audio-invocation'
import { resolveComicVoiceSnapshot } from './comic-voice-snapshot'
import { buildTargetExecution } from './comic-audio-execution'

export const planComicAudio = async (ctx: CliCommandContext, scriptPath: string) => {
  const invocation = await resolveComicAudioInvocation(ctx, scriptPath)
  const { compatible, dialoguePlan, baseOptions, profileKey, mode, deliveryPolicy, sampleRate, channels, codec } = invocation
  const turns = flattenTurns(dialoguePlan)
  const soundscapePlan = createSoundscapePlan({ structuredScript: compatible.structuredScript, structuredScriptRef: dialoguePlan.structuredScript, dialoguePlan, sceneRunIdentity: dialoguePlan.sceneRunIdentity, createdAt: compatible.manifest.createdAt, mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, timingPolicy: invocation.soundscapeTimingPolicy })
  const soundscapePrice = await planComicSoundscapePrice({ rootDir: compatible.sceneRunDir, plan: soundscapePlan, selector: invocation.sfxSelector, licenseUseClassification: invocation.sfxLicenseUseClassification, retainedPlanRef: compatible.comicMetadata.audio.soundEffectRenderPlanRef })
  const targets = turns.length === 0 ? [] : collectTtsTargets(baseOptions).map(target => {
    const transport = target.transport ?? 'hosted-api'
    return { ...target, operation: 'comic-audio' as const, transport, targetKey: canonicalTargetKey('comic-audio', target.service, target.model, transport) }
  })
  if (turns.length > 0 && targets.length === 0) throw UsageError('Comic audio requires at least one selected TTS provider target.')
  if (new Set(targets.map(target => target.targetKey)).size !== targets.length) throw UsageError('Comic audio provider selection contains duplicate operation-scoped provider/model targets.')
  const voices = turns.length > 0 ? await resolveComicVoiceSnapshot({ compatible, dialoguePlan, targets, profileKey }) : undefined
  baseOptions.hostedTtsChunkScheduler ??= createHostedTtsChunkScheduler({ maxConcurrency: baseOptions.ttsChunkConcurrency, concurrencyMode: baseOptions.concurrencyMode, hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator })
  const resourceGate = createResourceGate({ capacity: baseOptions.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const executions = voices ? targets.map(target => buildTargetExecution({ target, baseOptions, snapshot: voices.snapshot, dialoguePlan, mode, deliveryPolicy, sampleRate, channels, codec, resourceGate })) : []
  const estimates: CurrentTtsResumePricePlan[] = []
  for (const execution of executions) {
    validateTtsRenderInputsForTargets([execution.target], execution.sourceText, execution.options, { comicContext: execution.context })
    estimates.push(await planCurrentTtsResumePrice({ rootDir: compatible.sceneRunDir, state: compatible.manifest.items[0]?.providers.find(state => state.targetKey === execution.target.targetKey), target: execution.target, sourceText: execution.sourceText, ttsOptions: execution.options, comicContext: execution.context }))
  }
  const flags: ComicRecoveryFlags = {
    ...(targets.length ? { provider: targets.map(target => `${target.service}=${target.model}`) } : {}),
    profile: profileKey, mode, 'delivery-policy': deliveryPolicy, 'pacing-profile': invocation.pacingProfile,
    'soundscape-timing-policy': invocation.soundscapeTimingPolicy,
    'sfx-concurrency': String(invocation.sfxConcurrency),
    'provider-concurrency': String(baseOptions.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY),
    'tts-chunk-concurrency': String(baseOptions.ttsChunkConcurrency ?? DEFAULT_CLI_CONCURRENCY),
    'concurrency-mode': baseOptions.concurrencyMode ?? 'ramp',
    ...(invocation.rolePolicies.length ? { role: invocation.rolePolicies.map(role => `${role.speakerLabel}=${role.subjectKey}`) } : {}),
    ...(invocation.sfxSelector ? { 'sfx-provider': invocation.sfxSelector } : {}),
    ...(invocation.sfxLicenseUseClassification ? { 'sfx-license-use': invocation.sfxLicenseUseClassification } : {}),
  }
  const steps: StepEstimate[] = executions.map((execution, index) => ({ step: 'tts', provider: execution.target.service, model: execution.target.model, totalCost: estimates[index]!.plannedCost.amounts.reduce((sum, cost) => sum + (cost.currency === 'USD' ? cost.amount * 100 : 0), 0), characterCount: estimates[index]!.unresolvedCharacterCount, note: `${estimates[index]!.recoveredSlotCount} retained slots; ${estimates[index]!.unresolvedSlotCount} unresolved` }))
  if (soundscapePrice.renderPlan && soundscapePrice.estimate) steps.push({ step: 'tts', provider: soundscapePrice.renderPlan.target.provider, model: soundscapePrice.renderPlan.target.model, totalCost: (soundscapePrice.estimate.amount ?? 0) * 100, note: soundscapePrice.summary })
  const blockers = estimates.flatMap((estimate, index) => estimate.reconciliationBlockers.length && !invocation.allowAmbiguousRedispatch
    ? [`${executions[index]!.target.targetKey}: ambiguous admitted audio slots require reconciliation or explicit --allow-ambiguous-redispatch.`] : [])
  if (soundscapePrice.estimate?.amount === null) blockers.push('The remaining sound-effect price is unknown; use the explicit comic audio command after reviewing its provider terms.')
  for (const estimate of estimates) if (estimate.plannedCost.amounts.some(cost => cost.currency !== 'USD')) blockers.push('Comic resume requires a USD price for every recorded audio target.')
  const planHash = hashCanonicalTtsValue({ dialoguePlanId: dialoguePlan.dialoguePlanId, soundscapePlanId: soundscapePlan.soundscapePlanId, soundEffectPlan: soundscapePrice.renderPlan ?? null, snapshotId: voices?.snapshot.snapshotId ?? null, sampleRate, channels, codec, renderIdentities: estimates.map(estimate => estimate.readiness.renderIdentity) })
  return { invocation, turns, soundscapePlan, soundscapePrice, soundEffectRenderPlan: soundscapePrice.renderPlan, executions, estimates, snapshot: voices?.snapshot, retainedSnapshot: voices?.retainedSnapshot, flags, steps, blockers, planHash }
}
