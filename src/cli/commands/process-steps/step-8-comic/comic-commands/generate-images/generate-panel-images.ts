import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { err, comicLog } from '../../comic-utils/comic-logger'
import { getPanelPromptsDirectory, getPanelsDirectory } from '../../comic-utils/project-paths'
import {
  createImage,
} from '../../comic-image-services/comic-image-targets'
import {
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
} from '../../comic-image-services/image-costs'
import {
  writeGeneratedImage,
} from '../../comic-image-services/image-writer'
import {
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages,
  resolveScenePanelDirectories,
} from '../../comic-utils/panel-prompt-utils'
import { buildComicPagePrompt, selectComicPanels } from './comic-page-utils'
import { getPanelComicImagePath, loadPromptsConfig } from '../../comic-utils/scene-utils'
import { runWithConcurrency } from '../../comic-utils/run-with-concurrency'
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { GeneratePanelImagesOptions, ImagePromptVariation } from '~/types'
import type { ComicImageGenerationDependencies } from '~/types'
import {
  advancePageQaRepairStagnation,
  applyPageQaRepairPolicy,
  createPageQaRepairStagnationState,
  DEFAULT_PAGE_QA_MODEL,
  judgeComicPage,
  readReusablePageQaEntry,
  writePageQaReports,
  type PageQaEntry,
} from './comic-page-qa'
import { DEFAULT_IMAGE_MODEL } from '../../comic-utils/image-size'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'


export const generatePanelImages = async (
  sceneSlug: string,
  options: GeneratePanelImagesOptions,
  dependencies: ComicImageGenerationDependencies = {},
) => {
  const stats = createImageRunStats()
  let errorCount = 0
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  const requestImage = dependencies.requestImage ?? (async input => await createImage(input.normalizedPrompt, input.referenceImages, input.model, input.size, input.quality))
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judge = dependencies.judgePage ?? judgeComicPage
  const qaEnabled = options.qa ?? true
  const judgeModel = options.qaModel ?? DEFAULT_PAGE_QA_MODEL
  const maxRepairs = options.maxRepairs ?? 2
  const qaEntriesByDirectory = new Map<string, PageQaEntry[]>()

  try {
    const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      let panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)

      if (options.panels !== undefined) {
        const panelSources = panelDirectories.map(entry => ({
          panelNumber: getPanelNumberFromName(entry.name)!,
          entry,
        }))
        const selected = selectComicPanels(
          panelSources,
          options.panels,
          undefined,
          sceneSlug,
        )
        panelDirectories = selected.map(s => s.entry)
      }

      for (const panelEntry of panelDirectories) {
        if (!getPanelNumberFromName(panelEntry.name)) {
          throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:generate-images' })
        }
      }

      // Resolve and validate every selected panel/model combination before the
      // first provider request so multi-model runs are all-or-nothing.
      const preflightFailures: string[] = []
      for (const panelEntry of panelDirectories) {
        const panelDirectory = join(sceneDirectory, panelEntry.name)
        try {
          const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
          const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
          const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
          for (const model of options.models) {
            const references = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
            if (qaEnabled && maxRepairs > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, references.all.length + 1, `QA edits for ${panelEntry.name}`)
            const missing = await Promise.all(references.all.map(async path => await Bun.file(path).exists() ? null : path))
            preflightFailures.push(...missing.filter((path): path is string => path !== null))
          }
        } catch (error) {
          preflightFailures.push(`${panelEntry.name}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      if (preflightFailures.length > 0) {
        throw ValidationError(`Image preflight failed before any provider calls:\n- ${Array.from(new Set(preflightFailures)).join('\n- ')}`, { stage: 'comic:generate-images' })
      }

      // Panels are independent, so generate them with bounded concurrency.
      const panelTasks = panelDirectories.map(panelEntry => async () => {
        const panelNumber = getPanelNumberFromName(panelEntry.name)!
        const panelDirectory = join(sceneDirectory, panelEntry.name)

        try {
          const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
          const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
          const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

          if (!promptContent.trim()) {
            throw ValidationError(`Prompt bundle "${promptFilename}" is empty`, { stage: 'comic:generate-images' })
          }

          const normalizedPrompt = normalizePromptBundle(promptContent)
          if (!normalizedPrompt) {
            throw ValidationError(`Prompt bundle "${promptFilename}" became empty after normalization`, { stage: 'comic:generate-images' })
          }

          const bundleData = extractPanelBundleData(promptContent)
          const primaryCharacterReferenceState = resolvePrimaryCharacterReferences(
            panelDirectory,
            panelEntries,
            bundleData,
          )
          if (primaryCharacterReferenceState.missingPrimaryCharacterRefs.length > 0) {
            throw InfraError(
              `Missing character reference images in ${panelEntry.name}: ` +
              `${primaryCharacterReferenceState.missingPrimaryCharacterRefs.join(', ')}. ` +
              `Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" ` +
              `after generating any missing character sketches.`,
              { stage: 'comic:generate-images' }
            )
          }

          await mkdir(getPanelsDirectory(sceneSlug), { recursive: true })

          for (const variation of variations) {
            for (const model of options.models) {
              const outputPath = getPanelComicImagePath(
                sceneSlug,
                panelNumber,
                useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
                useVariationOutputPaths ? variation : undefined,
                options.runId
              )
              const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
              const referenceImages = resolvedReferences.all
              const contractPrompt = buildComicPagePrompt(bundleData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [])
              const promptForVariation = prompts
                ? applyImagePromptVariation(contractPrompt, variation, prompts)
                : contractPrompt

              const canonicalExists = await Bun.file(outputPath).exists()
              const outputExists = !options.force && canonicalExists
              if (outputExists && !qaEnabled) {
                stats.imagesSkipped++
                comicLog.output('skipped', 'panel', [
                  `id=panel-${String(panelNumber).padStart(2, '0')}`,
                  `panel=${panelNumber}`,
                  `model=${model}`,
                  useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
                  `refs=${referenceImages.length}`,
                  `path=${outputPath}`,
                ])
                continue
              }

              let qaEntry = outputExists ? await readReusablePageQaEntry(outputPath, judgeModel) : undefined
              if (outputExists && !qaEntry) {
                qaEntry = await judge({ pageNumber: panelNumber, pagePath: outputPath, panelData: bundleData, identityCards: resolvedReferences.primaryCharacterRefs, locationSheets: resolvedReferences.secondaryRefs, model: judgeModel })
                stats.totalInputTokens += qaEntry.usage.inputTokens
                stats.totalOutputTokens += qaEntry.usage.outputTokens
                stats.totalCost += qaEntry.usage.costUsd
                qaEntry = { ...qaEntry, outputFile: outputPath.split('/').at(-1)! }
              }
              if (outputExists && qaEntry && !qaEntry.hardFailure) {
                stats.imagesSkipped++
                const entries = qaEntriesByDirectory.get(dirname(outputPath)) ?? []
                entries.push(qaEntry)
                qaEntriesByDirectory.set(dirname(outputPath), entries)
                continue
              }

              const attemptsDirectory = join(dirname(outputPath), 'attempts', `panel-${String(panelNumber).padStart(2, '0')}`)
              await mkdir(attemptsDirectory, { recursive: true })
              if (options.force && canonicalExists) {
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
                const repairDetails = qaEntry?.result.panels.map(panel => panel.editInstructions || panel.issues.join('; ')).filter(Boolean).join('\n') ?? ''
                const repair = attempt > 0 && qaEntry && !restartFromCanonicalReferences
                  ? `Edit the first image only. Preserve everything already correct. Original contract remains authoritative. Failed checks and actionable repairs:\n${qaEntry.result.panels.map(panel => panel.editInstructions || panel.issues.join('; ')).filter(Boolean).join('\n')}`
                  : ''
                const restart = restartFromCanonicalReferences
                  ? `Generate a completely new image from the canonical references and original contract. Do not preserve, imitate, or edit any prior failed image; the previous edit sequence stagnated. Correct these unresolved hard failures:\n${repairDetails}`
                  : ''
                const requestStart = Date.now()
                const attemptModel = attempt > 0 ? DEFAULT_IMAGE_MODEL : model
                const imageResponse = await requestImage({
                  normalizedPrompt: [promptForVariation, repair, restart].filter(Boolean).join('\n\n'),
                  referenceImages: attempt > 0 && currentPath && !restartFromCanonicalReferences ? [currentPath, ...referenceImages] : referenceImages,
                  model: attemptModel,
                  size: options.size,
                  quality: options.quality,
                })
                const requestDurationMs = Date.now() - requestStart
                stats.totalDurationMs += requestDurationMs
                await writeImage(attemptPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
                currentPath = attemptPath
                updateImageRunStatsWithCostFallback(attemptModel, stats, options.quality, options.size)
                stats.imagesGenerated++
                if (!qaEnabled) { await copyFile(attemptPath, outputPath); break }
                try {
                  qaEntry = await judge({ pageNumber: panelNumber, pagePath: attemptPath, panelData: bundleData, identityCards: resolvedReferences.primaryCharacterRefs, locationSheets: resolvedReferences.secondaryRefs, model: judgeModel })
                  stats.totalInputTokens += qaEntry.usage.inputTokens
                  stats.totalOutputTokens += qaEntry.usage.outputTokens
                  stats.totalCost += qaEntry.usage.costUsd
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
                if (!qaEntry.hardFailure) { await copyFile(attemptPath, outputPath); break }
                if (decision.action === 'stop') {
                  stagnationStop = { attempt, repeatedHardFailures: decision.repeatedHardFailures }
                  break
                }
                nextRepairAction = decision.action === 'restart' ? 'restart' : 'edit'
              }
              if (qaEnabled && qaEntry) {
                const entries = qaEntriesByDirectory.get(dirname(outputPath)) ?? []
                entries.push(qaEntry)
                qaEntriesByDirectory.set(dirname(outputPath), entries)
              }
              if (qaEnabled && qaEntry?.hardFailure) {
                const detail = stagnationStop
                  ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
                  : `failed QA after ${maxRepairs} repairs`
                throw ValidationError(`Panel ${panelNumber} ${detail}; no canonical output was promoted.`, { stage: 'comic:panel-qa' })
              }
              comicLog.output('generated', 'panel', [`id=panel-${String(panelNumber).padStart(2, '0')}`, `panel=${panelNumber}`, `model=${model}`, useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined, `refs=${referenceImages.length}`, `path=${outputPath}`])
            }
          }
        } catch (error) {
          errorCount++
          err(`Failed to generate ${sceneSlug}/${panelEntry.name}:`, error instanceof Error ? error.message : String(error))
        }
      })

      await runWithConcurrency(options.concurrency, panelTasks)
      if (qaEnabled) for (const [directory, entries] of qaEntriesByDirectory) await writePageQaReports(directory, entries)
    } catch (error) {
      err(`Failed to process scene ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
      throw error
    }

  } catch (error) {
    err('Fatal error:', error instanceof Error ? error.message : String(error))
    throw error
  }

  if (errorCount > 0) {
    throw InfraError(`${errorCount} image generation task(s) failed`, { stage: 'comic:generate-images' })
  }

  return stats
}
