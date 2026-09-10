import type { ComicRecoveryFlags, GenerateImagesCommandOptions } from '~/types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { hashCanonicalTtsValue } from '../../step-4-tts/script-to-audio/contract-identity'
import { COMIC_GRID_PANEL_SIZE, DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../comic-commands/generate-images/comic-page-utils'
import { DEFAULT_QA_MODEL } from './cli-args'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { captureComicRecoveryInputs } from './comic-recovery-intent'
import { loadAndVerifyCharacterReferenceSnapshot } from './character-reference-snapshot'
import { resolveCharacterIdentityReferences } from './character-identity-card'

export const captureComicImageRecoveryInputs = async (rootDir: string, materializeDerived = false) => {
  const paths = [
    'metadata/structured-script.json', 'metadata/scene.json', 'metadata/panel-prompts', 'metadata/blocking', 'metadata/blocking-plan.json',
    'assets/character-references.json', 'assets/location-references.json', 'assets/location-references', 'assets/design-references.json', 'assets/design-references',
  ].filter(path => existsSync(join(rootDir, path)))
  if (paths.includes('assets/character-references.json')) {
    // Prepare local identity cards before recording the request, then verify them read-only on resume.
    const references = loadAndVerifyCharacterReferenceSnapshot(rootDir)
    paths.push(...references.characters.flatMap(character => character.assets.map(asset => asset.path)))
    paths.push(...resolveCharacterIdentityReferences(rootDir, references, references.characters.map(character => character.key), { compose: materializeDerived }).map(reference => reference.path))
  }
  return await captureComicRecoveryInputs(rootDir, paths)
}

export const comicImageRecoveryFlags = (options: GenerateImagesCommandOptions): ComicRecoveryFlags => ({
  target: options.target ?? 'images',
  'image-model': (options.imageModels ?? [DEFAULT_IMAGE_MODEL]).join(','),
  size: options.size ?? COMIC_GRID_PANEL_SIZE,
  quality: options.quality ?? 'high',
  panels: Array.isArray(options.panels) ? options.panels.join(',') : options.panels ?? 'all',
  qa: options.qa !== false,
  'qa-model': options.qaModel ?? DEFAULT_QA_MODEL,
  'max-repairs': String(options.maxRepairs ?? 2),
  concurrency: String(options.concurrency ?? DEFAULT_CLI_CONCURRENCY),
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
