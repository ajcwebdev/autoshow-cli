import { join } from 'node:path'
import type {
  GenerateWithQaRepairInput,
  PageQaEntry,
  PageQaRepairDecision,
  PageQaRequest,
  RepairCandidateComparisonJudgment
} from '~/types'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { advancePageQaRepairStagnation, applyPageQaRepairPolicy, createPageQaRepairStagnationState, getPageQaHardFailureKeys, isBlockingMaterialFailure, resolveComicQaProvider } from './comic-page-qa'
import type { QaAttemptTotals } from './comic-repair-attempt-types'
import { buildComicRepairComparisonPrompt, decideComicRepairCandidate, parseComicRepairComparison, requestComicRepairComparison } from './comic-repair-comparison'

export const recordQaUsage = (totals: QaAttemptTotals, entry: PageQaEntry): void => {
  totals.totalInputTokens += entry.usage.inputTokens
  totals.totalOutputTokens += entry.usage.outputTokens
  totals.totalCostUsd += entry.usage.costUsd
}

export const writeAttemptQaEvidence = async (attemptsDirectory: string, attempt: number, entry: PageQaEntry): Promise<void> => {
  await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa.json`), `${JSON.stringify(entry, null, 2)}\n`)
}

export const judgeQaImage = async (
  input: GenerateWithQaRepairInput,
  pagePath: string
): Promise<PageQaEntry> => await runComicHostedRequest(
  input.options,
  resolveComicQaProvider(input.judgeModel),
  'comic-qa',
  `${input.sceneSlug}:${input.kind}-${input.itemNumber}:qa`,
  input.nextHostedIndex(),
  async () => await input.judge({
    pageNumber: input.itemNumber,
    pagePath,
    panelData: input.bundleData,
    identityCards: input.resolvedReferences.primaryCharacterRefs ?? [],
    locationSheets: input.resolvedReferences.secondaryRefs ?? [],
    designSheets: input.resolvedReferences.designReferences?.map(ref => ref.path),
    characterReferences: input.resolvedReferences.characterReferences,
    locationReferences: input.resolvedReferences.locationReferences,
    designReferences: input.resolvedReferences.designReferences as PageQaRequest['designReferences'],
    ...(input.kind === 'panel' && input.resolvedReferences.rosterCharacterReferences?.length ? { rosterCards: input.resolvedReferences.rosterCharacterReferences } : {}),
    ...(input.blockingHardKeys?.length ? { blockingHardKeys: input.blockingHardKeys } : {}),
    model: input.judgeModel,
  })
)

export const evaluateGenerationAttempt = async (input: {
  request: GenerateWithQaRepairInput
  attempt: number
  attemptPath: string
  baselinePath?: string | undefined
  baselineQaEntry?: PageQaEntry | undefined
  attemptsDirectory: string
  stagnationState: ReturnType<typeof createPageQaRepairStagnationState>
  totals: QaAttemptTotals
  skipComparison: boolean
}): Promise<{ qaEntry: PageQaEntry; decision: PageQaRepairDecision; blockingClassRestart: boolean }> => {
  let qaEntry: PageQaEntry
  try {
    qaEntry = await judgeQaImage(input.request, input.attemptPath)
    recordQaUsage(input.totals, qaEntry)
  } catch (error) {
    await Bun.write(join(input.attemptsDirectory, `attempt-${input.attempt}-qa-error.json`), `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    throw error
  }
  const blockingHardKeys = input.request.blockingHardKeys ?? []
  qaEntry = applyPageQaRepairPolicy({ ...qaEntry, outputFile: input.request.outputPath.split('/').at(-1)! }, input.attempt, blockingHardKeys)
  const baselineHardFailures = input.baselineQaEntry ? getPageQaHardFailureKeys(input.baselineQaEntry, blockingHardKeys) : []
  const candidateHardFailures = getPageQaHardFailureKeys(qaEntry, blockingHardKeys)
  const baselineHardFailureSet = new Set(baselineHardFailures)
  const candidateStrictlyDominates = baselineHardFailures.length > candidateHardFailures.length
    && candidateHardFailures.every(failure => baselineHardFailureSet.has(failure))
  if (!candidateStrictlyDominates && !input.skipComparison && input.attempt > 0 && input.request.kind === 'panel' && input.baselinePath && input.baselineQaEntry?.result.panels[0]?.repairAssessment) {
    const baselinePanel = input.baselineQaEntry.result.panels[0]
    const judgments: RepairCandidateComparisonJudgment[] = []
    const invalidPasses: Array<{ pass: 1 | 2; error: string }> = []
    for (const pass of [1, 2] as const) {
      const prompt = buildComicRepairComparisonPrompt({
        pass,
        targetedFinding: baselinePanel?.issues.join('; ') || input.baselineQaEntry.result.summary,
        targetedCorrection: baselinePanel?.editInstructions || 'Correct only the hard QA failure while preserving everything else.',
        preservationRequirements: baselinePanel?.repairAssessment?.preservationRequirements ?? [],
        panelData: input.request.bundleData,
        blockingOnlyCorrection: isBlockingMaterialFailure(input.baselineQaEntry, blockingHardKeys),
      })
      const imagePaths = pass === 1
        ? [input.baselinePath, input.attemptPath, ...input.request.referenceImages]
        : [input.attemptPath, input.baselinePath, ...input.request.referenceImages]
      let rawText: string | undefined
      let usage: { inputTokens: number; outputTokens: number; costUsd: number } | undefined
      try {
        const response = await runComicHostedRequest(
          input.request.options,
          resolveComicQaProvider(input.request.judgeModel),
          'comic-qa',
          `${input.request.sceneSlug}:panel-${input.request.itemNumber}:repair-${input.attempt}:compare-${pass}`,
          input.request.nextHostedIndex(),
          async () => await (input.request.requestRepairComparison ?? requestComicRepairComparison)({ pass, prompt, imagePaths, model: input.request.judgeModel })
        )
        rawText = response.text
        const costUsd = estimateLlmCostFromRegistry(input.request.judgeModel, response.inputTokens, response.outputTokens)
        usage = { inputTokens: response.inputTokens, outputTokens: response.outputTokens, costUsd }
        input.totals.totalInputTokens += response.inputTokens
        input.totals.totalOutputTokens += response.outputTokens
        input.totals.totalCostUsd += costUsd
        const normalized = parseComicRepairComparison(response.text, pass)
        judgments.push(normalized)
        await Bun.write(join(input.attemptsDirectory, `attempt-${input.attempt}-comparison-pass-${pass}.json`), `${JSON.stringify({ schemaVersion: 1, pass, raw: JSON.parse(response.text), normalized, usage }, null, 2)}\n`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        invalidPasses.push({ pass, error: message })
        await Bun.write(join(input.attemptsDirectory, `attempt-${input.attempt}-comparison-pass-${pass}-error.json`), `${JSON.stringify({ schemaVersion: 1, pass, error: message, ...(rawText !== undefined ? { rawText } : {}), ...(usage ? { usage } : {}) }, null, 2)}\n`)
      }
    }
    const outcome = decideComicRepairCandidate(judgments)
    qaEntry = { ...qaEntry, repairComparison: { ...outcome, judgments, invalidPasses } }
    if (outcome.decision !== 'clear-winner') qaEntry = { ...qaEntry, repairPolicy: { action: 'retain-original', repeatedHardFailures: [], reason: outcome.reason } }
  }
  const decision = advancePageQaRepairStagnation(input.stagnationState, qaEntry, blockingHardKeys)
  const blockingClassRestart = input.request.kind === 'panel'
    && qaEntry.hardFailure
    && !qaEntry.repairPolicy
    && decision.action !== 'stop'
    && input.attempt < input.request.maxRepairs
    && isBlockingMaterialFailure(qaEntry, blockingHardKeys)
  if (decision.action === 'stop') {
    qaEntry = { ...qaEntry, repairPolicy: { action: 'stop', reason: decision.reason ?? 'repeated-hard-failure', repeatedHardFailures: decision.repeatedHardFailures } }
  } else if (blockingClassRestart) {
    qaEntry = { ...qaEntry, repairPolicy: { action: 'restart', reason: 'blocking-class', repeatedHardFailures: getPageQaHardFailureKeys(qaEntry, blockingHardKeys) } }
  } else if (!qaEntry.repairPolicy && decision.action === 'restart') {
    qaEntry = { ...qaEntry, repairPolicy: { action: 'restart', reason: decision.reason ?? 'repeated-hard-failure', repeatedHardFailures: decision.repeatedHardFailures } }
  }
  await writeAttemptQaEvidence(input.attemptsDirectory, input.attempt, qaEntry)
  return { qaEntry, decision, blockingClassRestart }
}
