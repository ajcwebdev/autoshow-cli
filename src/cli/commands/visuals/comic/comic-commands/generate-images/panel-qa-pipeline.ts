import { copyFileExact } from '~/utils/bun-file-io'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  GenerateWithQaRepairInput,
  GenerateWithQaRepairResult,
  PageQaEntry
} from '~/types'
import { advancePageQaRepairStagnation, createPageQaRepairStagnationState, isBlockingMaterialFailure, readReusablePageQaEntry } from './comic-page-qa'
import type { QaAttemptAction, QaAttemptTotals, QaRepairRefusal, QaRestartReason, QaStagnationStop } from './comic-repair-attempt-types'
import { evaluateGenerationAttempt, judgeQaImage, recordQaUsage, writeAttemptQaEvidence } from './comic-repair-evaluation'
import { resultWithTotals, throwQaRepairFailure } from './comic-repair-failure'
import { runGenerationAttempt } from './comic-repair-generation'
import { resolveQaRepairAction, resolveQaRepairDispatchReason, resolveRejectedQaRepair } from './comic-repair-transitions'

const preflightExistingOutput = async (
  input: GenerateWithQaRepairInput,
  totals: QaAttemptTotals
): Promise<{ qaEntry?: PageQaEntry | undefined, result?: GenerateWithQaRepairResult | undefined }> => {
  if (input.outputExists && !input.qaEnabled) return { result: resultWithTotals('skipped', undefined, totals) }
  let qaEntry = input.outputExists && !input.force ? await readReusablePageQaEntry(input.outputPath, input.judgeModel) : undefined
  if (input.outputExists && !input.force && !qaEntry && input.qaEnabled) {
    qaEntry = await judgeQaImage(input, input.outputPath)
    recordQaUsage(totals, qaEntry)
    qaEntry = { ...qaEntry, outputFile: input.outputPath.split('/').at(-1)! }
  }
  if (input.outputExists && !input.force && qaEntry && !qaEntry.hardFailure) return { qaEntry, result: resultWithTotals('skipped', qaEntry, totals) }
  return { qaEntry }
}

export const generateWithQaRepair = async (
  input: GenerateWithQaRepairInput
): Promise<GenerateWithQaRepairResult> => {
  const totals: QaAttemptTotals = { totalDurationMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, imagesGenerated: 0, imageInputUnits: 0, textInputUnits: 0, imageOutputUnits: 0, costEntries: [] }
  const preflight = await preflightExistingOutput(input, totals)
  if (preflight.result) return preflight.result
  let qaEntry = preflight.qaEntry
  const attemptsDirectory = join(dirname(input.outputPath), 'attempts', `${input.kind}-${String(input.itemNumber).padStart(2, '0')}`)
  await mkdir(attemptsDirectory, { recursive: true })
  if (input.force && input.canonicalExists) {
    await copyFileExact(input.outputPath, join(attemptsDirectory, 'prior-canonical.png'))
    await rm(input.outputPath)
  }
  let currentPath: string | undefined = input.outputExists ? input.outputPath : undefined
  if (input.outputExists && qaEntry?.hardFailure) {
    currentPath = join(attemptsDirectory, 'attempt-0.png')
    await copyFileExact(input.outputPath, currentPath)
  }
  let stagnationState = createPageQaRepairStagnationState()
  let action: QaAttemptAction = 'edit'
  let restartReason: QaRestartReason | undefined
  let stagnationStop: QaStagnationStop | undefined
  let skippedRepair: QaRepairRefusal | undefined
  let rejectedRepair: QaRepairRefusal | undefined
  const blockingHardKeys = input.blockingHardKeys ?? []
  if (input.qaEnabled && qaEntry?.hardFailure) {
    const decision = advancePageQaRepairStagnation(stagnationState, qaEntry, blockingHardKeys)
    stagnationState = decision.state
    const initialAction = resolveQaRepairAction(input.kind === 'panel' && input.maxRepairs > 0 && isBlockingMaterialFailure(qaEntry, blockingHardKeys), decision)
    action = initialAction.action
    restartReason = initialAction.restartReason
  }
  const firstAttempt = input.outputExists ? 1 : 0
  for (let attempt = firstAttempt; attempt <= input.maxRepairs; attempt++) {
    const dispatchReason = resolveQaRepairDispatchReason(input, attempt, qaEntry, action, restartReason)
    if (dispatchReason !== undefined && qaEntry) {
      qaEntry = { ...qaEntry, repairPolicy: { action: 'skip', repeatedHardFailures: [], reason: dispatchReason } }
      await writeAttemptQaEvidence(attemptsDirectory, attempt - 1, qaEntry)
      skippedRepair = { attempt, reason: dispatchReason }
      break
    }
    const baselinePath = currentPath
    const baselineQaEntry = qaEntry
    const attemptPath = await runGenerationAttempt({ request: input, attempt, attemptsDirectory, currentPath, action, qaEntry, totals })
    currentPath = attemptPath
    if (!input.qaEnabled) {
      await copyFileExact(attemptPath, input.outputPath)
      break
    }
    const skipComparison = attempt > 0 && action === 'restart' && restartReason === 'blocking-class'
    const evaluated = await evaluateGenerationAttempt({ request: input, attempt, attemptPath, baselinePath, baselineQaEntry, attemptsDirectory, stagnationState, totals, skipComparison })
    qaEntry = evaluated.qaEntry
    stagnationState = evaluated.decision.state
    const rejection = resolveRejectedQaRepair({ qaEntry, baselineQaEntry, baselinePath, decision: evaluated.decision, attempt, maxRepairs: input.maxRepairs })
    if (rejection) {
      qaEntry = rejection.qaEntry
      if (rejection.action === 'stop') {
        stagnationStop = { attempt, repeatedHardFailures: evaluated.decision.repeatedHardFailures, reason: evaluated.decision.reason }
        break
      }
      if (rejection.action === 'restart') {
        currentPath = baselinePath
        action = 'restart'
        restartReason = 'comparison-rejected'
        continue
      }
      rejectedRepair = { attempt, reason: rejection.reason }
      break
    }
    if (!qaEntry.hardFailure) {
      await copyFileExact(attemptPath, input.outputPath)
      break
    }
    if (!evaluated.blockingClassRestart && evaluated.decision.action === 'stop') {
      stagnationStop = { attempt, repeatedHardFailures: evaluated.decision.repeatedHardFailures, reason: evaluated.decision.reason }
      break
    }
    const nextAction = resolveQaRepairAction(evaluated.blockingClassRestart, evaluated.decision)
    action = nextAction.action
    restartReason = nextAction.restartReason
  }
  if (input.qaEnabled && (qaEntry?.hardFailure || skippedRepair || rejectedRepair)) {
    throwQaRepairFailure(input, qaEntry, totals, skippedRepair, rejectedRepair, stagnationStop)
  }
  return resultWithTotals('generated', qaEntry, totals)
}

export { failedQaRepairEvidenceFromError } from './comic-repair-failure'
