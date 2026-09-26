import { validateGeminiJobRun } from './gemini-job-validation'
import { withProcessLock } from '~/utils/process-lock'
import { mkdir, copyFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PipelineManifestItem, Step4Metadata, PipelineManifest, TtsOptions, TtsTarget } from '~/types'
import type { GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { createGenerationOutputDir } from '~/cli/commands/command-shared/generation-command-utils'
import { createManifest, readManifest, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { collectTextInputFiles } from '~/cli/commands/text/write/text-input-utils'
import { prepareTtsInput, getTtsInputKind } from '../../tts-single-run'
import { buildPureCurrentTtsRenderPlan } from '../../script-to-audio/attempt-planning'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import { serializeGeminiBatchSpeech } from './gemini-tts-request'
import { estimateGeminiTtsCost } from './gemini-tts-pricing'
import { GEMINI_JOB_FILE, partitionGeminiJobs, persistGeminiJobs, submitGeminiJobs, reconcileGeminiJobs, recoverGeminiSubmissions, validateRetained } from './gemini-tts-batch-jobs'
import { requireTtsCredential } from '../../tts-utils/tts-credentials'
import { providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'
import { masterTtsDelivery } from '../../tts-utils/tts-delivery-mastering'
import { concatAndConvertToWav } from '../../tts-utils/audio-utils'
import { resolveTtsDeliverySeams } from '../../script-to-audio/tts-delivery-assembly'
import { exportTtsDeliveryAudio } from '../../tts-delivery-export'
import { assembleTtsBooks } from '../../tts-book-assembly'
import { collectTtsTargets, validateTtsTargetsForExecution } from '../../tts-targets'
import { toProjectRelativePath } from '~/utils/project-root'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

export const geminiBatchManifestItems = (run: GeminiProviderJobRun, metadata: Step4Metadata[][] = []): PipelineManifestItem[] => run.items.map((item, index) => {
  const slots = run.slots.filter(slot => slot.itemIndex === index)
  const completed = slots.filter(slot => slot.audioPath && !slot.error).length, failed = slots.filter(slot => slot.error).length
  return { input: item.input, status: completed === slots.length ? 'full' : failed === slots.length ? 'failed' : 'incomplete', providers: [], metadata: { geminiBatch: { schemaVersion: 1, totalSlots: slots.length, completedSlots: completed, failedSlots: failed }, tts: (metadata[index] ?? []) as unknown as never } }
})
export const geminiBatchManifest = (run: GeminiProviderJobRun): PipelineManifest => ({ ...createManifest('tts', run.items.length > 1 ? 'batch' : 'single', geminiBatchManifestItems(run), { geminiProviderJobs: GEMINI_JOB_FILE }), providerJobs: { schemaVersion: 1 as const, provider: 'gemini' as const, kind: 'tts-batch-jobs' as const, path: GEMINI_JOB_FILE } })
export const assembleGeminiBatchOutputs = async (root: string, run: GeminiProviderJobRun): Promise<void> => {
  const items: Array<{ index: number, inputPath: string, metadata: Step4Metadata[] }> = []
  for (const [itemIndex, item] of run.items.entries()) {
    const entries: Step4Metadata[] = []
    for (const model of [...new Set(run.slots.map(slot => slot.model))]) {
      const slots = run.slots.filter(s => s.itemIndex === itemIndex && s.model === model)
      if (!slots.length || slots.some(s => !s.audioPath || s.error) || !(await Promise.all(slots.map(slot => validateRetained(root, slot)))).every(Boolean)) continue
      const fileName = `${String(itemIndex + 1).padStart(3, '0')}-${item.stem}-${model}.wav`
      const workDir = join(root, 'gemini-mastering', `${itemIndex}-${model}`); await mkdir(workDir, { recursive: true })
      const masteredPath = run.delivery.ttsDelivery
        ? (await masterTtsDelivery({ segments: slots.map((s, index) => ({ id: s.key, path: join(root, s.audioPath!), boundaryAfter: index === slots.length - 1 ? 'end' : s.boundaryAfter ?? 'turn' })), profile: run.delivery.ttsDelivery, workDir, providerLabel: 'Gemini Batch' })).path
        : await concatAndConvertToWav(slots.map(s => join(root, s.audioPath!)), workDir, 'gemini-batch')
      await copyFile(masteredPath, join(root, fileName))
      entries.push({ ttsService: 'gemini', ttsModel: model, processingTime: 0, audioFileName: fileName, audioFileSize: Bun.file(join(root, fileName)).size, chunkCount: slots.length, transport: 'gemini-batch', geminiTtsUsage: slots.flatMap(s => s.usage ? [s.usage] : []), geminiTtsUsageComplete: slots.every(s => s.usage !== undefined) })
      run.outputs = run.outputs.filter(o => !(o.itemIndex === itemIndex && o.model === model)); run.outputs.push({ itemIndex, model, path: fileName })
      await persistGeminiJobs(root, run)
    }
    items.push({ index: itemIndex, inputPath: item.input, metadata: await exportTtsDeliveryAudio(root, entries, run.delivery.ttsExport) })
  }
  if (run.delivery.ttsExport?.book) await assembleTtsBooks({ batchDir: root, items, targets: collectTtsTargets({ geminiTtsModels: [...new Set(run.slots.map(s => s.model))] }), expectedItemCount: run.items.length, options: run.delivery.ttsExport })
  const manifest = await readManifest(root)
  if (manifest) await writeManifest(root, { ...manifest, updatedAt: new Date().toISOString(), items: geminiBatchManifestItems(run, items.map(item => item.metadata)) })
}
const report = (root: string, run: GeminiProviderJobRun) => ({ outputDir: toProjectRelativePath(root), providerJobs: run.jobs.map(job => ({ jobId: job.jobId, state: job.state, model: job.model })), completedSlots: run.slots.filter(s => s.audioPath && !s.error).length, totalSlots: run.slots.length, failedSlots: run.slots.filter(s => s.error).map(s => ({ key: s.key, error: s.error })), outputs: run.outputs, resumeCommand: `bun autoshow resume ${JSON.stringify(toProjectRelativePath(root))} --provider-job-action wait` })
const withLocalInterrupt = async (operation: (signal: AbortSignal) => Promise<void>): Promise<void> => {
  const controller = new AbortController(), interrupt = () => controller.abort(new Error('Local waiting interrupted; remote jobs remain active.'))
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt)
  try { await operation(controller.signal) } finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt) }
}
export const runGeminiRemoteBatch = async (input: string, options: TtsOptions, targets: TtsTarget[], maxCents?: number) => {
  const files = await getTtsInputKind(input) === 'directory' ? await collectTextInputFiles(input) : [input]
  if (!files.length) throw UsageError('Gemini remote batch has no text inputs.')
  const createdAt = new Date().toISOString()
  const run: GeminiProviderJobRun = { schemaVersion: 1, kind: 'gemini-tts-provider-jobs', createdAt, accountScopeHash: '', items: [], slots: [], jobs: [], delivery: { ttsDelivery: options.ttsDelivery, ttsExport: options.ttsExport }, outputs: [] }
  const estimates = []
  for (const [itemIndex, file] of files.entries()) {
    const prepared = await prepareTtsInput(file, options, createdAt)
    run.items.push({ input: prepared.manifestInputPath, stem: basename(file).replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]/g, '-') || 'speech' })
    for (const target of targets) {
      const plan = buildPureCurrentTtsRenderPlan({ target, sourceText: prepared.text, sourceIdentity: prepared.sourceIdentity, dialoguePlan: prepared.dialoguePlan, ttsOptions: options })
      const seams = resolveTtsDeliverySeams(plan.planned, target, options.ttsChunking)
      estimates.push({ provider: 'gemini', model: target.model, ...estimateGeminiTtsCost(target.model, prepared.ttsCharacterCount, 'batch', new Date(createdAt), plan.planned.slots.length) })
      for (const slot of plan.planned.slots) {
        const turns = plan.planned.turns.filter(t => slot.turnIds.includes(t.canonical.turnId))
        const request = serializeGeminiBatchSpeech(target.model, turns.map(t => ({ text: plan.planned.strategy === 'segmented' ? slot.providerText : t.canonical.canonicalText, speaker: t.canonical.originalSpeakerLabel, voice: t.voice.value!, style: t.effectiveControls['instructions'] as string | undefined })), turns[0]?.effectiveControls['responseFormat'] as string | undefined)
        const requestFingerprint = hashCanonicalTtsValue({ model: target.model, request }), key = hashCanonicalTtsValue({ itemIndex, generationSlotId: slot.generationSlotId, requestFingerprint })
        run.slots.push({ key, generationSlotId: slot.generationSlotId, itemIndex, model: target.model, request, requestFingerprint, boundaryAfter: seams.get(slot.generationSlotId) })
      }
    }
  }
  run.jobs = partitionGeminiJobs(run.slots)
  const estimatedCostCents = estimates.reduce((n, e) => n + e.totalCost, 0), authorizationBoundCents = run.slots.reduce((n, s) => n + estimateGeminiTtsCost(s.model, 1, 'batch').authorizationBoundCents, 0)
  if (options.price) return { data: { dryRun: true, estimate: { steps: estimates.map(({ totalCost, ...step }) => ({ step: 'tts', ...step, totalCostCents: totalCost })), totalEstimatedCostCents: estimatedCostCents }, authorizationBoundCents, remoteJobs: run.jobs.length, providerCalls: 0 }, message: 'Gemini remote Batch estimate' }
  if (maxCents !== undefined && authorizationBoundCents > maxCents) throw UsageError(`Gemini Batch conservative bound ${authorizationBoundCents.toFixed(3)} cents exceeds --max-cents ${maxCents}.`)
  const readiness = await validateTtsTargetsForExecution(targets)
  if (readiness.some(r => r.status !== 'ready')) throw UsageError('Gemini Batch readiness failed before submission.')
  const apiKey = requireTtsCredential('gemini'); run.accountScopeHash = providerAccountScopeHash('gemini', apiKey)
  const root = await createGenerationOutputDir(`${basename(input)}-gemini-batch`)
  try {
    await withProcessLock('gemini-provider-jobs', () => withLocalInterrupt(async signal => {
      if (await Bun.file(join(root, GEMINI_JOB_FILE)).exists()) throw UsageError(`Existing Gemini Batch run; use bun autoshow resume ${JSON.stringify(toProjectRelativePath(root))}.`)
      await persistGeminiJobs(root, run)
      await writeManifest(root, geminiBatchManifest(run))
      await submitGeminiJobs(root, run, apiKey, signal)
      if ((options.geminiTtsBatchWaitSeconds ?? 86400) > 0) await reconcileGeminiJobs(root, run, apiKey, 'wait', options.geminiTtsBatchWaitSeconds ?? 86400, signal)
      await assembleGeminiBatchOutputs(root, run)
    }), { lockRoot: join(root, '.locks') })
  } catch (error) { l.write('info', `Gemini remote jobs retained. Resume: bun autoshow resume ${JSON.stringify(toProjectRelativePath(root))}`, { category: 'pipeline' }); throw error }
  if (run.slots.some(slot => slot.error)) { l.write('warn', 'Gemini Batch retained partial results', { category: 'pipeline', metadata: report(root, run) }); throw UsageError('Gemini Batch has failed or missing slots; successful audio is retained and resume does not repurchase failures.') }
  return { data: report(root, run), message: run.jobs.some(j => j.state === 'pending') ? 'Gemini Batch submitted; remote jobs retained' : 'Gemini Batch collection complete' }
}
export const resumeGeminiRemoteBatch = async (root: string, flags: Record<string, unknown>, explicitFlags = new Set(Object.keys(flags))): Promise<Record<string, unknown> | undefined> => {
  const manifest = await readManifest(root)
  if (manifest?.providerJobs?.path !== GEMINI_JOB_FILE) {
    if (flags['provider-job-action'] !== undefined) throw UsageError('--provider-job-action requires a recorded Gemini TTS provider job.')
    return undefined
  }
  for (const key of explicitFlags) if ((key.startsWith('tts-') || ['provider', 'all-providers', 'all-local'].includes(key)) && flags[key] !== undefined && flags[key] !== false) throw UsageError(`Recorded Gemini Batch jobs reject --${key} overrides.`)
  const action = flags['provider-job-action'] ?? 'wait'
  if (!['status', 'wait', 'cancel'].includes(String(action))) throw UsageError('--provider-job-action must be status, wait, or cancel.')
  if (flags['price'] !== true && flags['gemini-job-lock-held'] !== true) return withProcessLock('gemini-provider-jobs', () => resumeGeminiRemoteBatch(root, { ...flags, 'gemini-job-lock-held': true }, explicitFlags), { lockRoot: join(root, '.locks') })
  const run = validateGeminiJobRun(await Bun.file(join(root, GEMINI_JOB_FILE)).json() as GeminiProviderJobRun)
  const additional = run.jobs.filter(job => !job.jobId && ['prepared', 'uploading', 'submitting'].includes(job.state)).flatMap(job => job.keys).map(key => run.slots.find(slot => slot.key === key)!)
  const possibleAdditionalCostCents = additional.reduce((sum, slot) => sum + estimateGeminiTtsCost(slot.model, 1, 'batch').authorizationBoundCents, 0)
  if (flags['price'] === true) return { ...report(root, run), dryRun: true, possibleAdditionalCostCents, providerCalls: 0 }
  const apiKey = requireTtsCredential('gemini')
  await withLocalInterrupt(async signal => {
    if (action === 'cancel') await recoverGeminiSubmissions(root, run, apiKey, false, signal)
    if (action === 'wait') {
      await recoverGeminiSubmissions(root, run, apiKey, flags['allow-ambiguous-redispatch'] === true, signal)
      // Retrieve known results before submitting any locally prepared remainder.
      await reconcileGeminiJobs(root, run, apiKey, 'status', 0, signal)
      await submitGeminiJobs(root, run, apiKey, signal)
    }
    await reconcileGeminiJobs(root, run, apiKey, action as 'status' | 'wait' | 'cancel', 86400, signal)
    if (action !== 'status') await assembleGeminiBatchOutputs(root, run)
  })
  const result = report(root, run)
  if (action === 'wait' && run.slots.some(slot => slot.error)) { l.report.result(result, 'Gemini Batch retained partial results'); throw UsageError('Gemini Batch collection remains incomplete; failed items are never silently resubmitted.') }
  return result
}
