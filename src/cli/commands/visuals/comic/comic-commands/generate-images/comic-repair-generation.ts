import { join } from 'node:path'
import type {
  GenerateWithQaRepairInput,
  PageQaEntry
} from '~/types'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import type { QaAttemptAction, QaAttemptTotals } from './comic-repair-attempt-types'

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

export const runGenerationAttempt = async (input: {
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
