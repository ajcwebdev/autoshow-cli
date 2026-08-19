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

export const generateWithQaRepair = async (
  input: GenerateWithQaRepairInput
): Promise<GenerateWithQaRepairResult> => {
  const {
    kind,
    itemNumber,
    outputPath,
    canonicalExists,
    outputExists,
    force,
    model,
    promptForVariation,
    referenceImages,
    bundleData,
    resolvedReferences,
    sceneSlug,
    options,
    requestImage,
    writeImage,
    judge,
    qaEnabled,
    judgeModel,
    maxRepairs,
    nextHostedIndex,
  } = input

  let totalDurationMs = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0
  let imagesGenerated = 0
  const costEntries: QaRepairCostEntry[] = []

  if (outputExists && !qaEnabled) {
    return {
      status: 'skipped',
      qaEntry: undefined,
      imagesGenerated: 0,
      totalDurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      costEntries: [],
    }
  }

  let qaEntry: PageQaEntry | undefined = (outputExists && !force)
    ? await readReusablePageQaEntry(outputPath, judgeModel)
    : undefined

  if (outputExists && !force && !qaEntry && qaEnabled) {
    qaEntry = await runComicHostedRequest(
      options,
      'openai',
      'comic-qa',
      `${sceneSlug}:${kind}-${itemNumber}:qa`,
      nextHostedIndex(),
      async () => await judge({
        pageNumber: itemNumber,
        pagePath: outputPath,
        panelData: bundleData,
        identityCards: resolvedReferences.primaryCharacterRefs ?? [],
        locationSheets: resolvedReferences.secondaryRefs ?? [],
        designSheets: resolvedReferences.designReferences?.map(ref => ref.path),
        characterReferences: resolvedReferences.characterReferences,
        locationReferences: resolvedReferences.locationReferences,
        designReferences: resolvedReferences.designReferences as PageQaRequest['designReferences'],
        model: judgeModel,
      })
    )
    totalInputTokens += qaEntry.usage.inputTokens
    totalOutputTokens += qaEntry.usage.outputTokens
    totalCostUsd += qaEntry.usage.costUsd
    qaEntry = { ...qaEntry, outputFile: outputPath.split('/').at(-1)! }
  }

  if (outputExists && !force && qaEntry && !qaEntry.hardFailure) {
    return {
      status: 'skipped',
      qaEntry,
      imagesGenerated: 0,
      totalDurationMs,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      costEntries,
    }
  }

  const attemptsDirectory = join(dirname(outputPath), 'attempts', `${kind}-${String(itemNumber).padStart(2, '0')}`)
  await mkdir(attemptsDirectory, { recursive: true })

  if (force && canonicalExists) {
    await copyFile(outputPath, join(attemptsDirectory, 'prior-canonical.png'))
    await rm(outputPath)
  }

  let currentPath: string | undefined = outputExists ? outputPath : undefined
  if (outputExists && qaEntry?.hardFailure) {
    currentPath = join(attemptsDirectory, 'attempt-0.png')
    await copyFile(outputPath, currentPath)
    await rm(outputPath)
  }

  const firstAttempt = outputExists ? 1 : 0
  let stagnationState = createPageQaRepairStagnationState()
  let nextRepairAction: 'edit' | 'restart' = 'edit'
  let stagnationStop: { attempt: number; repeatedHardFailures: string[] } | undefined

  if (qaEnabled && qaEntry?.hardFailure) {
    const decision = advancePageQaRepairStagnation(stagnationState, qaEntry)
    stagnationState = decision.state
    if (decision.action === 'restart') nextRepairAction = 'restart'
  }

  for (let attempt = firstAttempt; attempt <= maxRepairs; attempt++) {
    const attemptPath = join(attemptsDirectory, `attempt-${attempt}.png`)
    const restartFromCanonicalReferences = attempt > 0 && nextRepairAction === 'restart'

    let repairDetails = ''
    let repair = ''
    if (kind === 'panel') {
      repairDetails = qaEntry?.result.panels.map(panel => panel.editInstructions || panel.issues.join('; ')).filter(Boolean).join('\n') ?? ''
      repair = attempt > 0 && qaEntry && !restartFromCanonicalReferences
        ? `Edit the first image only. Preserve everything already correct. Original contract remains authoritative. Failed checks and actionable repairs:\n${qaEntry.result.panels.map(panel => panel.editInstructions || panel.issues.join('; ')).filter(Boolean).join('\n')}`
        : ''
    } else {
      repairDetails = qaEntry?.result.panels
        .filter(panel => panel.issues.length > 0 || panel.editInstructions)
        .map(panel => `Panel ${panel.panelNumber}: ${panel.editInstructions || panel.issues.join('; ')}`)
        .join('\n') ?? ''
      repair = attempt > 0 && qaEntry && !restartFromCanonicalReferences
        ? `Edit the first image only. Preserve everything already correct. Fix these hard failures:\n${qaEntry.result.panels.filter(panel => panel.issues.length > 0 || panel.editInstructions).map(panel => `Panel ${panel.panelNumber}: ${panel.editInstructions || panel.issues.join('; ')}`).join('\n')}`
        : ''
    }

    const restart = restartFromCanonicalReferences
      ? `Generate a completely new image from the canonical references and original contract. Do not preserve, imitate, or edit any prior failed image; the previous edit sequence stagnated. Correct these unresolved hard failures:\n${repairDetails}`
      : ''

    const requestStart = Date.now()
    const attemptModel = attempt > 0 ? DEFAULT_IMAGE_MODEL : model
    const imageResponse = await runComicHostedRequest(
      options,
      resolveComicImageProvider(attemptModel),
      'comic-image',
      `${sceneSlug}:${kind}-${itemNumber}:${model}`,
      nextHostedIndex(),
      async () => await requestImage({
        normalizedPrompt: [promptForVariation, repair, restart].filter(Boolean).join('\n\n'),
        referenceImages: attempt > 0 && currentPath && !restartFromCanonicalReferences ? [currentPath, ...referenceImages] : referenceImages,
        model: attemptModel,
        size: options.size,
        quality: options.quality,
      })
    )
    const requestDurationMs = Date.now() - requestStart
    totalDurationMs += requestDurationMs
    await writeImage(attemptPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
    currentPath = attemptPath
    costEntries.push({ model: attemptModel, quality: options.quality, size: options.size })
    imagesGenerated++

    if (!qaEnabled) {
      await copyFile(attemptPath, outputPath)
      break
    }

    try {
      qaEntry = await runComicHostedRequest(
        options,
        'openai',
        'comic-qa',
        `${sceneSlug}:${kind}-${itemNumber}:qa`,
        nextHostedIndex(),
        async () => await judge({
          pageNumber: itemNumber,
          pagePath: attemptPath,
          panelData: bundleData,
          identityCards: resolvedReferences.primaryCharacterRefs ?? [],
          locationSheets: resolvedReferences.secondaryRefs ?? [],
          designSheets: resolvedReferences.designReferences?.map(ref => ref.path),
          characterReferences: resolvedReferences.characterReferences,
          locationReferences: resolvedReferences.locationReferences,
          designReferences: resolvedReferences.designReferences as PageQaRequest['designReferences'],
          model: judgeModel,
        })
      )
      totalInputTokens += qaEntry.usage.inputTokens
      totalOutputTokens += qaEntry.usage.outputTokens
      totalCostUsd += qaEntry.usage.costUsd
    } catch (error) {
      await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa-error.json`), `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
      throw error
    }

    qaEntry = applyPageQaRepairPolicy({ ...qaEntry, outputFile: outputPath.split('/').at(-1)! }, attempt)
    const decision = advancePageQaRepairStagnation(stagnationState, qaEntry)
    stagnationState = decision.state
    if (decision.action === 'restart' || decision.action === 'stop') {
      qaEntry = { ...qaEntry, repairPolicy: { action: decision.action, repeatedHardFailures: decision.repeatedHardFailures } }
    }
    await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa.json`), `${JSON.stringify(qaEntry, null, 2)}\n`)
    if (!qaEntry.hardFailure) {
      await copyFile(attemptPath, outputPath)
      break
    }
    if (decision.action === 'stop') {
      stagnationStop = { attempt, repeatedHardFailures: decision.repeatedHardFailures }
      break
    }
    nextRepairAction = decision.action === 'restart' ? 'restart' : 'edit'
  }

  if (qaEnabled && qaEntry?.hardFailure) {
    const detail = stagnationStop
      ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
      : `failed QA after ${maxRepairs} repairs`
    throw ValidationError(`${kind === 'panel' ? 'Panel' : 'Page'} ${itemNumber} ${detail}; no canonical output was promoted.`, {
      stage: kind === 'panel' ? 'comic:panel-qa' : 'comic:page-qa',
    })
  }

  return {
    status: 'generated',
    qaEntry,
    imagesGenerated,
    totalDurationMs,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    costEntries,
  }
}
