import * as v from 'valibot'
import { CLIUsageError, InternalError, ValidationError } from '~/utils/error-handler'
import type { ComicGridChunk, ComicGridSpec, ComicPageChunk, ComicPanelSelection, PanelBundleData, GenerateImagesTarget, ImageGenerationSize, SketchPanelRange } from '~/types'
import { PanelBundleDataSchema } from '../../schemas/schemas'

const PANEL_SELECTOR_PART_PATTERN = /^(\d+)(?:-(\d+))?$/
const GRID_SPEC_PATTERN = /^([1-9]\d*)x([1-9]\d*)$/i

export const DEFAULT_FINAL_PANELS_PER_IMAGE = 1
export const DEFAULT_SKETCH_PANELS_PER_IMAGE = 6
// Kept as the public sketch/default chunk constant for compatibility with callers
// that explicitly pass a shared override.
export const DEFAULT_PANELS_PER_IMAGE = DEFAULT_SKETCH_PANELS_PER_IMAGE
export const COMIC_GRID_PANEL_SIZE: ImageGenerationSize = '1536x1024'

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 1) {
    throw InternalError(`${label} must be a positive integer`, { stage: 'comic:page-utils' })
  }
}

export const parseComicGridSpec = (value: string): ComicGridSpec => {
  const trimmed = value.trim()
  const match = trimmed.match(GRID_SPEC_PATTERN)
  const columns = match?.[1] ? Number(match[1]) : 0
  const rows = match?.[2] ? Number(match[2]) : 0

  if (
    !match
    || !Number.isSafeInteger(columns)
    || !Number.isSafeInteger(rows)
  ) {
    throw CLIUsageError(`Invalid grid "${value}". Expected positive columns x rows like 2x3`)
  }

  return { columns, rows }
}

export const validateComicGridOptions = (
  grid: ComicGridSpec | undefined,
  options: {
    target: GenerateImagesTarget
    size: ImageGenerationSize
    panelsPerImage: number
  }
): void => {
  if (!grid) {
    return
  }

  if (options.target !== 'images' && options.target !== 'both') {
    throw CLIUsageError('--grid only applies when --target is images or both')
  }

  if (options.size !== COMIC_GRID_PANEL_SIZE) {
    throw CLIUsageError(`--grid requires --size ${COMIC_GRID_PANEL_SIZE}`)
  }

  if (options.panelsPerImage !== 1) {
    throw CLIUsageError('--grid requires --panels-per-image 1')
  }
}

export const parsePanelSelector = (value: string): ComicPanelSelection => {
  const trimmed = value.trim()
  if (trimmed === 'all') {
    return 'all'
  }

  if (!trimmed || trimmed.includes(' ')) {
    throw CLIUsageError(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
  }

  const selectedPanels = new Set<number>()
  for (const rawPart of trimmed.split(',')) {
    if (!rawPart) {
      throw CLIUsageError(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
    }

    const match = rawPart.match(PANEL_SELECTOR_PART_PATTERN)
    const startPanel = match?.[1] ? Number(match[1]) : 0
    const endPanel = match?.[2] ? Number(match[2]) : startPanel

    if (!match || startPanel < 1 || endPanel < 1 || startPanel > endPanel) {
      throw CLIUsageError(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
    }

    for (let panelNumber = startPanel; panelNumber <= endPanel; panelNumber++) {
      selectedPanels.add(panelNumber)
    }
  }

  return Array.from(selectedPanels).sort((left, right) => left - right)
}

const isContiguousPanelSelection = (panelNumbers: number[]): boolean => {
  return panelNumbers.every((panelNumber, index) => {
    return index === 0 || panelNumber === panelNumbers[index - 1]! + 1
  })
}

export const hasOnlyTrailingPanelSelectionMisses = (
  requestedPanelNumbers: number[],
  selectedPanelNumbers: number[],
  missingPanelNumbers: number[]
): boolean => {
  const requestedStartPanel = requestedPanelNumbers[0]
  const firstSelectedPanel = selectedPanelNumbers[0]
  const lastSelectedPanel = selectedPanelNumbers.at(-1)

  return isContiguousPanelSelection(requestedPanelNumbers)
    && requestedStartPanel !== undefined
    && firstSelectedPanel === requestedStartPanel
    && lastSelectedPanel !== undefined
    && missingPanelNumbers.every(panelNumber => panelNumber > lastSelectedPanel)
}

export const panelSelectionToSketchRange = (
  panels: ComicPanelSelection | undefined
): SketchPanelRange | undefined => {
  if (panels === undefined || panels === 'all') {
    return undefined
  }

  const sorted = Array.from(new Set(panels)).sort((a, b) => a - b)
  if (!isContiguousPanelSelection(sorted)) {
    throw InternalError(
      'Sketch panel selection must be contiguous when generating sketches. ' +
      'Use a range like 1-4 or pass --target images for non-contiguous final panel selections.',
      { stage: 'comic:page-utils' }
    )
  }

  return { startPanelNumber: sorted[0]!, endPanelNumber: sorted.at(-1)! }
}

const applyPanelLimit = <T>(
  panels: T[],
  panelLimit: number | undefined
): T[] => {
  if (panelLimit === undefined) {
    return panels
  }

  assertPositiveInteger(panelLimit, 'Panel limit')
  return panels.slice(0, panelLimit)
}

export const selectComicPanels = <T extends { panelNumber: number }>(
  panels: T[],
  selection: ComicPanelSelection,
  panelLimit: number | undefined,
  sceneLabel: string
): T[] => {
  const sortedPanels = [...panels].sort((left, right) => left.panelNumber - right.panelNumber)
  const requestedPanelNumbers = selection === 'all'
    ? undefined
    : Array.from(new Set(selection)).sort((left, right) => left - right)
  const requestedPanelNumberSet = requestedPanelNumbers
    ? new Set(requestedPanelNumbers)
    : undefined
  const selectedPanels = selection === 'all'
    ? sortedPanels
    : sortedPanels.filter(panel => requestedPanelNumberSet?.has(panel.panelNumber))

  if (requestedPanelNumbers) {
    const availablePanels = new Set(sortedPanels.map(panel => panel.panelNumber))
    const missingPanels = requestedPanelNumbers.filter(panelNumber => !availablePanels.has(panelNumber))
    const selectedPanelNumbers = selectedPanels.map(panel => panel.panelNumber)
    if (missingPanels.length > 0 && !hasOnlyTrailingPanelSelectionMisses(
      requestedPanelNumbers,
      selectedPanelNumbers,
      missingPanels
    )) {
      const missingPanelLabel = `Selected panel${missingPanels.length === 1 ? '' : 's'} ${missingPanels.join(', ')}`
      const missingPanelVerb = missingPanels.length === 1 ? 'was' : 'were'
      throw ValidationError(
        `${missingPanelLabel} ${missingPanelVerb} not found in ${sceneLabel}.`,
        { stage: 'comic:page-utils' }
      )
    }
  }

  const limitedPanels = applyPanelLimit(selectedPanels, panelLimit)
  if (limitedPanels.length === 0) {
    throw ValidationError(`No selected panels were found in ${sceneLabel}.`, { stage: 'comic:page-utils' })
  }

  return limitedPanels
}

export const chunkComicPagePanels = <T extends { panelNumber: number }>(
  panels: T[],
  panelsPerImage: number
): Array<ComicPageChunk<T>> => {
  assertPositiveInteger(panelsPerImage, 'Panels per image')

  const chunks: Array<ComicPageChunk<T>> = []
  for (let index = 0; index < panels.length; index += panelsPerImage) {
    const chunkPanels = panels.slice(index, index + panelsPerImage)
    if (chunkPanels.length === 0) {
      continue
    }

    chunks.push({
      pageNumber: chunks.length + 1,
      panelNumbers: chunkPanels.map(panel => panel.panelNumber),
      panels: chunkPanels,
    })
  }

  return chunks
}

export const getComicGridCapacity = (grid: ComicGridSpec): number => {
  assertPositiveInteger(grid.columns, 'Grid columns')
  assertPositiveInteger(grid.rows, 'Grid rows')

  const capacity = grid.columns * grid.rows
  if (!Number.isSafeInteger(capacity)) {
    throw InternalError('Grid capacity is too large', { stage: 'comic:page-utils' })
  }

  return capacity
}

export const USS_ACAMPO_HOUSE_STYLE = [
  'USS Acampo house style: crisp dark ink outlines, softly painted/cel-shaded surfaces, warm practical lights, and a clean illustrated composition.',
  'Use simplified expressive faces and anatomy, readable shapes, and colors derived from the subject, location specification, and canonical references.',
  'Follow the established illustrated workplace-comedy look shown by the canonical character and location art.',
  'Do not use photorealism, semi-photorealism, painterly realism, 3D rendering, photographic textures, cinematic depth of field, volumetric lighting, or realistic skin rendering.',
].join(' ')

export const chunkComicGridPanels = <T extends { panelNumber: number }>(
  panels: T[],
  grid: ComicGridSpec
): Array<ComicGridChunk<T>> => {
  return chunkComicPagePanels(panels, getComicGridCapacity(grid))
}

export const buildComicPagePromptData = (
  bundleDataList: PanelBundleData[]
): PanelBundleData => {
  if (bundleDataList.length === 0) {
    throw ValidationError('Page image prompts require at least one panel bundle', { stage: 'comic:page-utils' })
  }

  const [firstBundle] = bundleDataList
  if (!firstBundle) {
    throw ValidationError('Page image prompts require at least one panel bundle', { stage: 'comic:page-utils' })
  }

  const panels = bundleDataList.map(bundleData => {
    if (bundleData.title !== firstBundle.title) {
      throw ValidationError('Page image panels must share the same title', { stage: 'comic:page-utils' })
    }

    const panel = bundleData.panels[0]
    if (!panel) {
      throw ValidationError('Panel prompt bundle is missing its panel payload', { stage: 'comic:page-utils' })
    }

    return panel
  })

  if (bundleDataList.some(bundle => bundle.snapshotId !== firstBundle.snapshotId)) {
    throw ValidationError('Page image panels cannot mix character reference snapshot IDs', { stage: 'comic:page-utils' })
  }
  if (bundleDataList.every(bundle => bundle.schemaVersion === 3)) {
    if (!firstBundle.locationSnapshotId || bundleDataList.some(bundle => bundle.locationSnapshotId !== firstBundle.locationSnapshotId)) {
      throw ValidationError('Legacy v3 page panels cannot mix or omit location reference snapshot IDs', { stage: 'comic:page-utils' })
    }
    return {
      schemaVersion: 3,
      snapshotId: firstBundle.snapshotId,
      locationSnapshotId: firstBundle.locationSnapshotId,
      title: firstBundle.title,
      location: firstBundle.location,
      panels,
    }
  }
  if (bundleDataList.some(bundle => bundle.schemaVersion !== 4)) {
    throw ValidationError('Page image panels cannot mix panel bundle schema versions', { stage: 'comic:page-utils' })
  }

  return v.parse(PanelBundleDataSchema, {
    schemaVersion: 4,
    snapshotId: firstBundle.snapshotId,
    title: firstBundle.title,
    location: firstBundle.location,
    panels,
  })
}

export const buildComicPagePrompt = (
  pagePromptData: PanelBundleData,
  characterReferences: Array<{ key: string; referenceIndex: number; description: string }> = [],
  locationReferences: Array<{ key: string; referenceIndex: number }> = [],
): string => {
  const panelCount = pagePromptData.panels.length
  const subPanelLabel = panelCount === 1 ? 'sub-panel' : 'sub-panels'

  const allReferencedKeys = characterReferences.map(reference => reference.key)
  const legend = characterReferences.length === 0
    ? 'Character reference legend: none.'
    : [
        'Character reference legend (reference images occur in exactly this order):',
        ...characterReferences.map(reference => `- Reference ${reference.referenceIndex}: characterKey=${reference.key}; catalog appearance=${reference.description}`),
      ].join('\n')
  const panelDirectives = pagePromptData.panels.map(panel => {
    const forbidden = allReferencedKeys.filter(key => !panel.characterKeys.includes(key))
    const locationKey = panel.locationKey ?? locationReferences[0]?.key
    const locationReference = locationReferences.find(reference => reference.key === locationKey)
    const speech = panel.speech.length === 0
      ? ['  - Dialogue: none. Do not add a bubble or caption.']
      : panel.speech.flatMap(item => {
          const speaker = item.speaker.kind === 'character'
            ? `${item.speaker.characterKey}${item.speaker.offscreen ? ' (offscreen)' : ''}`
            : item.speaker.kind === 'caption' ? 'caption' : `voice labeled ${item.speaker.label}`
          return [
            `  - Speaker: ${speaker}. Exact dialogue: ${JSON.stringify(item.line)}`,
            item.speaker.kind === 'character' && !item.speaker.offscreen
              ? `  - Bubble tail must visibly point to ${item.speaker.characterKey}; do not attribute this line to anyone else.`
              : '  - Use the specified offscreen/caption/voice attribution; do not attach it to a visible character.',
          ]
        })
    return [
      `Sub-panel ${panel.number}:`,
      `  - Exact required visible characters: ${panel.characterKeys.length > 0 ? panel.characterKeys.join(', ') : 'none'}.`,
      `  - Referenced characters forbidden from this sub-panel: ${forbidden.length > 0 ? forbidden.join(', ') : 'none'}.`,
      `  - Script-derived visual description: ${panel.description}`,
      `  - Exhaustive prose shot plan: ${panel.shotPlan ?? 'Legacy bundle: rebuild with draft-scenes before generation.'}`,
      `  - Canonical location: ${locationKey ?? 'legacy single location'}${locationReference ? ` (Reference ${locationReference.referenceIndex})` : ''}.`,
      ...speech,
    ].join('\n')
  }).join('\n')

  return [
    'Create one final USS Acampo comic page image from the ordered panel data below.',
    [
      'Page requirements:',
      `- Render exactly ${panelCount} ${subPanelLabel}, one sub-panel for each source panel, in the listed order.`,
      '- Do not add, remove, merge, split, or reorder sub-panels.',
      panelCount === 2
        ? '- Use a strict left-to-right two-panel layout: the first source panel is on the left and the second is on the right.'
        : panelCount === 1
          ? '- This is a trailing single-panel page. Make its one panel fill the canvas; do not leave an empty second panel.'
          : '- Use an ordered, clearly separated multi-panel page layout matching the explicit panels-per-image override.',
      '- Treat every immutable canonical location reference listed in the location legend as canon for its mapped sub-panels. It defines location identity, persistent spatial geometry, fixed features, palette, and art style.',
      `- ${USS_ACAMPO_HOUSE_STYLE}`,
      '- The ordered canonical character reference images are authoritative for both character design and the simplified 2D rendering language. Never reinterpret them as realistic people.',
      '- The canonical character reference images and catalog appearance descriptions have highest visual precedence for identity, physical embodiment, projection/display medium, anatomy, costume, and character-specific required props. If script-derived staging or a shot plan contradicts them, preserve the narrative action but reinterpret the contradictory character depiction to obey canon.',
      '- A source phrase such as interface, screen, monitor, avatar, or body is never permission to change a referenced character\'s canonical embodiment. Apply such wording to nearby equipment or UI only when canon allows it.',
      '- Do not copy a location-sheet view as the panel camera unless the authored staging or shot plan explicitly requires it.',
      '- For every sub-panel, preserve that source panel\'s own staging, setting, and action and choose visually distinct framing appropriate to its specific story beat.',
      '- The `characterKeys` array in each source panel is exact and authoritative: show every listed character and no unlisted character in that sub-panel. Never carry a character forward from the location sheet or another sub-panel.',
      '- Vary camera distance, angle, blocking, and composition between story beats; do not repeat a location-sheet view or another sub-panel\'s screen, terminal, cast arrangement, or opening composition unless that source panel explicitly requires it.',
      '- Include every speech bubble exactly as written in the JSON.',
      '- Do not paraphrase, correct, translate, or omit speech text.',
      '- Place speech text only in the matching source panel.',
      '- Never substitute one referenced identity for another, blend identities, or treat the union of page characters as the cast of every sub-panel.',
      '- Never invent name patches, badges, captions, or labels to repair identity ambiguity.',
      '- Never copy a character key, filename, reference-sheet label, or other reference-only annotation into the comic art.',
      '- Use polished full-color final comic art with clean linework, consistent characters, and readable lettering.',
    ].join('\n'),
    legend,
    locationReferences.length === 0
      ? 'Location reference legend: legacy single-location bundle; use the final reference image for every sub-panel.'
      : [
          'Location reference legend (after all character references, in first-panel-appearance order):',
          ...locationReferences.map(reference => `- Reference ${reference.referenceIndex}: locationKey=${reference.key}; use only for sub-panels ${pagePromptData.panels.filter(panel => (panel.locationKey ?? locationReferences[0]?.key) === reference.key).map(panel => panel.number).join(', ')}.`),
        ].join('\n'),
    `Exact per-panel execution contract:\n${panelDirectives}`,
    `Ordered page data:\n\`\`\`json\n${JSON.stringify(pagePromptData, null, 2)}\n\`\`\``,
  ].join('\n\n')
}
