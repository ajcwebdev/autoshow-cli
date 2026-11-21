import type { ComicImageRecoveryResolution, ComicLegacyImageOutput, ComicRecoveryFlags, ComicRecoveryInput, ComicRecoveryIntent, GenerateImagesCommandOptions, ImageGenerationModel, PanelPrimaryReferenceInput } from '~/types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { hashCanonicalTtsValue } from '../../../audio/tts/script-to-audio/contract-identity'
import { chunkComicPagePanels, COMIC_GRID_PANEL_SIZE, DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../comic-commands/generate-images/comic-page-utils'
import { resolveSketchChunks } from '../comic-commands/generate-sketches/generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { captureComicRecoveryInputs } from './comic-recovery-intent'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { getCharactersRoot } from '../../../command-shared/characters-root'
import { getCharacterSketchManifestPath } from '../comic-commands/process-scenes/character-utils'
import { getLocationReferencePath, getLocationSketchManifestPath } from './location-reference'
import { extractPanelBundleData, getPanelNumberFromName, getPromptBundleFilename, PANEL_DIRECTORY_PATTERN, resolveDesignReferencesAcrossPanels, resolveLocationReferencesAcrossPanels } from './panel-prompt-utils'
import { getPanelPromptsDirectory } from './project-paths'
import { getLegacyPageComicImagePath, getLegacyPanelComicImagePath, getPageComicImagePath, getPanelComicImagePath, getSketchComicImagePath } from './scene-utils'

/** Workspace inputs that only fed the retired blocking workflow. Historical intents may still list them; they no longer bind image work. */
export const isRetiredComicImageRecoveryInput = (input: ComicRecoveryInput): boolean => input.base === undefined
  && (input.path === 'metadata/blocking-plan.json' || input.path === 'metadata/blocking' || input.path.startsWith('metadata/blocking/'))

export const currentComicImageRecoveryInputs = (intent: ComicRecoveryIntent): ComicRecoveryInput[] =>
  intent.inputs.filter(input => !isRetiredComicImageRecoveryInput(input))

export const captureComicImageRecoveryInputs = async (rootDir: string, _materializeDerived = false): Promise<ComicRecoveryInput[]> => {
  const paths = ['metadata/structured-script.json', 'metadata/scene.json', 'metadata/panel-prompts'].filter(path => existsSync(join(rootDir, path)))
  const panelRoot = join(rootDir, 'metadata/panel-prompts')
  const panels: PanelPrimaryReferenceInput[] = existsSync(panelRoot) ? readdirSync(panelRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^panel-\d+$/.test(entry.name))
    .map(entry => {
      const panelDirectory = join(panelRoot, entry.name)
      const entries = readdirSync(panelDirectory, { withFileTypes: true })
      return { panelDirectory, entries, bundleData: extractPanelBundleData(readFileSync(join(panelDirectory, getPromptBundleFilename(panelDirectory, entries)), 'utf8')) }
    }) : []
  const keys = panels.flatMap(panel => panel.bundleData.panels.flatMap(panel => panel.characterKeys))
  const references = loadAndVerifyCharacterReferenceSnapshot(rootDir, undefined, keys)
  const canonicalPaths = [
    join(getCharactersRoot(), 'characters-reference.json'), getCharacterSketchManifestPath(),
    ...references.characters.flatMap(character => character.assets.map(asset => resolve(rootDir, asset.path))),
  ]
  if (panels.length > 0) {
    canonicalPaths.push(getLocationReferencePath(), getLocationSketchManifestPath())
    canonicalPaths.push(...resolveLocationReferencesAcrossPanels(panels).flatMap(reference => reference.views?.map(view => view.path) ?? [reference.path]))
    canonicalPaths.push(...resolveDesignReferencesAcrossPanels(panels).map(reference => reference.path))
  }
  const localInputs = await captureComicRecoveryInputs(rootDir, paths)
  const canonicalInputs = (await captureComicRecoveryInputs(rootDir, canonicalPaths.map(path => resolve(path)))).map((input): ComicRecoveryInput => {
    if (!isAbsolute(input.path)) return input
    const projectPath = relative(process.cwd(), input.path)
    return projectPath && projectPath !== '..' && !projectPath.startsWith(`..${sep}`) && !isAbsolute(projectPath)
      ? { path: projectPath.replace(/\\/g, '/'), sha256: input.sha256, base: 'project' }
      : input
  })
  return [...new Map([...localInputs, ...canonicalInputs].map(input => [`${input.base ?? 'workspace'}:${input.path}`, input])).values()]
    .sort((a, b) => `${a.base ?? 'workspace'}:${a.path}`.localeCompare(`${b.base ?? 'workspace'}:${b.path}`))
}

const providerSelector = (model: string): string => {
  const service = findRegistryServiceForModel('image', model)
  return service ? `${service}=${model}` : model
}

const modelFromSelector = (selector: string): string => selector.includes('=') ? selector.slice(selector.indexOf('=') + 1) : selector

/** Recorded flags for a new image intent: the exact single model, its options and nothing from retired QA, blocking or variation modes. */
export const comicImageRecoveryFlags = (options: GenerateImagesCommandOptions): ComicRecoveryFlags => ({
  target: options.target ?? 'images',
  provider: providerSelector(options.imageModel ?? DEFAULT_IMAGE_MODEL),
  size: options.size ?? COMIC_GRID_PANEL_SIZE,
  quality: options.quality ?? 'high',
  panels: Array.isArray(options.panels) ? options.panels.join(',') : options.panels ?? 'all',
  'provider-concurrency': String(options.concurrency ?? DEFAULT_CLI_CONCURRENCY),
  'concurrency-mode': options.concurrencyMode ?? 'ramp',
  force: options.force === true,
  'stop-on-provider-error': options.stopOnProviderError === true,
  ...(options.panelsPerImage !== undefined ? { 'panels-per-image': String(options.panelsPerImage) } : {}),
  ...(options.grid ? { grid: `${options.grid.columns}x${options.grid.rows}` } : {}),
})

/** Hash of recorded image flags and run ID. Historical intents used the same shape, so their integrity can be checked without parsing retired flags. */
export const comicImageRecoveryHashFromFlags = (flags: ComicRecoveryFlags, imageRunId: string | undefined): string => {
  const recordedPanelsPerImage = typeof flags['panels-per-image'] === 'string' ? Number(flags['panels-per-image']) : undefined
  return hashCanonicalTtsValue({
    flags,
    ...(imageRunId ? { imageRunId } : {}),
    finalPanelsPerImage: recordedPanelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
    sketchPanelsPerImage: recordedPanelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE,
  })
}

export const comicImageRecoveryHash = (options: GenerateImagesCommandOptions): string =>
  comicImageRecoveryHashFromFlags(comicImageRecoveryFlags(options), options.recoveryRunId)

const RETIRED_IMAGE_RECOVERY_FLAGS = ['qa', 'qa-provider', 'max-repairs', 'bloopers', 'blocking-layout-guide', 'blocking-hard-keys', 'variation'] as const

const listFlag = (value: ComicRecoveryFlags[string] | undefined): string[] => {
  if (value === undefined || typeof value === 'boolean') return []
  return (Array.isArray(value) ? value : [value]).flatMap(part => part.split(',')).map(part => part.trim()).filter(Boolean)
}

/**
 * Translate recorded image flags at the recovery boundary, before any current CLI validation.
 * Retired options are never fed to the parser: an equivalent historical generation-only intent is rewritten
 * to the current single-model flags, and anything else is reported as incompatible.
 */
export const resolveComicImageRecoveryFlags = (flags: ComicRecoveryFlags): ComicImageRecoveryResolution => {
  const providers = listFlag(flags['provider'])
  const isLegacy = Array.isArray(flags['provider']) || RETIRED_IMAGE_RECOVERY_FLAGS.some(flag => flag in flags)
  if (!isLegacy) return { status: 'current', flags }

  const models = providers.map(modelFromSelector)
  const variations = listFlag(flags['variation'])
  const reasons: string[] = []
  if (models.length > 1) reasons.push(`it requested ${models.length} image models (${models.join(', ')})`)
  if (flags['qa'] === true) reasons.push('it depended on automated QA judging and repairs')
  if (flags['bloopers'] === true) reasons.push('it captured QA bloopers')
  if (flags['blocking-layout-guide'] === true || listFlag(flags['blocking-hard-keys']).length > 0) reasons.push('it depended on the retired blocking workflow')
  const namedVariations = variations.filter(variation => variation !== 'canonical')
  if (namedVariations.length > 0 || variations.length > 1) reasons.push(`it requested prompt variations (${variations.join(', ')})`)
  if (reasons.length > 0) return { status: 'incompatible', reasons, models, variations }

  const current: ComicRecoveryFlags = {}
  for (const [key, value] of Object.entries(flags)) {
    if ((RETIRED_IMAGE_RECOVERY_FLAGS as readonly string[]).includes(key)) continue
    current[key] = key === 'provider' ? providers[0] ?? providerSelector(DEFAULT_IMAGE_MODEL) : value
  }
  if (!('provider' in current)) current['provider'] = providerSelector(DEFAULT_IMAGE_MODEL)
  return { status: 'legacy-equivalent', flags: current, model: models[0] ?? DEFAULT_IMAGE_MODEL, explicitCanonicalVariation: variations.length === 1 }
}

const recordedPanelNumbers = (sceneSlug: string, flags: ComicRecoveryFlags): number[] => {
  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)
  const available = existsSync(panelPromptsDir)
    ? readdirSync(panelPromptsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
      .map(entry => getPanelNumberFromName(entry.name))
      .filter((panelNumber): panelNumber is number => panelNumber !== null)
      .sort((left, right) => left - right)
    : []
  const selection = typeof flags['panels'] === 'string' ? flags['panels'] : 'all'
  if (selection === 'all') return available
  const requested = new Set(selection.split(',').map(part => Number(part.trim())).filter(Number.isInteger))
  return available.filter(panelNumber => requested.has(panelNumber))
}

/**
 * List completed outputs of a historical image intent at the exact locations its dispatch used, per model and variation.
 * Read-only: no dispatch, no file moves and no selection changes.
 */
export const inspectLegacyComicImageOutputs = (sceneSlug: string, flags: ComicRecoveryFlags, runId: string): ComicLegacyImageOutput[] => {
  const models = listFlag(flags['provider']).map(modelFromSelector)
  if (models.length === 0) models.push(DEFAULT_IMAGE_MODEL)
  const variations = listFlag(flags['variation'])
  const variationSlots: Array<string | undefined> = variations.length > 0 ? variations : [undefined]
  const multiModel = models.length > 1
  const target = typeof flags['target'] === 'string' ? flags['target'] : 'images'
  const recordedPanelsPerImage = typeof flags['panels-per-image'] === 'string' ? Number(flags['panels-per-image']) : undefined
  const pageMode = recordedPanelsPerImage !== undefined && recordedPanelsPerImage > 1 && flags['grid'] === undefined
  const panelNumbers = recordedPanelNumbers(sceneSlug, flags)
  const outputs: ComicLegacyImageOutput[] = []
  const pushIfPresent = (output: ComicLegacyImageOutput): void => {
    if (existsSync(output.path)) outputs.push({ ...output, path: relative(process.cwd(), output.path).replace(/\\/g, '/') })
  }

  for (const model of models) {
    const legacyModel = model as ImageGenerationModel
    if (target !== 'sketches') {
      for (const variation of variationSlots) {
        // Historical destinations: an explicit variation used <run>/<variation>/<model>/, several models used <run>/<model>/, one model used <run>/.
        const legacyLocation = variation !== undefined || multiModel
          ? { runId, model: legacyModel, ...(variation !== undefined ? { variation } : {}) }
          : null
        if (pageMode) {
          for (const chunk of chunkComicPagePanels(panelNumbers.map(panelNumber => ({ panelNumber })), recordedPanelsPerImage)) {
            pushIfPresent({
              kind: 'page',
              label: `page ${chunk.pageNumber} (panels ${chunk.panelNumbers.join(', ')})`,
              model,
              ...(variation !== undefined ? { variation } : {}),
              path: legacyLocation
                ? getLegacyPageComicImagePath(sceneSlug, chunk.pageNumber, chunk.panelNumbers, legacyLocation)
                : getPageComicImagePath(sceneSlug, chunk.pageNumber, chunk.panelNumbers, { runId }),
            })
          }
        } else {
          for (const panelNumber of panelNumbers) {
            pushIfPresent({
              kind: 'panel',
              label: `panel ${panelNumber}`,
              model,
              ...(variation !== undefined ? { variation } : {}),
              path: legacyLocation
                ? getLegacyPanelComicImagePath(sceneSlug, panelNumber, legacyLocation)
                : getPanelComicImagePath(sceneSlug, panelNumber, { runId }),
            })
          }
        }
      }
    }
    if (target !== 'images' && panelNumbers.length > 0) {
      const chunks = (() => {
        try {
          const contiguous = panelNumbers.every((panelNumber, index) => index === 0 || panelNumber === panelNumbers[index - 1]! + 1)
          const sketchPanels = flags['panels'] === 'all' || !contiguous ? undefined : { startPanelNumber: panelNumbers[0]!, endPanelNumber: panelNumbers.at(-1)! }
          return resolveSketchChunks(panelNumbers.map(panelNumber => ({ panelNumber })), {
            ...(sketchPanels ? { sketchPanels } : {}),
            panelsPerImage: recordedPanelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE,
          }, sceneSlug).selectedChunks
        } catch {
          return []
        }
      })()
      for (const chunk of chunks) {
        pushIfPresent({
          kind: 'sketch',
          label: `sketch panels ${chunk.startPanelNumber}-${chunk.endPanelNumber}`,
          model,
          path: getSketchComicImagePath(sceneSlug, chunk.startPanelNumber, chunk.endPanelNumber, multiModel ? legacyModel : undefined, runId),
        })
      }
    }
  }
  return outputs
}
