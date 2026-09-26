import type { AggregatedPriceEstimate, StandaloneTtsCommandOptions, TtsExecutionReadinessObservation, TtsTarget } from '~/types'
import { getPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { partialCompletionError } from '~/cli/commands/command-shared/provider-batch-state'
import { mergePriceEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { collectTextInputFiles } from '~/cli/commands/text/write/text-input-utils'
import { InfraError, UsageError, extractErrorHints, extractErrorMetadata, formatErrorMessage, isAppError } from '~/utils/error-handler'
import { isolateCommandResult, requireIsolatedResult } from '~/utils/app-logger/result-emitter'
import { isRecord } from '~/utils/value-helpers'
import * as l from '~/utils/app-logger/app-logger'
import { executeSingleTtsInput, planSingleTtsInput } from './tts-single-run'
import { executeTtsDirectoryBatch, ttsDirectoryBatchEstimate } from './tts-batch-run'
import { prepareTtsDirectoryBatch } from './tts-batch-preparation'
import { validateTtsTargetsForExecution } from './tts-targets'
import { assertGeminiBatchBound, executeGeminiRemoteBatch, geminiBatchBoundDetail, geminiBatchPriceData, planGeminiRemoteBatch, prepareGeminiBatchDispatch } from './tts-services/tts-gemini/gemini-tts-batch-workflow'
import type { GeminiRemoteBatchResult } from './tts-services/tts-gemini/gemini-tts-batch-workflow'

type OtherProvidersPlan = {
  targets: TtsTarget[]
  estimate: AggregatedPriceEstimate
  execute: (readiness: TtsExecutionReadinessObservation[]) => Promise<void>
}

type WorkflowResult = { data: Record<string, unknown>, message: string }

const formatCents = (value: number): string => `${value.toFixed(3)}¢`

// Planning validates inputs and prices targets; budgets, credentials and output directories come later.
const planOtherProviders = async (
  inputPath: string,
  inputKind: 'file' | 'directory',
  ttsOptions: StandaloneTtsCommandOptions,
  targets: TtsTarget[]
): Promise<OtherProvidersPlan> => {
  if (inputKind === 'file') {
    const plan = await planSingleTtsInput(inputPath, ttsOptions, targets)
    return { targets: plan.targets, estimate: plan.estimate, execute: readiness => executeSingleTtsInput(plan, ttsOptions, readiness) }
  }
  // The combined budget is checked below, so the directory plan is prepared without its own.
  const prepared = await prepareTtsDirectoryBatch(inputPath, await collectTextInputFiles(inputPath), ttsOptions, targets, undefined, new Date().toISOString())
  return { targets: prepared.targets, estimate: ttsDirectoryBatchEstimate(prepared.estimateReport), execute: readiness => executeTtsDirectoryBatch(inputPath, ttsOptions, prepared, readiness) }
}

// The Gemini bound must fit on its own (assertGeminiBatchBound); only the combined overage can be allowed.
const enforceCombinedBudget = (geminiBoundCents: number, otherCents: number, maxCents: number | undefined, allowOverBudget: boolean): void => {
  const totalCents = geminiBoundCents + otherCents
  if (maxCents === undefined || totalCents <= maxCents) return
  const message = `Gemini Batch bound ${formatCents(geminiBoundCents)} plus other providers' estimate ${formatCents(otherCents)} totals ${formatCents(totalCents)}, over --max-cents ${formatCents(maxCents)}`
  if (!allowOverBudget) throw UsageError(`${message}. Use --allow-over-budget to proceed.`)
  l.warn(`${message}; continuing because --allow-over-budget is set.`, {
    category: 'pricing',
    metadata: { geminiBatchBoundCents: geminiBoundCents, otherProvidersEstimatedCents: otherCents, estimatedCostCents: totalCents, budgetCents: maxCents, allowOverBudget: true }
  })
}

const failureSummary = (reason: unknown) => ({ kind: isAppError(reason) ? reason.kind : 'internal', message: formatErrorMessage(reason) })

// One workflow failing never discards the other's result: both land in the failure's metadata.
const mixedRunFailure = (batch: PromiseSettledResult<GeminiRemoteBatchResult>, other: PromiseSettledResult<WorkflowResult>): Error => {
  const retained = batch.status === 'rejected' ? extractErrorMetadata(batch.reason)['geminiBatch'] : undefined
  const pendingResume = batch.status === 'fulfilled'
    ? batch.value.data.providerJobs.some(job => job.state === 'pending') ? batch.value.data.resumeCommand : undefined
    : isRecord(retained) && typeof retained['resumeCommand'] === 'string' ? retained['resumeCommand'] : undefined
  const otherMetadata = other.status === 'rejected' ? extractErrorMetadata(other.reason) : {}
  const metadata = {
    geminiBatch: batch.status === 'fulfilled' ? batch.value.data : { ...(isRecord(retained) ? retained : {}), error: failureSummary(batch.reason) },
    otherProviders: other.status === 'fulfilled' ? other.value.data : { ...(typeof otherMetadata['outputDir'] === 'string' ? { outputDir: otherMetadata['outputDir'] } : {}), error: failureSummary(other.reason) }
  }
  const failed = [batch, other].flatMap(result => result.status === 'rejected' ? [result.reason as unknown] : [])
  const hints = [...(pendingResume ? [`Gemini remote jobs retained. Resume: ${pendingResume}`] : []), ...failed.flatMap(reason => extractErrorHints(reason))]
  const message = [
    'TTS run did not complete every workflow:',
    batch.status === 'fulfilled' ? `- Gemini Batch: ${batch.value.message}` : `- Gemini Batch failed: ${formatErrorMessage(batch.reason)}`,
    other.status === 'fulfilled' ? `- Other providers: ${other.value.message}` : `- Other providers failed: ${formatErrorMessage(other.reason)}`
  ].join('\n')
  const stage = 'tts:gemini-batch-mixed'
  return failed.length === 1
    ? partialCompletionError(message, { stage, metadata, hints })
    : InfraError(message, { stage, cause: failed[0], metadata, hints })
}

// Gemini Batch and the other providers are independent workflows with separate run directories.
// Both are planned, priced, budgeted and readiness-checked before either dispatches, then run
// concurrently so a long Batch wait or a Batch failure never holds back the other providers.
export const runGeminiBatchWithOtherProviders = async (
  inputPath: string,
  inputKind: 'file' | 'directory',
  ttsOptions: StandaloneTtsCommandOptions,
  geminiTargets: TtsTarget[],
  otherTargets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  if (getPinnedRunDir()) {
    throw UsageError('--output-dir cannot be used with Gemini Batch alongside other providers; use --output-root for the separate run directories.')
  }

  const gemini = await planGeminiRemoteBatch(inputPath, ttsOptions, geminiTargets)
  const other = await planOtherProviders(inputPath, inputKind, ttsOptions, otherTargets)
  const estimate = mergePriceEstimates([gemini.estimate, other.estimate])
  const extra = {
    data: { geminiBatch: geminiBatchPriceData(gemini), otherProviders: other.estimate.timing ? { timing: other.estimate.timing } : {} },
    detail: geminiBatchBoundDetail(gemini)
  }
  if (ttsOptions.price) {
    l.report.price(estimate, extra)
    return
  }

  assertGeminiBatchBound(gemini, maxCents)
  enforceCombinedBudget(gemini.authorizationBoundCents, other.estimate.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)
  l.report.estimate(estimate, extra)
  // A blocked target would fail after Gemini had already submitted paid remote jobs.
  const otherReadiness = await validateTtsTargetsForExecution(other.targets)
  const blocked = otherReadiness.filter(observation => observation.status !== 'ready')
  if (blocked.length) {
    throw UsageError(`Other TTS providers are not ready, so no Gemini Batch jobs were submitted: ${blocked.map(observation => `${observation.targetKey}: ${observation.error?.message ?? 'blocked'}`).join('; ')}`)
  }
  const apiKey = await prepareGeminiBatchDispatch(gemini)

  const [batch, direct] = await Promise.allSettled([
    executeGeminiRemoteBatch(gemini, ttsOptions, apiKey),
    isolateCommandResult(() => other.execute(otherReadiness)).then(requireIsolatedResult)
  ])
  if (batch.status === 'rejected' || direct.status === 'rejected') throw mixedRunFailure(batch, direct)
  l.report.result({ dryRun: false, geminiBatch: batch.value.data, otherProviders: direct.value.data }, `${direct.value.message}; ${batch.value.message}`)
}
