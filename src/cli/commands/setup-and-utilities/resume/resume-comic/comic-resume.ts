import type { AggregatedPriceEstimate, CliCommandContext, ComicRecoveryFlags, ComicRecoveryStage, ComicRecoveryStagePlan, ResumeHandler, ResumeTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { configurePinnedRunDir, getPinnedRunDir, resetPinnedRunDir } from '../../../command-shared/run-dir'
import { configureCharactersRoot, getCharactersRoot } from '../../../command-shared/characters-root'
import { beginSceneRun, resetSceneRunContext } from '../../../visuals/comic/comic-utils/scene-run-context'
import { resolveCompatibleComicSceneRun } from '../../../visuals/comic/comic-utils/compatible-scene-run'
import { readManifest } from '../../../command-shared/pipeline-manifest'
import { validateComicRecoveryInputs } from '../../../visuals/comic/comic-utils/comic-recovery-intent'
import { captureComicImageRecoveryInputs, comicImageRecoveryHash } from '../../../visuals/comic/comic-utils/comic-image-recovery'
import { coerceAndValidateGenerateImages } from '../../../visuals/comic/comic-utils/cli-args'
import { generateImagesCommandDefinition, generateAudioCommandDefinition, generateSlideshowCommandDefinition } from '../../../visuals/comic/comic-utils/subcommand-help'
import { generateImagesCommand } from '../../../visuals/comic/comic-commands/generate-images/generate-images-command'
import { generateComicAudio } from '../../../visuals/comic/comic-commands/generate-audio/generate-audio-command'
import { planComicAudio } from '../../../visuals/comic/comic-commands/generate-audio/comic-audio-planning'
import { generateComicSlideshow, planComicSlideshow } from '../../../visuals/comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { resolvePresentationVisualInputs } from '../../../visuals/comic/comic-utils/comic-presentation-inputs'
import { loadCompactPresentation, selectPresentationVideoEncoder } from '../../../visuals/comic/comic-utils/comic-presentation-renderer'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../../../audio/tts/script-to-audio/contract-identity'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { priceComicImageRecovery } from './comic-resume-image-price'
import * as l from '~/utils/app-logger/app-logger'

const definitions = { image: generateImagesCommandDefinition, audio: generateAudioCommandDefinition, presentation: generateSlideshowCommandDefinition }
const stageOrder = ['image', 'audio', 'presentation'] as const
export const COMIC_RESUME_ALLOWED_FLAGS = new Set(['price', 'allow-ambiguous-redispatch', 'json', 'quiet', 'verbose', 'color', 'log-level', 'bin-dir'])

export const assertComicResumeFlags = (explicitFlags: ReadonlySet<string>): void => {
  for (const flag of explicitFlags) if (!COMIC_RESUME_ALLOWED_FLAGS.has(flag)) throw UsageError(`Comic resume does not accept --${flag}. It restores recorded options; use the explicit comic stage command to change providers, rendering options, or output paths.`)
}

const recoveryContext = (stage: ComicRecoveryStage, scriptPath: string, recordedFlags: ComicRecoveryFlags, price: boolean, allowAmbiguousRedispatch: boolean): CliCommandContext => {
  const definition = definitions[stage]
  const flags = { ...recordedFlags, price, ...(stage === 'audio' ? { 'allow-ambiguous-redispatch': allowAmbiguousRedispatch } : {}) }
  const args = [definition.name, scriptPath]
  for (const [key, value] of Object.entries(flags)) {
    if (Array.isArray(value)) for (const item of value) args.push(`--${key}`, item)
    else if (typeof value === 'boolean') args.push(`--${key}=${value}`)
    else args.push(`--${key}`, value)
  }
  const parsed = parseCommandInvocation(args, definition, GLOBAL_FLAG_DEFINITIONS)
  return { argv: args, command: definition, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: { comicResume: true } }
}

const inComicWorkspace = async <T>(target: ResumeTarget, run: () => Promise<T>): Promise<T> => {
  const previousPin = getPinnedRunDir()
  const previousCharacters = getCharactersRoot()
  configurePinnedRunDir(target.dir)
  resetSceneRunContext()
  try { return await run() }
  finally {
    resetSceneRunContext()
    resetPinnedRunDir()
    if (previousPin) configurePinnedRunDir(previousPin)
    configureCharactersRoot(previousCharacters)
  }
}

export const planComicResume = async (target: ResumeTarget, allowAmbiguousRedispatch = false) => await inComicWorkspace(target, async () => {
  const manifest = await readManifest(target.dir)
  const scriptPath = manifest?.items[0]?.input
  if (!manifest || manifest.command !== 'comic' || !scriptPath) throw UsageError('Comic resume requires one canonical comic scene manifest.')
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath, outputDir: target.dir, readOnly: true })
  beginSceneRun(compatible.sourceIdentity.scriptSlug, { outputDir: target.dir })
  const plans: ComicRecoveryStagePlan[] = []
  for (const stage of stageOrder) {
    const state = compatible.comicMetadata.stages[stage]
    const intent = compatible.comicMetadata.recovery?.[stage]
    const entry: ComicRecoveryStagePlan = { stage, action: 'reuse', detail: 'Verified retained artifacts.', steps: [] }
    plans.push(entry)
    try {
      if (state.requirement === 'not-requested') {
        if (intent && !intent.completed) throw UsageError('The recorded intent contradicts a not-requested stage.')
        entry.action = 'not-requested'
        entry.detail = 'No work was requested.'
        continue
      }
      if (intent) {
        configureCharactersRoot(intent.charactersRoot)
        await validateComicRecoveryInputs(target.dir, intent)
        if (stage === 'image' && canonicalTtsJson(await captureComicImageRecoveryInputs(target.dir)) !== canonicalTtsJson(intent.inputs)) throw UsageError('Comic image inputs were added, removed, or changed since the recorded request. Review them through the explicit image command.')
      }
      if (state.status === 'full' || state.status === 'skipped') {
        if (!intent || intent.completed) {
          if (stage === 'presentation' && state.status === 'full') {
            const retained = await loadCompactPresentation(target.dir, compatible.comicMetadata.presentation.selectedPresentationId)
            if (!retained) throw UsageError('The completed presentation is missing its retained plan.')
            const original = retained.presentation.plan
            const flags = { fps: String(original.options.fps), 'untimed-panel-ms': String(original.options.untimedPanelMs), 'audio-target': `${original.inputs.audioTarget.provider}=${original.inputs.audioTarget.model}` }
            const current = await planComicSlideshow(recoveryContext(stage, scriptPath, flags, true, false), scriptPath)
            if (current.presentationPlan.presentationId !== original.presentationId) throw UsageError('Completed presentation dependencies changed; use comic generate-slideshow to review and select the current inputs.')
          }
          continue
        }
      }
      if (!intent) throw UsageError(`This run lacks exact ${stage} recovery options. Use comic ${definitions[stage].name.slice(6)} with the original choices; outputs were preserved.`)
      const ctx = recoveryContext(stage, scriptPath, intent.flags, true, allowAmbiguousRedispatch)
      if (stage === 'image') {
        if (!intent.imageRunId) throw UsageError('This image request lacks its original output run ID; use the explicit image command after reviewing retained outputs.')
        const options = { ...coerceAndValidateGenerateImages(ctx), sceneSlug: compatible.sourceIdentity.scriptSlug, recoveryRunId: intent.imageRunId }
        if (options.force || options.qaOnly || options.revisionPlan) throw UsageError('Forced regeneration and audit/revision runs require the explicit comic image command; resume never overwrites completed panels.')
        if (comicImageRecoveryHash(options) !== intent.planHash) throw UsageError('Recorded image options no longer resolve to the original plan; explicit review is required.')
        entry.steps = await priceComicImageRecovery(options)
        entry.detail = 'Continue recorded panels and models; estimate includes modeled QA and repair work.'
      } else if (stage === 'audio') {
        const planned = await planComicAudio(ctx, scriptPath)
        if (planned.planHash !== intent.planHash) throw UsageError('Recorded audio choices or approved voice evidence no longer match the original render plan.')
        if (planned.blockers.length) throw UsageError(planned.blockers.join(' '))
        entry.steps = planned.steps
        entry.detail = `${planned.estimates.reduce((sum, estimate) => sum + estimate.recoveredSlotCount, 0)} retained audio slots; continue unresolved work and local publication.`
      } else {
        if (hashCanonicalTtsValue({ flags: intent.flags, inputs: intent.inputs, ...(intent.afterAudio ? { afterAudio: intent.afterAudio } : {}) }) !== intent.planHash) throw UsageError('Recorded presentation intent does not match its bound inputs and options.')
        if (intent.afterAudio && compatible.comicMetadata.recovery?.audio?.planHash !== intent.afterAudio) throw UsageError('Presentation was requested for a different audio plan; use the explicit slideshow command to select the changed audio.')
        const audio = plans.find(plan => plan.stage === 'audio')!
        if (audio.action === 'blocked') throw UsageError('Presentation is blocked by its recorded audio dependency.')
        if (audio.action === 'resume' && intent.afterAudio) {
          await resolvePresentationVisualInputs(compatible)
          await selectPresentationVideoEncoder()
          entry.action = 'after-audio'
          entry.detail = 'Local presentation after the recorded audio completes; final timeline readiness will be checked again.'
          continue
        }
        await planComicSlideshow(ctx, scriptPath)
        entry.detail = 'Verified local presentation; no hosted dependencies will be generated.'
      }
      entry.action = 'resume'
    } catch (error) {
      entry.action = 'blocked'
      entry.detail = error instanceof Error ? error.message : String(error)
    }
  }
  const steps = plans.flatMap(plan => plan.steps)
  const ready = plans.every(plan => plan.action !== 'blocked')
  const estimate: AggregatedPriceEstimate = { steps, totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0), notes: plans.map(plan => `${plan.stage}: ${plan.action}: ${plan.detail}`) }
  return { scriptPath, ready, stages: plans, estimate, intents: compatible.comicMetadata.recovery }
})

export const comicResumeHandler: ResumeHandler<{ allowAmbiguousRedispatch?: boolean }> = {
  kind: 'comic',
  hasResumableWork: async (target, opts) => (await planComicResume(target, opts.allowAmbiguousRedispatch)).stages.some(stage => stage.action === 'resume' || stage.action === 'after-audio'),
  price: async (target, opts) => (await planComicResume(target, opts.allowAmbiguousRedispatch)).estimate,
  resume: async (target, opts) => {
    let plan = await planComicResume(target, opts.allowAmbiguousRedispatch)
    if (!plan.ready) throw UsageError(plan.stages.filter(stage => stage.action === 'blocked').map(stage => `${stage.stage}: ${stage.detail}`).join('\n'))
    for (const stage of stageOrder) {
      // Re-read canonical state and revalidate all dependencies before each stage.
      plan = await planComicResume(target, opts.allowAmbiguousRedispatch)
      if (!plan.ready) throw UsageError(plan.stages.filter(stage => stage.action === 'blocked').map(stage => stage.detail).join('\n'))
      if (plan.stages.find(entry => entry.stage === stage)?.action !== 'resume') continue
      await inComicWorkspace(target, async () => {
        const manifest = await readManifest(target.dir)
        const compatible = await resolveCompatibleComicSceneRun({ scriptPath: plan.scriptPath, outputDir: target.dir, readOnly: true })
        const intent = compatible.comicMetadata.recovery?.[stage]
        if (!manifest || !intent) throw UsageError(`Comic ${stage} recovery intent disappeared before execution.`)
        if (canonicalTtsJson(intent) !== canonicalTtsJson(plan.intents?.[stage])) throw UsageError(`Comic ${stage} recovery intent changed after planning; inspect resume --price again.`)
        configureCharactersRoot(intent.charactersRoot)
        beginSceneRun(compatible.sourceIdentity.scriptSlug, { outputDir: target.dir })
        const ctx = recoveryContext(stage, plan.scriptPath, intent.flags, false, opts.allowAmbiguousRedispatch === true)
        await validateComicRecoveryInputs(target.dir, intent)
        if (stage === 'image') await generateImagesCommand({ ...coerceAndValidateGenerateImages(ctx), sceneSlug: compatible.sourceIdentity.scriptSlug, ...(intent.imageRunId ? { recoveryRunId: intent.imageRunId } : {}) })
        else if (stage === 'audio') await generateComicAudio(ctx, plan.scriptPath)
        else await generateComicSlideshow(ctx, plan.scriptPath)
      })
    }
    plan = await planComicResume(target, opts.allowAmbiguousRedispatch)
    const incomplete = plan.stages.some(stage => stage.action !== 'reuse' && stage.action !== 'not-requested')
    if (incomplete) throw UsageError('Comic resume retained partial work; inspect resume --price for the remaining blockers.')
    l.write('info', `Comic resume complete: ${target.dir}`, { category: 'pipeline', metadata: { stages: plan.stages } })
    return { full: 1, incomplete: 0, failed: 0 }
  },
}
