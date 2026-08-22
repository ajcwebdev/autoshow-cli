import type { DirectoryEntry } from '~/types'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { InfraError, InternalError, ValidationError } from '~/utils/error-handler'
import type { ComicImageGenerationDependencies, ComicPanelSource, PanelBundleData, GenerateSceneSketchesOptions, PromptsConfig, SketchPanelChunk } from '~/types'
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
import { PanelBundleDataSchema } from '../../schemas/schemas'
import { comicLog, err, formatDuration } from '../../comic-utils/comic-logger'
import {
extractPanelBundleData,
findMissingReferenceImageFiles,
formatPanelDirectoryName,
getPanelNumberFromName,
getPromptBundleFilename,
resolveGroupedReferenceImages,
resolveScenePanelDirectories,
} from '../../comic-utils/panel-prompt-utils'
import { getPanelPromptsDirectory, getSketchesDirectory } from '../../comic-utils/project-paths'
import {
getSketchComicImagePath,
loadPromptsConfig,
PANEL_FILENAME_PADDING,
} from '../../comic-utils/scene-utils'
import {
DEFAULT_SKETCH_PANELS_PER_IMAGE,
hasOnlyTrailingPanelSelectionMisses,
} from '../generate-images/comic-page-utils'
import { runWithConcurrency } from '~/utils/run-with-concurrency'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'

const SKETCH_CHUNK_SIZE = DEFAULT_SKETCH_PANELS_PER_IMAGE

const formatSketchChunkLabel = (startPanelNumber: number, endPanelNumber: number): string => {
  return `panels-${String(startPanelNumber).padStart(PANEL_FILENAME_PADDING, '0')}-${String(endPanelNumber).padStart(PANEL_FILENAME_PADDING, '0')}`
}

const chunkSketchPanels = <T extends { panelNumber: number }>(
  panels: T[],
  chunkSize = SKETCH_CHUNK_SIZE
): Array<SketchPanelChunk<T>> => {
  if (chunkSize < 1) {
    throw InternalError(`Chunk size must be at least 1, received ${chunkSize}`, { stage: 'comic:generate-sketches' })
  }

  const chunks: Array<SketchPanelChunk<T>> = []

  for (let index = 0; index < panels.length; index += chunkSize) {
    const chunkPanels = panels.slice(index, index + chunkSize)
    const firstPanel = chunkPanels[0]
    const lastPanel = chunkPanels.at(-1)
    if (!firstPanel || !lastPanel) {
      continue
    }

    chunks.push({
      startPanelNumber: firstPanel.panelNumber,
      endPanelNumber: lastPanel.panelNumber,
      panels: chunkPanels,
    })
  }

  return chunks
}

export const selectSketchPanelRange = <T extends { panelNumber: number }>(
  panels: T[],
  sketchPanels: NonNullable<GenerateSceneSketchesOptions['sketchPanels']>,
  sceneLabel: string
): SketchPanelChunk<T> => {
  if (panels.length === 0) {
    throw ValidationError(`No sketch panels were found in ${sceneLabel}.`, { stage: 'comic:generate-sketches' })
  }

  const sortedPanels = [...panels].sort((left, right) => left.panelNumber - right.panelNumber)
  const selectedPanels = sketchPanels === 'all'
    ? sortedPanels
    : sortedPanels.filter(panel => {
      return panel.panelNumber >= sketchPanels.startPanelNumber
        && panel.panelNumber <= sketchPanels.endPanelNumber
    })

  const firstPanel = selectedPanels[0]
  const lastPanel = selectedPanels.at(-1)
  if (!firstPanel || !lastPanel) {
    const rangeLabel = sketchPanels === 'all'
      ? 'all'
      : `${sketchPanels.startPanelNumber}-${sketchPanels.endPanelNumber}`
    throw ValidationError(`Sketch panel range "${rangeLabel}" was not found in ${sceneLabel}.`, { stage: 'comic:generate-sketches' })
  }

  if (sketchPanels !== 'all') {
    const availablePanels = new Set(sortedPanels.map(panel => panel.panelNumber))
    const requestedPanels: number[] = []
    for (
      let panelNumber = sketchPanels.startPanelNumber;
      panelNumber <= sketchPanels.endPanelNumber;
      panelNumber++
    ) {
      requestedPanels.push(panelNumber)
    }

    const missingPanels = requestedPanels.filter(panelNumber => !availablePanels.has(panelNumber))
    const selectedPanelNumbers = selectedPanels.map(panel => panel.panelNumber)
    if (missingPanels.length > 0 && !hasOnlyTrailingPanelSelectionMisses(
      requestedPanels,
      selectedPanelNumbers,
      missingPanels
    )) {
      throw ValidationError(
        `Sketch panel range "${sketchPanels.startPanelNumber}-${sketchPanels.endPanelNumber}" ` +
        `was not found in ${sceneLabel}.`,
        { stage: 'comic:generate-sketches' }
      )
    }
  }

  return {
    startPanelNumber: firstPanel.panelNumber,
    endPanelNumber: lastPanel.panelNumber,
    panels: selectedPanels,
  }
}

export const resolveSketchChunks = <T extends { panelNumber: number }>(
  panels: T[],
  options: Pick<GenerateSceneSketchesOptions, 'sketchPanels' | 'panelsPerImage'>,
  sceneLabel: string
): {
  allChunks: Array<SketchPanelChunk<T>>
  selectedChunks: Array<SketchPanelChunk<T>>
} => {
  const chunkSize = options.panelsPerImage ?? SKETCH_CHUNK_SIZE

  if (options.sketchPanels !== undefined) {
    const selectedChunk = selectSketchPanelRange(panels, options.sketchPanels, sceneLabel)
    const selectedChunks = chunkSketchPanels(selectedChunk.panels, chunkSize)
    return {
      allChunks: selectedChunks,
      selectedChunks,
    }
  }

  const sketchChunks = chunkSketchPanels(panels, chunkSize)

  return {
    allChunks: sketchChunks,
    selectedChunks: sketchChunks,
  }
}

const buildSketchPromptData = (
  bundleDataList: PanelBundleData[]
): PanelBundleData => {
  if (bundleDataList.length === 0) {
    throw InternalError(`Sketch chunks must contain at least 1 panel, found ${bundleDataList.length}`, { stage: 'comic:generate-sketches' })
  }

  const [firstBundle] = bundleDataList
  if (!firstBundle) {
    throw InternalError('Sketch chunks require at least one panel', { stage: 'comic:generate-sketches' })
  }

  const panels = bundleDataList.map(bundleData => {
    if (bundleData.title !== firstBundle.title) {
      throw ValidationError('Sketch chunk panels must share the same title', { stage: 'comic:generate-sketches' })
    }

    const panel = bundleData.panels[0]
    if (!panel) {
      throw ValidationError('Sketch prompt bundle is missing its panel payload', { stage: 'comic:generate-sketches' })
    }

    return panel
  })
  if (bundleDataList.some(bundle => bundle.snapshotId !== firstBundle.snapshotId)) {
    throw ValidationError('Sketch chunks cannot mix character reference snapshot IDs', { stage: 'comic:generate-sketches' })
  }
  return v.parse(PanelBundleDataSchema, {
    schemaVersion: 4,
    snapshotId: firstBundle.snapshotId,
    title: firstBundle.title,
    location: firstBundle.location,
    panels,
  })
}

export const buildSketchPrompt = (
  sketchPromptData: PanelBundleData,
  sketchPrompts: PromptsConfig['Sketch Prompts']
): string => {
  const locationKeys = Array.from(new Set(sketchPromptData.panels.map(panel => panel.locationKey).filter((key): key is string => Boolean(key))))
  const sections = [
    sketchPrompts.Prefix?.trim(),
    sketchPrompts.Chunk.trim(),
    [
      'Requirements:',
      '- Produce black-and-white rough sketch output only.',
      '- Use one sub-panel per source panel, in order.',
      '- Label each sub-panel only with its source panel number, as a small boxed numeral in the upper-left corner.',
      '- Do not add panel title cards, shot labels, descriptive headings, or caption banners such as "Wide opening shot..." or "Action panel...".',
      '- Keep visible text limited to story content explicitly present in the panel data, such as speech bubbles, signs, screens, and prop labels.',
      '- Preserve scenery and character staging for each panel.',
      `- Location reference mapping: ${sketchPromptData.panels.map(panel => `panel ${panel.number} -> ${panel.locationKey}`).join('; ')}. Location references follow all character references in this order: ${locationKeys.join(', ')}.`,
      '- Include the exact speech bubble text from each panel\'s speech entries.',
      '- Keep the result at review quality, not polished final art.',
    ].join('\n'),
    `Ordered scene data:\n\`\`\`json\n${JSON.stringify(sketchPromptData, null, 2)}\n\`\`\``,
  ]

  return sections.filter(section => section && section.length > 0).join('\n\n')
}

const getChunkCharacterKeys = (
  panels: Array<Pick<ComicPanelSource, 'bundleData'>>
): string[] => {
  const keys = new Set<string>()

  panels.forEach(panel => {
    panel.bundleData.panels.forEach(bundlePanel => {
      bundlePanel.characterKeys.forEach(key => keys.add(key))
    })
  })

  return Array.from(keys)
}

const readSketchPanelSource = async (
  sceneDirectory: string,
  panelEntry: DirectoryEntry
): Promise<ComicPanelSource> => {
  const panelNumber = getPanelNumberFromName(panelEntry.name)
  if (!panelNumber) {
    throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:generate-sketches' })
  }

  const panelDirectory = join(sceneDirectory, panelEntry.name)
  const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
  const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

  if (!promptContent.trim()) {
    throw ValidationError(`Prompt bundle "${promptFilename}" is empty`, { stage: 'comic:generate-sketches' })
  }

  return {
    panelDirectory,
    panelEntries,
    panelNumber,
    bundleData: extractPanelBundleData(promptContent),
  }
}

export const generateSceneSketches = async (
  sceneSlug: string,
  options: GenerateSceneSketchesOptions,
  dependencies: ComicImageGenerationDependencies = {}
) => {
  let hostedRequestIndex = 0
  const prompts = await loadPromptsConfig()
  const sketchPrompts = prompts['Sketch Prompts']
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

  const stats = createImageRunStats()
  let errorCount = 0
  const useModelSpecificFilenames = options.models.length > 1

  try {
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
      const sketchPanels = await Promise.all(panelDirectories.map(panelEntry => {
        return readSketchPanelSource(sceneDirectory, panelEntry)
      }))
      const { allChunks: sketchChunks, selectedChunks: selectedSketchChunks } = resolveSketchChunks(
        sketchPanels,
        options,
        sceneSlug,
      )

      const firstSelectedChunk = selectedSketchChunks[0]
      const lastSelectedChunk = selectedSketchChunks.at(-1)
      comicLog.line('sketch inputs', [
        `scene=${sceneSlug}`,
        `chunks=${selectedSketchChunks.length}/${sketchChunks.length}`,
        firstSelectedChunk && lastSelectedChunk
          ? `range=${formatSketchChunkLabel(firstSelectedChunk.startPanelNumber, lastSelectedChunk.endPanelNumber)}`
          : undefined,
      ])

      await mkdir(getSketchesDirectory(sceneSlug), { recursive: true })

      const preflightFailures: string[] = []
      for (const chunk of selectedSketchChunks) {
        for (const model of options.models) {
          try {
            const references = resolveGroupedReferenceImages(chunk.panels, model)
            const missing = await findMissingReferenceImageFiles(references.all)
            preflightFailures.push(...missing)
          } catch (error) {
            preflightFailures.push(`${formatSketchChunkLabel(chunk.startPanelNumber, chunk.endPanelNumber)}/${model}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
      if (preflightFailures.length > 0) {
        throw ValidationError(`Sketch preflight failed before any provider calls:\n- ${Array.from(new Set(preflightFailures)).join('\n- ')}`, { stage: 'comic:generate-sketches' })
      }

      const sketchStreams = options.models.map(model => async () => {
        const establishedCharacterSketches = new Map<string, string>()
        let previousSketchPath: string | undefined

        const recordEstablishedSketch = (characterKeys: string[], sketchPath: string) => {
          characterKeys.forEach(key => {
            if (!establishedCharacterSketches.has(key)) {
              establishedCharacterSketches.set(key, sketchPath)
            }
          })
        }

        for (const sketchChunk of selectedSketchChunks) {
          const chunkLabel = formatSketchChunkLabel(
            sketchChunk.startPanelNumber,
            sketchChunk.endPanelNumber,
          )

          try {
            const sketchPromptData = buildSketchPromptData(
              sketchChunk.panels.map(panel => panel.bundleData)
            )
            const normalizedPrompt = buildSketchPrompt(sketchPromptData, sketchPrompts)
            const chunkCharacterKeys = getChunkCharacterKeys(sketchChunk.panels)

            const priorSketchCandidates = [
              ...chunkCharacterKeys
                .map(key => establishedCharacterSketches.get(key))
                .filter((path): path is string => path !== undefined),
              ...(previousSketchPath ? [previousSketchPath] : []),
            ]
            const priorSketchPaths: string[] = []
            for (const candidate of priorSketchCandidates) {
              if (priorSketchPaths.includes(candidate)) {
                continue
              }
              if (await Bun.file(candidate).exists()) {
                priorSketchPaths.push(candidate)
              }
            }

            const resolvedReferences = resolveGroupedReferenceImages(
              sketchChunk.panels,
              model,
              priorSketchPaths,
            )

            if (resolvedReferences.missingPrimaryCharacterRefs.length > 0) {
              throw InfraError(
                `Missing character reference images in ${chunkLabel}: ` +
                `${resolvedReferences.missingPrimaryCharacterRefs.join(', ')}. ` +
                `Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" ` +
                `after generating any missing character sketches.`,
                { stage: 'comic:generate-sketches' }
              )
            }

            const outputPath = getSketchComicImagePath(
              sceneSlug,
              sketchChunk.startPanelNumber,
              sketchChunk.endPanelNumber,
              useModelSpecificFilenames ? model : undefined,
              options.runId
            )

            if (!options.force && await Bun.file(outputPath).exists()) {
              stats.imagesSkipped++
              recordEstablishedSketch(chunkCharacterKeys, outputPath)
              previousSketchPath = outputPath
              comicLog.output('skipped', 'sketch', [
                `id=${chunkLabel}`,
                `panels=${sketchChunk.startPanelNumber}-${sketchChunk.endPanelNumber}`,
                `model=${model}`,
                `refs=${resolvedReferences.all.length}`,
                `path=${outputPath}`,
              ])
              continue
            }

            const missingReferences = await findMissingReferenceImageFiles(resolvedReferences.all)
            if (missingReferences.length > 0) {
              throw InfraError(
                `Missing reference image file(s) for ${chunkLabel}: ${missingReferences.join(', ')}. ` +
                'Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" to restage panel prompt bundles.',
                { stage: 'comic:generate-sketches' }
              )
            }

            const requestStart = Date.now()
            const imageResponse = await runComicHostedRequest(options, resolveComicImageProvider(model), 'comic-image', `${sceneSlug}:sketch:${model}`, hostedRequestIndex++, async () => await requestImage({
              normalizedPrompt,
              referenceImages: resolvedReferences.all,
              model,
              size: options.size,
              quality: options.quality,
            }))
            const requestDurationMs = Date.now() - requestStart
            stats.totalDurationMs += requestDurationMs

            await writeImage(
              outputPath,
              imageResponse.result.imageBase64,
              imageResponse.result.mimeType,
            )
            recordEstablishedSketch(chunkCharacterKeys, outputPath)
            previousSketchPath = outputPath

            const { costLabel } = updateImageRunStatsWithCostFallback(
              model,
              stats,
              options.quality,
              options.size,
            )

            comicLog.output('generated', 'sketch', [
              `id=${chunkLabel}`,
              `panels=${sketchChunk.panels.map(panel => formatPanelDirectoryName(panel.panelNumber)).join(',')}`,
              `model=${model}`,
              `mode=${imageResponse.mode}`,
              `refs=${resolvedReferences.all.length}`,
              `cost=${costLabel}`,
              `duration=${formatDuration(requestDurationMs)}`,
              `path=${outputPath}`,
            ])

            stats.imagesGenerated++
          } catch (error) {
            errorCount++
            err(`Failed to generate ${sceneSlug}/${chunkLabel}:`, error instanceof Error ? error.message : String(error))
          }
        }
      })

      await runWithConcurrency(options.concurrency, sketchStreams)
    } catch (error) {
      err(`Failed to process scene ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
      throw error
    }

  } catch (error) {
    err('Fatal error:', error instanceof Error ? error.message : String(error))
    throw error
  }

  if (errorCount > 0) {
    throw InfraError(`${errorCount} sketch generation task(s) failed`, { stage: 'comic:generate-sketches' })
  }

  return stats
}
