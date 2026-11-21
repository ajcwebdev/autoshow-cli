import type { CliCommandContext, ComicLegacyImageIntentReport, ComicRecoveryFlags, ComicRecoveryIntent, ComicRecoveryStage, ComicRecoveryStagePlan, CompatibleComicSceneRun, ResumeTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { configureCharactersRoot } from '../../../command-shared/characters-root'
import { validateComicRecoveryInputs } from '../../../visuals/comic/comic-utils/comic-recovery-intent'
import { captureComicImageRecoveryInputs, comicImageRecoveryFlags, comicImageRecoveryHashFromFlags, currentComicImageRecoveryInputs, inspectLegacyComicImageOutputs, resolveComicImageRecoveryFlags } from '../../../visuals/comic/comic-utils/comic-image-recovery'
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

const formatLegacyImageIntent = (report: ComicLegacyImageIntentReport): string => {
  const completed = report.completedOutputs.length === 0
    ? 'No completed outputs were found at its recorded locations.'
    : `Completed outputs were preserved in place: ${report.completedOutputs.map(output => `${output.label} [${output.model}${output.variation ? `, ${output.variation}` : ''}] ${output.path}`).join('; ')}.`
  return [
    `Image run ${report.runId} cannot resume because ${report.reasons.join('; ')}.`,
    completed,
    `Resume will not pick a model, move files or regenerate a finished candidate. For outstanding work, choose one model explicitly: ${CLI_INVOCATION} comic generate-images <script-path> --provider <service=model>.`,
  ].join(' ')
}

const blockLegacyImageIntent = (entry: ComicRecoveryStagePlan | undefined, report: ComicLegacyImageIntentReport): never => {
  if (entry) entry.legacyImageIntent = report
  throw UsageError(formatLegacyImageIntent(report))
}

/** Resolve the image intent's recorded flags to current single-model flags, or report why a historical intent needs an explicit new selection. */
export const resolveImageRecoveryFlags = (scriptSlug: string, intent: ComicRecoveryIntent, entry?: ComicRecoveryStagePlan): ComicRecoveryFlags => {
  if (!intent.imageRunId) throw UsageError('This image request lacks its original output run ID; use the explicit image command after reviewing retained outputs.')
  if (comicImageRecoveryHashFromFlags(intent.flags, intent.imageRunId) !== intent.planHash) throw UsageError('Recorded image options do not match their plan hash; explicit review is required.')
  const resolution = resolveComicImageRecoveryFlags(intent.flags)
  if (resolution.status === 'current') return resolution.flags
  const runId = intent.imageRunId
  if (resolution.status === 'incompatible') {
    return blockLegacyImageIntent(entry, { runId, reasons: resolution.reasons, models: resolution.models, variations: resolution.variations, completedOutputs: inspectLegacyComicImageOutputs(scriptSlug, intent.flags, runId) })
  }
  if (resolution.explicitCanonicalVariation) {
    // An explicit `--variation canonical` wrote under <run>/canonical/<model>/; continuing at the new destination could repurchase those images.
    const completedOutputs = inspectLegacyComicImageOutputs(scriptSlug, intent.flags, runId)
    if (completedOutputs.length > 0) {
      return blockLegacyImageIntent(entry, { runId, reasons: ['its completed outputs are under the retired explicit canonical variation directory'], models: [resolution.model], variations: ['canonical'], completedOutputs })
    }
  }
  return resolution.flags
}

const planImageRecovery = async (ctx: CliCommandContext, scriptSlug: string, intent: ComicRecoveryIntent, flags: ComicRecoveryFlags, entry: ComicRecoveryStagePlan): Promise<void> => {
  const options = { ...coerceAndValidateGenerateImages(ctx), sceneSlug: scriptSlug, recoveryRunId: intent.imageRunId! }
  if (options.force) throw UsageError('Forced regeneration requires the explicit comic image command; resume never overwrites completed panels.')
  // Re-resolving the recorded flags must reproduce them exactly: same model, options, panels, layout and run.
  if (canonicalTtsJson(comicImageRecoveryFlags(options)) !== canonicalTtsJson(flags)) throw UsageError('Recorded image options no longer resolve to the original model and options; explicit review is required.')
  entry.steps = await priceComicImageRecovery(options)
  entry.detail = `Continue image run ${intent.imageRunId} with ${options.imageModel ?? flags['provider']}; completed outputs are reused and only missing base images are estimated.`
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
      if (stage === 'image') {
        // Inputs of the retired blocking workflow no longer bind image work; every other recorded input must be intact.
        const inputs = currentComicImageRecoveryInputs(intent)
        await validateComicRecoveryInputs(target.dir, { ...intent, inputs })
        if (canonicalTtsJson(await captureComicImageRecoveryInputs(target.dir)) !== canonicalTtsJson(inputs)) throw UsageError('Comic image inputs were added, removed, or changed since the recorded request. Review them through the explicit image command.')
      } else {
        await validateComicRecoveryInputs(target.dir, intent)
      }
    }
    if ((state.status === 'full' || state.status === 'skipped') && (!intent || intent.completed)) {
      if (stage === 'presentation' && state.status === 'full') {
        await validateRetainedPresentation(target, scriptPath, compatible)
      }
      return
    }
    if (!intent) throw UsageError(`This run lacks exact ${stage} recovery options. Use comic ${definitions[stage].name.slice(6)} with the original choices; outputs were preserved.`)
    if (stage === 'image') {
      const flags = resolveImageRecoveryFlags(compatible.sourceIdentity.scriptSlug, intent, entry)
      await planImageRecovery(recoveryContext(stage, scriptPath, flags, true, allowAmbiguousRedispatch), compatible.sourceIdentity.scriptSlug, intent, flags, entry)
    } else {
      const ctx = recoveryContext(stage, scriptPath, intent.flags, true, allowAmbiguousRedispatch)
      if (stage === 'audio') {
        await planAudioRecovery(ctx, scriptPath, intent, entry)
      } else if (await planPresentationRecovery(ctx, scriptPath, compatible, intent, plans, entry)) {
        return
      }
    }
    entry.action = 'resume'
  } catch (error) {
    entry.action = 'blocked'
    entry.detail = error instanceof Error ? error.message : String(error)
  }
}
