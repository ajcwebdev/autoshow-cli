import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  GenerateWithQaRepairInput,
  GenerateWithQaRepairResult,
  PageQaEntry,
  PageQaRequest,
  QaRepairCostEntry,
} from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { advancePageQaRepairStagnation, applyPageQaRepairPolicy, createPageQaRepairStagnationState, readReusablePageQaEntry } from './comic-page-qa'
import { DEFAULT_IMAGE_MODEL } from '../../comic-utils/image-size'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'

type QaAttemptTotals = {
  totalDurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  imagesGenerated: number
  costEntries: QaRepairCostEntry[]
}

type QaAttemptAction = 'edit' | 'restart'

const resultWithTotals = (
  status: GenerateWithQaRepairResult['status'],
  qaEntry: PageQaEntry | undefined,
  totals: QaAttemptTotals
): GenerateWithQaRepairResult => ({ status, qaEntry, ...totals })

const recordQaUsage = (totals: QaAttemptTotals, entry: PageQaEntry): void => {
  totals.totalInputTokens += entry.usage.inputTokens
  totals.totalOutputTokens += entry.usage.outputTokens
  totals.totalCostUsd += entry.usage.costUsd
}

const judgeQaImage = async (
  input: GenerateWithQaRepairInput,
  pagePath: string
): Promise<PageQaEntry> => await runComicHostedRequest(
  input.options,
  'openai',
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
  const panelDetails = qaEntry?.result.panels.map(panel => panel.editInstructions || panel.issues.join('; ')).filter(Boolean).join('\n') ?? ''
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
  const restart = restartFromCanonicalReferences
    ? `Generate a completely new image from the canonical references and original contract. Do not preserve, imitate, or edit any prior failed image; the previous edit sequence stagnated. Correct these unresolved hard failures:\n${repairDetails}`
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
  const attemptModel = attempt > 0 ? DEFAULT_IMAGE_MODEL : request.model
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
  await request.writeImage(attemptPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
  totals.costEntries.push({ model: attemptModel, quality: request.options.quality, size: request.options.size })
  totals.imagesGenerated += 1
  return attemptPath
}

const evaluateGenerationAttempt = async (input: {
  request: GenerateWithQaRepairInput
  attempt: number
  attemptPath: string
  attemptsDirectory: string
  stagnationState: ReturnType<typeof createPageQaRepairStagnationState>
  totals: QaAttemptTotals
}) => {
  let qaEntry: PageQaEntry
  try {
    qaEntry = await judgeQaImage(input.request, input.attemptPath)
    recordQaUsage(input.totals, qaEntry)
  } catch (error) {
    await Bun.write(join(input.attemptsDirectory, `attempt-${input.attempt}-qa-error.json`), `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    throw error
  }
  qaEntry = applyPageQaRepairPolicy({ ...qaEntry, outputFile: input.request.outputPath.split('/').at(-1)! }, input.attempt)
  const decision = advancePageQaRepairStagnation(input.stagnationState, qaEntry)
  if (decision.action === 'restart' || decision.action === 'stop') qaEntry = { ...qaEntry, repairPolicy: { action: decision.action, repeatedHardFailures: decision.repeatedHardFailures } }
  await Bun.write(join(input.attemptsDirectory, `attempt-${input.attempt}-qa.json`), `${JSON.stringify(qaEntry, null, 2)}\n`)
  return { qaEntry, decision }
}

export const generateWithQaRepair = async (
  input: GenerateWithQaRepairInput
): Promise<GenerateWithQaRepairResult> => {
  const totals: QaAttemptTotals = { totalDurationMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, imagesGenerated: 0, costEntries: [] }
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
    await rm(input.outputPath)
  }
  let stagnationState = createPageQaRepairStagnationState()
  let action: QaAttemptAction = 'edit'
  let stagnationStop: { attempt: number, repeatedHardFailures: string[] } | undefined
  if (input.qaEnabled && qaEntry?.hardFailure) {
    const decision = advancePageQaRepairStagnation(stagnationState, qaEntry)
    stagnationState = decision.state
    if (decision.action === 'restart') action = 'restart'
  }
  const firstAttempt = input.outputExists ? 1 : 0
  for (let attempt = firstAttempt; attempt <= input.maxRepairs; attempt++) {
    const attemptPath = await runGenerationAttempt({ request: input, attempt, attemptsDirectory, currentPath, action, qaEntry, totals })
    currentPath = attemptPath
    if (!input.qaEnabled) {
      await copyFile(attemptPath, input.outputPath)
      break
    }
    const evaluated = await evaluateGenerationAttempt({ request: input, attempt, attemptPath, attemptsDirectory, stagnationState, totals })
    qaEntry = evaluated.qaEntry
    stagnationState = evaluated.decision.state
    if (!qaEntry.hardFailure) {
      await copyFile(attemptPath, input.outputPath)
      break
    }
    if (evaluated.decision.action === 'stop') {
      stagnationStop = { attempt, repeatedHardFailures: evaluated.decision.repeatedHardFailures }
      break
    }
    action = evaluated.decision.action === 'restart' ? 'restart' : 'edit'
  }
  if (input.qaEnabled && qaEntry?.hardFailure) {
    const detail = stagnationStop
      ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
      : `failed QA after ${input.maxRepairs} repairs`
    throw ValidationError(`${input.kind === 'panel' ? 'Panel' : 'Page'} ${input.itemNumber} ${detail}; no canonical output was promoted.`, { stage: input.kind === 'panel' ? 'comic:panel-qa' : 'comic:page-qa' })
  }
  return resultWithTotals('generated', qaEntry, totals)
}
