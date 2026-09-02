import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  GenerateWithQaRepairInput,
  GenerateWithQaRepairResult,
  FailedQaRepairEvidence,
  PageQaEntry,
  PageQaRepairDecision,
  PageQaRequest,
  QaRepairCostEntry,
  RepairCandidateComparisonJudgment,
} from '~/types'
import { isAppError, ValidationError } from '~/utils/error-handler'
import { advancePageQaRepairStagnation, applyPageQaRepairPolicy, createPageQaRepairStagnationState, decidePageQaRepairDispatch, getPageQaHardFailureKeys, isBlockingMaterialFailure, readReusablePageQaEntry, resolveComicQaProvider } from './comic-page-qa'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { buildComicRepairComparisonPrompt, decideComicRepairCandidate, parseComicRepairComparison, requestComicRepairComparison } from './comic-repair-comparison'

type QaAttemptTotals = {
  totalDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  imagesGenerated: number
  imageInputUnits: number
  textInputUnits: number
  imageOutputUnits: number
  costEntries: QaRepairCostEntry[]
}

type QaAttemptAction = 'edit' | 'restart'

type QaRestartReason = 'blocking-class' | 'repeated-hard-failure' | 'comparison-rejected'

const resultWithTotals = (
  status: GenerateWithQaRepairResult['status'],
  qaEntry: PageQaEntry | undefined,
  totals: QaAttemptTotals
): GenerateWithQaRepairResult => ({ status, qaEntry, ...totals })

export const failedQaRepairEvidenceFromError = (error: unknown): FailedQaRepairEvidence | undefined => {
  if (!isAppError(error)) return undefined
  const evidence = error.metadata['qaRepairFailure']
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return undefined
  const record = evidence as Record<string, unknown>
  if (record['status'] !== 'failed' || typeof record['outputDirectory'] !== 'string') return undefined
  return evidence as FailedQaRepairEvidence
}

const recordQaUsage = (totals: QaAttemptTotals, entry: PageQaEntry): void => {
  totals.totalInputTokens += entry.usage.inputTokens
  totals.totalOutputTokens += entry.usage.outputTokens
  totals.totalCostUsd += entry.usage.costUsd
}

const writeAttemptQaEvidence = async (attemptsDirectory: string, attempt: number, entry: PageQaEntry): Promise<void> => {
  await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa.json`), `${JSON.stringify(entry, null, 2)}\n`)
}

const judgeQaImage = async (
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

const buildRepairPrompts = (
  input: GenerateWithQaRepairInput,
  qaEntry: PageQaEntry | undefined,
  attempt: number,
  action: QaAttemptAction
): { repair: string, restart: string } => {
  const restartFromCanonicalReferences = attempt > 0 && action === 'restart'
  const panelDetails = qaEntry?.result.panels.map(panel => {
    const correction = panel.editInstructions || panel.issues.join('; ')
    const preserve = panel.repairAssessment?.preservationRequirements.length
      ? `Preserve unchanged: ${panel.repairAssessment.preservationRequirements.join('; ')}`
      : ''
    return [correction, preserve].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n') ?? ''
  const pageDetails = qaEntry?.result.panels
    .filter(panel => panel.issues.length > 0 || panel.editInstructions)
    .map(panel => `Panel ${panel.panelNumber}: ${panel.editInstructions || panel.issues.join('; ')}`)
    .join('\n') ?? ''
  const repairDetails = input.kind === 'panel' ? panelDetails : pageDetails
  const repair = attempt > 0 && qaEntry && !restartFromCanonicalReferences
    ? input.kind === 'panel'
      ? `Edit the first image only. Preserve everything already correct. Original contract remains authoritative. Failed checks and actionable repairs:\n${panelDetails}`
      : `Edit the first image only. Preserve everything already correct. Fix these hard failures:\n${pageDetails}`
    : ''
  const blocking = input.bundleData.panels.length === 1 ? input.bundleData.blocking : undefined
  const blockingLedger = restartFromCanonicalReferences && blocking
    ? `\n\nThe reviewed blocking ledger is authoritative for this panel:\n- ${blocking.lines.camera}\n${blocking.lines.ledger.map(line => `- ${line}`).join('\n')}\n- ${blocking.lines.offFrame}\n- ${blocking.lines.wardrobe}\n- ${blocking.lines.extras}\n- ${blocking.lines.dressing}\n- ${blocking.lines.anchors}`
    : ''
  const restart = restartFromCanonicalReferences
    ? `Generate a completely new image from the canonical references and original contract. Do not preserve, imitate, or edit any prior failed image; the previous attempt did not produce an acceptable contract improvement. Correct these unresolved hard failures:\n${repairDetails}${blockingLedger}`
    : ''
  return { repair, restart }
}

const runGenerationAttempt = async (input: {
  request: GenerateWithQaRepairInput
  attempt: number
  attemptsDirectory: string
  currentPath?: string | undefined
  action: QaAttemptAction
  qaEntry?: PageQaEntry | undefined
  totals: QaAttemptTotals
}): Promise<string> => {
  const { request, attempt, attemptsDirectory, totals } = input
  const attemptPath = join(attemptsDirectory, `attempt-${attempt}.png`)
  const restartFromCanonicalReferences = attempt > 0 && input.action === 'restart'
  const prompts = buildRepairPrompts(request, input.qaEntry, attempt, input.action)
  const attemptModel = request.model
  const requestStart = Date.now()
  const imageResponse = await runComicHostedRequest(
    request.options,
    resolveComicImageProvider(attemptModel),
    'comic-image',
    `${request.sceneSlug}:${request.kind}-${request.itemNumber}:${request.model}`,
    request.nextHostedIndex(),
    async () => await request.requestImage({
      normalizedPrompt: [request.promptForVariation, prompts.repair, prompts.restart].filter(Boolean).join('\n\n'),
      referenceImages: attempt > 0 && input.currentPath && !restartFromCanonicalReferences ? [input.currentPath, ...request.referenceImages] : request.referenceImages,
      model: attemptModel,
      size: request.options.size,
      quality: request.options.quality,
    })
  )
  totals.totalDurationMs += Date.now() - requestStart
  totals.imageInputUnits += imageResponse.usage?.imageInputUnits ?? 0
  totals.textInputUnits += imageResponse.usage?.textInputUnits ?? 0
  totals.imageOutputUnits += imageResponse.usage?.outputUnits ?? 0
  await request.writeImage(attemptPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
  totals.costEntries.push({ model: attemptModel, quality: request.options.quality, size: request.options.size })
  totals.imagesGenerated += 1
  return attemptPath
}

const evaluateGenerationAttempt = async (input: {
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
    await copyFile(input.outputPath, join(attemptsDirectory, 'prior-canonical.png'))
    await rm(input.outputPath)
  }
  let currentPath: string | undefined = input.outputExists ? input.outputPath : undefined
  if (input.outputExists && qaEntry?.hardFailure) {
    currentPath = join(attemptsDirectory, 'attempt-0.png')
    await copyFile(input.outputPath, currentPath)
  }
  let stagnationState = createPageQaRepairStagnationState()
  let action: QaAttemptAction = 'edit'
  let restartReason: QaRestartReason | undefined
  let stagnationStop: { attempt: number, repeatedHardFailures: string[], reason: PageQaRepairDecision['reason'] } | undefined
  let skippedRepair: { attempt: number; reason: string } | undefined
  let rejectedRepair: { attempt: number; reason: string } | undefined
  const blockingHardKeys = input.blockingHardKeys ?? []
  if (input.qaEnabled && qaEntry?.hardFailure) {
    const decision = advancePageQaRepairStagnation(stagnationState, qaEntry, blockingHardKeys)
    stagnationState = decision.state
    if (input.kind === 'panel' && input.maxRepairs > 0 && isBlockingMaterialFailure(qaEntry, blockingHardKeys)) {
      action = 'restart'
      restartReason = 'blocking-class'
    } else if (decision.action === 'restart') {
      action = 'restart'
      restartReason = 'repeated-hard-failure'
    }
  }
  const firstAttempt = input.outputExists ? 1 : 0
  for (let attempt = firstAttempt; attempt <= input.maxRepairs; attempt++) {
    if (attempt > 0 && input.kind === 'panel' && qaEntry?.hardFailure && !(action === 'restart' && restartReason === 'blocking-class')) {
      const dispatch = decidePageQaRepairDispatch(qaEntry)
      if (dispatch.action === 'skip') {
        qaEntry = { ...qaEntry, repairPolicy: { action: 'skip', repeatedHardFailures: [], reason: dispatch.reason } }
        await writeAttemptQaEvidence(attemptsDirectory, attempt - 1, qaEntry)
        skippedRepair = { attempt, reason: dispatch.reason }
        break
      }
    }
    const baselinePath = currentPath
    const baselineQaEntry = qaEntry
    const attemptPath = await runGenerationAttempt({ request: input, attempt, attemptsDirectory, currentPath, action, qaEntry, totals })
    currentPath = attemptPath
    if (!input.qaEnabled) {
      await copyFile(attemptPath, input.outputPath)
      break
    }
    const skipComparison = attempt > 0 && action === 'restart' && restartReason === 'blocking-class'
    const evaluated = await evaluateGenerationAttempt({ request: input, attempt, attemptPath, baselinePath, baselineQaEntry, attemptsDirectory, stagnationState, totals, skipComparison })
    qaEntry = evaluated.qaEntry
    stagnationState = evaluated.decision.state
    if (qaEntry.repairComparison?.decision !== undefined && qaEntry.repairComparison.decision !== 'clear-winner') {
      const reason = qaEntry.repairComparison.reason
      const repairComparison = qaEntry.repairComparison
      if (evaluated.decision.action === 'stop') {
        stagnationStop = { attempt, repeatedHardFailures: evaluated.decision.repeatedHardFailures, reason: evaluated.decision.reason }
        if (baselineQaEntry) qaEntry = { ...baselineQaEntry, repairComparison, repairPolicy: { action: 'stop', reason: evaluated.decision.reason ?? 'repeated-hard-failure', repeatedHardFailures: evaluated.decision.repeatedHardFailures } }
        break
      }
      if (baselineQaEntry) qaEntry = { ...baselineQaEntry, repairComparison: qaEntry.repairComparison, repairPolicy: { action: 'retain-original', repeatedHardFailures: [], reason } }
      if (attempt < input.maxRepairs && baselinePath) {
        currentPath = baselinePath
        action = 'restart'
        restartReason = 'comparison-rejected'
        continue
      }
      rejectedRepair = { attempt, reason }
      break
    }
    if (!qaEntry.hardFailure) {
      await copyFile(attemptPath, input.outputPath)
      break
    }
    if (!evaluated.blockingClassRestart && evaluated.decision.action === 'stop') {
      stagnationStop = { attempt, repeatedHardFailures: evaluated.decision.repeatedHardFailures, reason: evaluated.decision.reason }
      break
    }
    if (evaluated.blockingClassRestart) {
      action = 'restart'
      restartReason = 'blocking-class'
    } else if (evaluated.decision.action === 'restart') {
      action = 'restart'
      restartReason = 'repeated-hard-failure'
    } else {
      action = 'edit'
      restartReason = undefined
    }
  }
  if (input.qaEnabled && (qaEntry?.hardFailure || skippedRepair || rejectedRepair)) {
    const detail = skippedRepair
      ? `kept the current image because repair ${skippedRepair.attempt} was blocked by the conservative worthiness gate: ${skippedRepair.reason}`
      : rejectedRepair
        ? `kept the original because repair ${rejectedRepair.attempt} was not a unanimous regression-free improvement: ${rejectedRepair.reason}`
        : stagnationStop?.reason === 'constraint-oscillation'
          ? `stopped after repair ${stagnationStop.attempt} because the hard-failure set oscillated without a strict-subset improvement (${stagnationStop.repeatedHardFailures.join(', ')})`
          : stagnationStop
      ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
      : `failed QA after ${input.maxRepairs} repairs`
    const failure: FailedQaRepairEvidence = {
      ...resultWithTotals('failed', qaEntry, totals),
      status: 'failed',
      outputDirectory: dirname(input.outputPath),
    }
    throw ValidationError(`${input.kind === 'panel' ? 'Panel' : 'Page'} ${input.itemNumber} ${detail}; no canonical output was promoted.`, {
      stage: input.kind === 'panel' ? 'comic:panel-qa' : 'comic:page-qa',
      metadata: { qaRepairFailure: failure },
    })
  }
  return resultWithTotals('generated', qaEntry, totals)
}
