import type { ComicRecoveryFlags, ComicRecoveryInput, GenerateImagesCommandOptions, PanelPrimaryReferenceInput } from '~/types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { hashCanonicalTtsValue } from '../../../audio/tts/script-to-audio/contract-identity'
import { COMIC_GRID_PANEL_SIZE, DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../comic-commands/generate-images/comic-page-utils'
import { DEFAULT_QA_MODEL } from './cli-args'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { captureComicRecoveryInputs } from './comic-recovery-intent'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { getCharactersRoot } from '../../../command-shared/characters-root'
import { getCharacterSketchManifestPath } from '../comic-commands/process-scenes/character-utils'
import { getLocationReferencePath, getLocationSketchManifestPath } from './location-reference'
import { extractPanelBundleData, getPromptBundleFilename, resolveDesignReferencesAcrossPanels, resolveLocationReferencesAcrossPanels } from './panel-prompt-utils'

export const captureComicImageRecoveryInputs = async (rootDir: string, _materializeDerived = false): Promise<ComicRecoveryInput[]> => {
  const paths = [
    'metadata/structured-script.json', 'metadata/scene.json', 'metadata/panel-prompts', 'metadata/blocking', 'metadata/blocking-plan.json',
  ].filter(path => existsSync(join(rootDir, path)))
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

const providerSelector = (domain: 'image' | 'llm', model: string): string => {
  const service = findRegistryServiceForModel(domain, model)
  return service ? `${service}=${model}` : model
}

export const comicImageRecoveryFlags = (options: GenerateImagesCommandOptions): ComicRecoveryFlags => ({
  target: options.target ?? 'images',
  provider: (options.imageModels ?? [DEFAULT_IMAGE_MODEL]).map((model) => providerSelector('image', model)),
  size: options.size ?? COMIC_GRID_PANEL_SIZE,
  quality: options.quality ?? 'high',
  panels: Array.isArray(options.panels) ? options.panels.join(',') : options.panels ?? 'all',
  qa: options.qa !== false,
  'qa-provider': providerSelector('llm', options.qaModel ?? DEFAULT_QA_MODEL),
  'max-repairs': String(options.maxRepairs ?? 2),
  'provider-concurrency': String(options.concurrency ?? DEFAULT_CLI_CONCURRENCY),
  'concurrency-mode': options.concurrencyMode ?? 'ramp',
  force: options.force === true,
  bloopers: options.bloopers === true,
  'stop-on-provider-error': options.stopOnProviderError === true,
  'blocking-layout-guide': options.blockingLayoutGuide === true,
  ...(options.blockingHardKeys?.length ? { 'blocking-hard-keys': options.blockingHardKeys.join(',') } : {}),
  ...(options.panelsPerImage !== undefined ? { 'panels-per-image': String(options.panelsPerImage) } : {}),
  ...(options.grid ? { grid: `${options.grid.columns}x${options.grid.rows}` } : {}),
  ...(options.variations ? { variation: options.variations.join(',') } : {}),
})

export const comicImageRecoveryHash = (options: GenerateImagesCommandOptions): string => hashCanonicalTtsValue({
  flags: comicImageRecoveryFlags(options),
  ...(options.recoveryRunId ? { imageRunId: options.recoveryRunId } : {}),
  finalPanelsPerImage: options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  sketchPanelsPerImage: options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE,
})
