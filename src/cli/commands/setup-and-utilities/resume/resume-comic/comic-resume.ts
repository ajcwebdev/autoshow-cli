import type { AggregatedPriceEstimate, ComicRecoveryStagePlan, ResumeHandler, ResumeTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { configureCharactersRoot } from '../../../command-shared/characters-root'
import { beginSceneRun } from '../../../visuals/comic/comic-utils/scene-run-context'
import { resolveCompatibleComicSceneRun } from '../../../visuals/comic/comic-utils/compatible-scene-run'
import { readManifest } from '../../../command-shared/pipeline-manifest'
import { validateComicRecoveryInputs } from '../../../visuals/comic/comic-utils/comic-recovery-intent'
import { coerceAndValidateGenerateImages } from '../../../visuals/comic/comic-utils/cli-args'
import { generateImagesCommand } from '../../../visuals/comic/comic-commands/generate-images/generate-images-command'
import { generateComicAudio } from '../../../visuals/comic/comic-commands/generate-audio/generate-audio-command'
import { generateComicSlideshow } from '../../../visuals/comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { canonicalTtsJson } from '../../../audio/tts/script-to-audio/contract-identity'
import { inComicWorkspace, recoveryContext, stageOrder } from './comic-resume-context'
import { planComicRecoveryStage } from './comic-resume-stage-planners'
import * as l from '~/utils/app-logger/app-logger'

export const COMIC_RESUME_ALLOWED_FLAGS = new Set(['price', 'allow-ambiguous-redispatch', 'json', 'quiet', 'verbose', 'color', 'log-level', 'bin-dir'])

export const assertComicResumeFlags = (explicitFlags: ReadonlySet<string>): void => {
  for (const flag of explicitFlags) if (!COMIC_RESUME_ALLOWED_FLAGS.has(flag)) throw UsageError(`Comic resume does not accept --${flag}. It restores recorded options; use the explicit comic stage command to change providers, rendering options, or output paths.`)
}

export const planComicResume = async (target: ResumeTarget, allowAmbiguousRedispatch = false) => await inComicWorkspace(target, async () => {
  const manifest = await readManifest(target.dir)
  const scriptPath = manifest?.items[0]?.input
  if (!manifest || manifest.command !== 'comic' || !scriptPath) throw UsageError('Comic resume requires one canonical comic scene manifest.')
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath, outputDir: target.dir, readOnly: true })
  beginSceneRun(compatible.sourceIdentity.scriptSlug, { outputDir: target.dir })
  const plans: ComicRecoveryStagePlan[] = []
  for (const stage of stageOrder) {
    await planComicRecoveryStage(stage, target, scriptPath, compatible, plans, allowAmbiguousRedispatch)
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
