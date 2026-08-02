import type { Dirent } from 'node:fs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ComicImageGenerationDependencies, ComicPanelSource, GenerateComicPagesOptions, ImageGenerationModel, ImagePromptVariation, ResolvedReferenceImages } from '~/types'
import {
createImageRunStats,
updateImageRunStatsWithCostFallback,
} from '../../comic-image-services/image-costs'
import {
createImage,
} from '../../comic-image-services/comic-image-targets'
import {
writeGeneratedImage,
} from '../../comic-image-services/image-writer'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { comicLog, err } from '../../comic-utils/comic-logger'
import {
applyReferenceImageLimits,
extractPanelBundleData,
findMissingReferenceImageFiles,
getPanelNumberFromName,
getPromptBundleFilename,
normalizePromptBundle,
resolvePrimaryCharacterReferencesAcrossPanels,
resolveLocationReferencesAcrossPanels,
resolveScenePanelDirectories,
} from '../../comic-utils/panel-prompt-utils'
import { getPagesDirectory, getPanelPromptsDirectory } from '../../comic-utils/project-paths'
import { getPageComicImagePath, loadPromptsConfig } from '../../comic-utils/scene-utils'
import { runWithConcurrency } from '../../comic-utils/run-with-concurrency'
import {
buildComicPagePrompt,
buildComicPagePromptData,
chunkComicPagePanels,
selectComicPanels,
} from './comic-page-utils'
import {
applyImagePromptVariation,
getImagePromptVariationLabel,
} from './prompt-variations'
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

type ComicPagePanelSource = ComicPanelSource & { normalizedPrompt: string }

const readComicPagePanelSource = async (
  sceneDirectory: string,
  panelEntry: Dirent
): Promise<ComicPagePanelSource> => {
  const panelNumber = getPanelNumberFromName(panelEntry.name)
  if (!panelNumber) {
    throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:pages' })
  }

  const panelDirectory = join(sceneDirectory, panelEntry.name)
  const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
  const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

  if (!promptContent.trim()) {
    throw ValidationError(`Prompt bundle "${promptFilename}" is empty`, { stage: 'comic:pages' })
  }

  const normalizedPrompt = normalizePromptBundle(promptContent)
  if (!normalizedPrompt) {
    throw ValidationError(`Prompt bundle "${promptFilename}" became empty after normalization`, { stage: 'comic:pages' })
  }

  return {
    panelDirectory,
    panelEntries,
    panelNumber,
    normalizedPrompt,
    bundleData: extractPanelBundleData(promptContent),
  }
}

const resolvePageReferences = async (
  panels: ComicPagePanelSource[],
  model: ImageGenerationModel,
): Promise<ResolvedReferenceImages> => {
  const primaryCharacterReferenceState = resolvePrimaryCharacterReferencesAcrossPanels(
    panels.map(panel => ({
      panelDirectory: panel.panelDirectory,
      entries: panel.panelEntries,
      bundleData: panel.bundleData,
    }))
  )

  if (primaryCharacterReferenceState.missingPrimaryCharacterRefs.length > 0) {
    throw InfraError(
      `Missing character reference images: ` +
      `${primaryCharacterReferenceState.missingPrimaryCharacterRefs.join(', ')}. ` +
      'Generate any missing character sketches, then rebuild stable panel prompt bundles.',
      { stage: 'comic:pages' }
    )
  }

  const locationReferences = resolveLocationReferencesAcrossPanels(panels.map(panel => ({ panelDirectory: panel.panelDirectory, entries: panel.panelEntries, bundleData: panel.bundleData })))
  const sceneAnchorRefs = locationReferences.map(reference => reference.path)
  const orderedReferences = [
    ...primaryCharacterReferenceState.primaryCharacterRefs,
    ...sceneAnchorRefs,
  ]

  const resolved = applyReferenceImageLimits(
    orderedReferences,
    orderedReferences,
    primaryCharacterReferenceState.sketchCharacterRefs,
    primaryCharacterReferenceState.canonicalCharacterRefs,
    [],
    sceneAnchorRefs,
    primaryCharacterReferenceState.missingPrimaryCharacterRefs,
    model,
  )
  return {
    ...resolved,
    primaryCharacterRefs: primaryCharacterReferenceState.primaryCharacterRefs,
    secondaryRefs: sceneAnchorRefs,
    ...(primaryCharacterReferenceState.characterReferences
      ? { characterReferences: primaryCharacterReferenceState.characterReferences }
      : {}),
    locationReferences: locationReferences.map((reference, index) => ({
      ...reference,
      referenceIndex: primaryCharacterReferenceState.primaryCharacterRefs.length + index + 1,
    })),
  }
}

export const generateComicPages = async (
  sceneSlug: string,
  options: GenerateComicPagesOptions,
  dependencies: ComicImageGenerationDependencies = {}
) => {
  const requestImage = dependencies.requestImage ?? (async input => {
    return createImage(
      input.normalizedPrompt,
      input.referenceImages,
      input.model,
      input.size,
      input.quality,
    )
  })
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judgePage = dependencies.judgePage ?? judgeComicPage
  const stats = createImageRunStats()
  let errorCount = 0
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  const qaEnabled = options.qa ?? options.pageQa ?? true
  const judgeModel = options.qaModel ?? options.pageQaModel ?? DEFAULT_PAGE_QA_MODEL
  const maxRepairs = options.maxRepairs ?? 2

  try {
    const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
    const sceneLabel = sceneSlug

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
      const panelSources = await Promise.all(
        panelDirectories.map(panelEntry => readComicPagePanelSource(sceneDirectory, panelEntry))
      )
      const selectedPanels = selectComicPanels(
        panelSources,
        options.panels,
        undefined,
        sceneLabel,
      )
      const pageChunks = chunkComicPagePanels(selectedPanels, options.panelsPerImage)
      const pagesDirectory = getPagesDirectory(sceneSlug)

      await mkdir(pagesDirectory, { recursive: true })
      comicLog.line('page inputs', [
        `scene=${sceneSlug}`,
        `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
        `groups=${pageChunks.length}`,
      ])

      // Every variation/model page is independent and shares only snapshotted references.
      const pageStreams = variations.flatMap(variation =>
        options.models.map(model => ({ variation, model }))
      )
      const qaEntriesByDirectory = new Map<string, PageQaEntry[]>()

      const resolvePageOutputPath = (
        variation: ImagePromptVariation,
        model: ImageGenerationModel,
        pageChunk: (typeof pageChunks)[number]
      ) => getPageComicImagePath(
        sceneSlug,
        pageChunk.pageNumber,
        pageChunk.panelNumbers,
        useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
        useVariationOutputPaths ? variation : undefined,
        options.runId
      )

      // A reference that only fails on page 2 still bills page 1, so validate every
      // page we intend to generate before issuing the first request. resolvePageReferences
      // throws on refs missing from the bundle; this also catches refs the bundle lists
      // but that are absent from disk.
      const pendingReferenceFailures = new Set<string>()
      for (const { variation, model } of pageStreams) {
        for (const pageChunk of pageChunks) {
          if (!options.force && await Bun.file(resolvePageOutputPath(variation, model, pageChunk)).exists()) {
            continue
          }

          const preflightReferences = await resolvePageReferences(pageChunk.panels, model)
          if (qaEnabled && maxRepairs > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, preflightReferences.all.length + 1, `QA edits for page ${pageChunk.pageNumber}`)
          const missingReferences = await findMissingReferenceImageFiles(preflightReferences.all)
          missingReferences.forEach(reference => pendingReferenceFailures.add(reference))
        }
      }

      if (pendingReferenceFailures.size > 0) {
        throw InfraError(
          `Missing reference image file(s): ${Array.from(pendingReferenceFailures).sort().join(', ')}. ` +
          'Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" to restage panel prompt bundles.',
          { stage: 'comic:pages' }
        )
      }

      // Pages use the full bounded-concurrency pool and never wait on a prior output.
      const pageTasks = pageStreams.flatMap(({ variation, model }) =>
        pageChunks.map(pageChunk => async () => {
          const outputPath = resolvePageOutputPath(variation, model, pageChunk)
          const canonicalExists = await Bun.file(outputPath).exists()
          const outputExists = !options.force && canonicalExists

          if (outputExists) {
            stats.imagesSkipped++
            comicLog.output('skipped', 'page', [
              `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
              `panels=${pageChunk.panelNumbers.join('-')}`,
              `model=${model}`,
              useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
              'refs=existing',
              `path=${outputPath}`,
            ])
          }

          try {
            const resolvedReferences = await resolvePageReferences(
              pageChunk.panels,
              model,
            )
            const pagePromptData = buildComicPagePromptData(pageChunk.panels.map(panel => panel.bundleData))
            const normalizedPrompt = buildComicPagePrompt(pagePromptData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [])
            const promptForVariation = prompts
              ? applyImagePromptVariation(normalizedPrompt, variation, prompts)
              : normalizedPrompt
            const referenceImages = resolvedReferences.all
            const missingReferences = await findMissingReferenceImageFiles(referenceImages)
            if (missingReferences.length > 0) {
              throw InfraError(
                `Reference image file(s) went missing after pre-flight: ${missingReferences.join(', ')}. ` +
                'The run directory was likely modified while the run was in progress.',
                { stage: 'comic:pages' }
              )
            }

            let entry = qaEnabled && outputExists && !options.force ? await readReusablePageQaEntry(outputPath, judgeModel) : undefined
            if (qaEnabled && outputExists && !options.force && !entry) {
              entry = await judgePage({ pageNumber: pageChunk.pageNumber, pagePath: outputPath, panelData: pagePromptData, identityCards: resolvedReferences.primaryCharacterRefs, locationSheets: resolvedReferences.secondaryRefs, characterReferences: resolvedReferences.characterReferences, model: judgeModel })
              stats.totalInputTokens += entry.usage.inputTokens
              stats.totalOutputTokens += entry.usage.outputTokens
              stats.totalCost += entry.usage.costUsd
            }
            if (!outputExists || options.force || (entry?.hardFailure ?? false)) {
              const attemptsDirectory = join(dirname(outputPath), 'attempts', `page-${String(pageChunk.pageNumber).padStart(2, '0')}`)
              await mkdir(attemptsDirectory, { recursive: true })
              if (options.force && canonicalExists) {
                await copyFile(outputPath, join(attemptsDirectory, 'prior-canonical.png'))
                await rm(outputPath)
              }
              let currentPath = outputExists ? outputPath : undefined
              if (outputExists && entry?.hardFailure) {
                currentPath = join(attemptsDirectory, 'attempt-0.png')
                await copyFile(outputPath, currentPath)
                await rm(outputPath)
              }
              const firstAttempt = outputExists ? 1 : 0
              let stagnationState = createPageQaRepairStagnationState()
              let nextRepairAction: 'edit' | 'restart' = 'edit'
              let stagnationStop: { attempt: number; repeatedHardFailures: string[] } | undefined
              if (qaEnabled && entry?.hardFailure) {
                const decision = advancePageQaRepairStagnation(stagnationState, entry)
                stagnationState = decision.state
                if (decision.action === 'restart') nextRepairAction = 'restart'
              }
              for (let attempt = firstAttempt; attempt <= maxRepairs; attempt++) {
                const attemptPath = join(attemptsDirectory, `attempt-${attempt}.png`)
                const restartFromCanonicalReferences = attempt > 0 && nextRepairAction === 'restart'
                const repairDetails = entry?.result.panels
                  .filter(panel => panel.issues.length > 0 || panel.editInstructions)
                  .map(panel => `Panel ${panel.panelNumber}: ${panel.editInstructions || panel.issues.join('; ')}`)
                  .join('\n') ?? ''
                const repairInstructions = attempt > 0 && entry && !restartFromCanonicalReferences
                  ? `Edit the first image only. Preserve everything already correct. Fix these hard failures:\n${entry.result.panels.filter(panel => panel.issues.length > 0 || panel.editInstructions).map(panel => `Panel ${panel.panelNumber}: ${panel.editInstructions || panel.issues.join('; ')}`).join('\n')}`
                  : ''
                const restartInstructions = restartFromCanonicalReferences
                  ? `Generate a completely new image from the canonical references and original contract. Do not preserve, imitate, or edit any prior failed image; the previous edit sequence stagnated. Correct these unresolved hard failures:\n${repairDetails}`
                  : ''
                const requestStart = Date.now()
                const attemptModel = attempt > 0 ? DEFAULT_IMAGE_MODEL : model
                const imageResponse = await requestImage({
                  normalizedPrompt: [promptForVariation, repairInstructions, restartInstructions].filter(Boolean).join('\n\n'),
                  referenceImages: attempt > 0 && currentPath && !restartFromCanonicalReferences ? [currentPath, ...referenceImages] : referenceImages,
                  model: attemptModel, size: options.size, quality: options.quality,
                })
                const requestDurationMs = Date.now() - requestStart
                stats.totalDurationMs += requestDurationMs
                await writeImage(attemptPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
                currentPath = attemptPath
                updateImageRunStatsWithCostFallback(attemptModel, stats, options.quality, options.size)
                stats.imagesGenerated++
                if (!qaEnabled) { await copyFile(attemptPath, outputPath); break }
                try {
                  entry = await judgePage({ pageNumber: pageChunk.pageNumber, pagePath: attemptPath, panelData: pagePromptData, identityCards: resolvedReferences.primaryCharacterRefs, locationSheets: resolvedReferences.secondaryRefs, characterReferences: resolvedReferences.characterReferences, model: judgeModel })
                  stats.totalInputTokens += entry.usage.inputTokens
                  stats.totalOutputTokens += entry.usage.outputTokens
                  stats.totalCost += entry.usage.costUsd
                } catch (error) {
                  await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa-error.json`), `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
                  throw error
                }
                entry = applyPageQaRepairPolicy({ ...entry, outputFile: outputPath.split('/').at(-1)! }, attempt)
                const decision = advancePageQaRepairStagnation(stagnationState, entry)
                stagnationState = decision.state
                if (decision.action === 'restart' || decision.action === 'stop') {
                  entry = { ...entry, repairPolicy: { action: decision.action, repeatedHardFailures: decision.repeatedHardFailures } }
                }
                await Bun.write(join(attemptsDirectory, `attempt-${attempt}-qa.json`), `${JSON.stringify(entry, null, 2)}\n`)
                if (!entry.hardFailure) { await copyFile(attemptPath, outputPath); break }
                if (decision.action === 'stop') {
                  stagnationStop = { attempt, repeatedHardFailures: decision.repeatedHardFailures }
                  break
                }
                nextRepairAction = decision.action === 'restart' ? 'restart' : 'edit'
              }
              if (qaEnabled && entry?.hardFailure) {
                const directory = dirname(outputPath)
                const entries = qaEntriesByDirectory.get(directory) ?? []
                entries.push(entry)
                qaEntriesByDirectory.set(directory, entries)
                const detail = stagnationStop
                  ? `stopped after repair ${stagnationStop.attempt} because ${stagnationStop.repeatedHardFailures.join(', ')} remained unresolved after a fresh canonical-reference restart`
                  : `failed QA after ${maxRepairs} repairs`
                throw ValidationError(`Page ${pageChunk.pageNumber} ${detail}; no canonical output was promoted.`, { stage: 'comic:page-qa' })
              }
              comicLog.output('generated', 'page', [`id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`, `panels=${pageChunk.panelNumbers.join('-')}`, `model=${model}`, `refs=${referenceImages.length}`, `path=${outputPath}`])
            }

            if (qaEnabled && entry) {
              const directory = dirname(outputPath)
              const entries = qaEntriesByDirectory.get(directory) ?? []
              entries.push(entry)
              qaEntriesByDirectory.set(directory, entries)
              comicLog.line(outputExists ? 'page QA reused' : 'page QA judged', [
                `page=${pageChunk.pageNumber}`, `model=${judgeModel}`, `hardFailure=${entry.hardFailure}`, `path=${outputPath}`,
              ])
            }
          } catch (error) {
            errorCount++
            err(
              `Failed to generate ${sceneLabel}/page-${String(pageChunk.pageNumber).padStart(2, '0')}:`,
              error instanceof Error ? error.message : String(error)
            )
          }
        })
      )

      await runWithConcurrency(options.concurrency, pageTasks)
      if (qaEnabled) {
        for (const [directory, entries] of qaEntriesByDirectory) await writePageQaReports(directory, entries)
        const hardFailures = Array.from(qaEntriesByDirectory.values()).flat().filter(entry => entry.hardFailure)
        if (hardFailures.length > 0) {
          throw ValidationError(`${hardFailures.length} comic page QA hard failure(s); generated artifacts and QA reports were preserved.`, { stage: 'comic:page-qa' })
        }
      }
    } catch (error) {
      err(`Failed to process scene ${sceneLabel}:`, error instanceof Error ? error.message : String(error))
      throw error
    }

  } catch (error) {
    err('Fatal error:', error instanceof Error ? error.message : String(error))
    throw error
  }

  if (errorCount > 0) {
    throw InfraError(`${errorCount} comic page generation task(s) failed`, { stage: 'comic:pages' })
  }

  return stats
}
