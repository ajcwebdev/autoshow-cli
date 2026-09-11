import type { CliCommandContext, ComicRecoveryIntent, ComicRecoveryStage, ComicRecoveryStagePlan, CompatibleComicSceneRun, ResumeTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { configureCharactersRoot } from '../../../command-shared/characters-root'
import { validateComicRecoveryInputs } from '../../../visuals/comic/comic-utils/comic-recovery-intent'
import { captureComicImageRecoveryInputs, comicImageRecoveryHash } from '../../../visuals/comic/comic-utils/comic-image-recovery'
import { coerceAndValidateGenerateImages } from '../../../visuals/comic/comic-utils/cli-args'
import { planComicAudio } from '../../../visuals/comic/comic-commands/generate-audio/comic-audio-planning'
import { planComicSlideshow } from '../../../visuals/comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { resolvePresentationVisualInputs } from '../../../visuals/comic/comic-utils/comic-presentation-inputs'
import { loadCompactPresentation, selectPresentationVideoEncoder } from '../../../visuals/comic/comic-utils/comic-presentation-renderer'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../../../audio/tts/script-to-audio/contract-identity'
import { priceComicImageRecovery } from './comic-resume-image-price'
import { definitions, recoveryContext } from './comic-resume-context'

const validateRetainedPresentation = async (target: ResumeTarget, scriptPath: string, compatible: CompatibleComicSceneRun): Promise<void> => {
  const retained = await loadCompactPresentation(target.dir, compatible.comicMetadata.presentation.selectedPresentationId)
  if (!retained) throw UsageError('The completed presentation is missing its retained plan.')
  const original = retained.presentation.plan
  const flags = { fps: String(original.options.fps), 'untimed-panel-ms': String(original.options.untimedPanelMs), 'audio-target': `${original.inputs.audioTarget.provider}=${original.inputs.audioTarget.model}` }
  const current = await planComicSlideshow(recoveryContext('presentation', scriptPath, flags, true, false), scriptPath)
  if (current.presentationPlan.presentationId !== original.presentationId) throw UsageError('Completed presentation dependencies changed; use comic generate-slideshow to review and select the current inputs.')
}

const planImageRecovery = async (ctx: CliCommandContext, scriptSlug: string, intent: ComicRecoveryIntent, entry: ComicRecoveryStagePlan): Promise<void> => {
  if (!intent.imageRunId) throw UsageError('This image request lacks its original output run ID; use the explicit image command after reviewing retained outputs.')
  const options = { ...coerceAndValidateGenerateImages(ctx), sceneSlug: scriptSlug, recoveryRunId: intent.imageRunId }
  if (options.force || options.qaOnly || options.revisionPlan) throw UsageError('Forced regeneration and audit/revision runs require the explicit comic image command; resume never overwrites completed panels.')
  if (comicImageRecoveryHash(options) !== intent.planHash) throw UsageError('Recorded image options no longer resolve to the original plan; explicit review is required.')
  entry.steps = await priceComicImageRecovery(options)
  entry.detail = 'Continue recorded panels and models; estimate includes modeled QA and repair work.'
}

const planAudioRecovery = async (ctx: CliCommandContext, scriptPath: string, intent: ComicRecoveryIntent, entry: ComicRecoveryStagePlan): Promise<void> => {
  const planned = await planComicAudio(ctx, scriptPath)
  if (planned.planHash !== intent.planHash) throw UsageError('Recorded audio choices or approved voice evidence no longer match the original render plan.')
  if (planned.blockers.length) throw UsageError(planned.blockers.join(' '))
  entry.steps = planned.steps
  entry.detail = `${planned.estimates.reduce((sum, estimate) => sum + estimate.recoveredSlotCount, 0)} retained audio slots; continue unresolved work and local publication.`
}

const planPresentationRecovery = async (ctx: CliCommandContext, scriptPath: string, compatible: CompatibleComicSceneRun, intent: ComicRecoveryIntent, plans: ComicRecoveryStagePlan[], entry: ComicRecoveryStagePlan): Promise<boolean> => {
  if (hashCanonicalTtsValue({ flags: intent.flags, inputs: intent.inputs, ...(intent.afterAudio ? { afterAudio: intent.afterAudio } : {}) }) !== intent.planHash) throw UsageError('Recorded presentation intent does not match its bound inputs and options.')
  if (intent.afterAudio && compatible.comicMetadata.recovery?.audio?.planHash !== intent.afterAudio) throw UsageError('Presentation was requested for a different audio plan; use the explicit slideshow command to select the changed audio.')
  const audio = plans.find(plan => plan.stage === 'audio')!
  if (audio.action === 'blocked') throw UsageError('Presentation is blocked by its recorded audio dependency.')
  if (audio.action === 'resume' && intent.afterAudio) {
    await resolvePresentationVisualInputs(compatible)
    await selectPresentationVideoEncoder()
    entry.action = 'after-audio'
    entry.detail = 'Local presentation after the recorded audio completes; final timeline readiness will be checked again.'
    return true
  }
  await planComicSlideshow(ctx, scriptPath)
  entry.detail = 'Verified local presentation; no hosted dependencies will be generated.'
  return false
}

export const planComicRecoveryStage = async (stage: ComicRecoveryStage, target: ResumeTarget, scriptPath: string, compatible: CompatibleComicSceneRun, plans: ComicRecoveryStagePlan[], allowAmbiguousRedispatch: boolean): Promise<void> => {
  const state = compatible.comicMetadata.stages[stage]
  const intent = compatible.comicMetadata.recovery?.[stage]
  const entry: ComicRecoveryStagePlan = { stage, action: 'reuse', detail: 'Verified retained artifacts.', steps: [] }
  plans.push(entry)
  try {
    if (state.requirement === 'not-requested') {
      if (intent && !intent.completed) throw UsageError('The recorded intent contradicts a not-requested stage.')
      entry.action = 'not-requested'
      entry.detail = 'No work was requested.'
      return
    }
    if (intent) {
      configureCharactersRoot(intent.charactersRoot)
      await validateComicRecoveryInputs(target.dir, intent)
      if (stage === 'image' && canonicalTtsJson(await captureComicImageRecoveryInputs(target.dir)) !== canonicalTtsJson(intent.inputs)) throw UsageError('Comic image inputs were added, removed, or changed since the recorded request. Review them through the explicit image command.')
    }
    if (state.status === 'full' || state.status === 'skipped') {
      if (!intent || intent.completed) {
        if (stage === 'presentation' && state.status === 'full') {
          await validateRetainedPresentation(target, scriptPath, compatible)
        }
        return
      }
    }
    if (!intent) throw UsageError(`This run lacks exact ${stage} recovery options. Use comic ${definitions[stage].name.slice(6)} with the original choices; outputs were preserved.`)
    const ctx = recoveryContext(stage, scriptPath, intent.flags, true, allowAmbiguousRedispatch)
    if (stage === 'image') {
      await planImageRecovery(ctx, compatible.sourceIdentity.scriptSlug, intent, entry)
    } else if (stage === 'audio') {
      await planAudioRecovery(ctx, scriptPath, intent, entry)
    } else {
      if (await planPresentationRecovery(ctx, scriptPath, compatible, intent, plans, entry)) return
    }
    entry.action = 'resume'
  } catch (error) {
    entry.action = 'blocked'
    entry.detail = error instanceof Error ? error.message : String(error)
  }
}
