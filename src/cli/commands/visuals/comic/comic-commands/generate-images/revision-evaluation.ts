import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { GenerateImagesCommandOptions } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { decideRevisionPromotion } from './revision-comparison-policy'
import { REVISION_COMPARISON_MODEL, REVISION_COMPARISON_PASSES, REVISION_IMAGE_MODEL } from './revision-evaluation-config'
import type { RevisionEvaluationDependencies, RevisionEvaluationResult } from './revision-evaluation-types'
import { loadOrCreateLedger, sha256File } from './revision-evidence-files'
import { completeComparisonSlot, completeImageSlot, measureRevisionSimilarity, reconcileCompletedComparisonNormalization } from './revision-evidence-slots'
import { loadRevisionEvaluationPlan } from './revision-plan-validation'
import { publishRevisionResults } from './revision-publication'

export const runRevisionEvaluation = async (options: GenerateImagesCommandOptions, dependencies: RevisionEvaluationDependencies = {}): Promise<RevisionEvaluationResult> => {
  const loaded = await loadRevisionEvaluationPlan(options)
  await mkdir(loaded.evidenceDirectory, { recursive: true })
  await copyFile(loaded.planPath, join(loaded.evidenceDirectory, 'revision-plan.json'))
  const imageIndexByPanel = new Map(loaded.entries.map((entry, index) => [entry.panelNumber, index]))
  const results = await mapWithConcurrency(options.concurrency ?? DEFAULT_CLI_CONCURRENCY, loaded.entries, async entry => {
    const state = await loadOrCreateLedger(loaded, entry)
    await reconcileCompletedComparisonNormalization({ ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, now: dependencies.now ?? (() => new Date().toISOString()) })
    const originalEvidencePath = join(state.directory, 'original.png')
    if (!(await Bun.file(originalEvidencePath).exists())) await copyFile(entry.originalPath, originalEvidencePath)
    if (await sha256File(originalEvidencePath) !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} original evidence hash does not match the frozen plan.`, { stage: 'comic:revision-evaluation' })
    await completeImageSlot({ loaded, entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, options, dependencies, hostedIndex: imageIndexByPanel.get(entry.panelNumber)! })
    if (state.ledger.imageSlot?.status === 'completed') {
      const candidatePath = join(state.directory, 'candidate.png')
      if (!(await Bun.file(candidatePath).exists()) || await sha256File(candidatePath) !== state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} completed image slot has missing or drifted candidate evidence.`, { stage: 'comic:revision-evaluation' })
      if (!state.ledger.similarity) {
        state.ledger.similarity = await (dependencies.measureSimilarity ?? measureRevisionSimilarity)(originalEvidencePath, candidatePath)
        await atomicWriteJson(state.path, state.ledger)
      }
      await completeComparisonSlot({ entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, pass: 1, options, dependencies, hostedIndex: loaded.entries.length + imageIndexByPanel.get(entry.panelNumber)! * 2 })
      await completeComparisonSlot({ entry, ledger: state.ledger, ledgerPath: state.path, panelDirectory: state.directory, pass: 2, options, dependencies, hostedIndex: loaded.entries.length + imageIndexByPanel.get(entry.panelNumber)! * 2 + 1 })
    }
    const comparisons = state.ledger.comparisonSlots.flatMap(slot => slot.status === 'completed' && slot.normalized ? [slot.normalized] : [])
    const outcome = decideRevisionPromotion(entry.importance, comparisons)
    state.ledger.decision = outcome.decision; state.ledger.decisionReason = outcome.reason
    const canonical = await sha256File(entry.originalPath)
    if (outcome.decision === 'clear-winner') {
      if (!state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} clear winner is missing a candidate hash.`, { stage: 'comic:revision-promotion' })
      if (canonical !== entry.original.sha256 && canonical !== state.ledger.candidateSha256) throw ValidationError(`Panel ${entry.panelNumber} clear-winner canonical bytes match neither the frozen original nor candidate.`, { stage: 'comic:revision-promotion' })
      state.ledger.canonicalSha256After = canonical
      state.ledger.promoted = canonical === state.ledger.candidateSha256
    } else {
      if (canonical !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} non-winner canonical bytes changed.`, { stage: 'comic:revision-promotion' })
      state.ledger.canonicalSha256After = canonical
      state.ledger.promoted = false
    }
    await atomicWriteJson(state.path, state.ledger)
    return state.ledger
  })
  const stats = createImageRunStats()
  stats.imagesGenerated = results.filter(ledger => ledger.imageSlot?.status === 'completed').length
  stats.imagesSkipped = results.length - stats.imagesGenerated
  stats.totalCost = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.estimatedCostUsd ?? 0) + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.costUsd ?? 0), 0), 0)
  stats.totalInputTokens = results.reduce((sum, ledger) => sum + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.inputTokens ?? 0), 0), 0)
  stats.totalOutputTokens = results.reduce((sum, ledger) => sum + ledger.comparisonSlots.reduce((subtotal, slot) => subtotal + (slot.usage?.outputTokens ?? 0), 0), 0)
  stats.totalInputImageTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.imageInputUnits ?? 0), 0)
  stats.totalInputTextTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.textInputUnits ?? 0), 0)
  stats.totalOutputImageTokens = results.reduce((sum, ledger) => sum + (ledger.imageSlot?.usage?.outputUnits ?? 0), 0)
  const { promotedPanels, retainedOriginalPanels, completedComparisons } = await publishRevisionResults(options, dependencies, loaded, results, stats)
  const runLedger = { schemaVersion: 1, mode: 'revision-evaluation', experimentId: loaded.plan.experimentId, sceneSlug: loaded.plan.sceneSlug, planFingerprint: loaded.plan.planFingerprint, imageModel: REVISION_IMAGE_MODEL, comparisonModel: REVISION_COMPARISON_MODEL, comparisonPasses: REVISION_COMPARISON_PASSES, promotionPolicy: 'clear-winners', imageSlots: { total: results.length, completed: stats.imagesGenerated, ambiguous: results.filter(item => item.imageSlot?.status === 'ambiguous').length }, comparisonSlots: { totalPossible: stats.imagesGenerated * 2, completed: completedComparisons, failedOrMalformedOrAmbiguous: results.reduce((sum, item) => sum + item.comparisonSlots.filter(slot => slot.status !== 'completed').length, 0) }, promotedPanels, retainedOriginalPanels, usage: { inputTokens: stats.totalInputTokens, outputTokens: stats.totalOutputTokens, imageInputUnits: stats.totalInputImageTokens, estimatedAndRecordedCostUsd: stats.totalCost }, panels: results }
  await atomicWriteJson(join(loaded.evidenceDirectory, 'revision-evaluation.json'), runLedger)
  return { evidenceDirectory: loaded.evidenceDirectory, planFingerprint: loaded.plan.planFingerprint, ledgers: results, stats, promotedPanels }
}

export { REVISION_COMPARISON_MODEL, REVISION_COMPARISON_PASSES, REVISION_ESTIMATED_INPUT_TOKENS_PER_COMPARISON, REVISION_ESTIMATED_OUTPUT_TOKENS_PER_COMPARISON, REVISION_IMAGE_MODEL } from './revision-evaluation-config'

export type { LoadedRevisionPlan, RevisionBoundFile, RevisionComparisonNormalized, RevisionComparisonRaw, RevisionDefectCategory, RevisionEvaluationDependencies, RevisionEvaluationResult, RevisionImportance, RevisionPlan, RevisionPlanEntry, RevisionPriceInventory } from './revision-evaluation-types'

export { computeRevisionPlanFingerprint, loadRevisionEvaluationPlan, loadRevisionPriceInventory, parseRevisionPlan } from './revision-plan-validation'

export { buildRevisionComparisonPrompt, decideRevisionPromotion, normalizeRevisionComparison, parseRevisionComparison, REVISION_COMPARISON_SCHEMA } from './revision-comparison-policy'

export { measureRevisionSimilarity } from './revision-evidence-slots'
