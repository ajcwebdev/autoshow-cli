import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { ResolveComicScriptReferenceOptions } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getSceneRunDirectory } from './scene-run-context'

const INPUT_ROOT = 'input'
const EPISODE_SCRIPTS_ROOT = join(INPUT_ROOT, 'episode-scripts')

const COMIC_SCRIPT_SHORTHAND_PATTERN = /^(\d{2})-(\d{2})$/

// Each scene's output lives in a per-run, timestamped directory under output/
// (resolved once per process by scene-run-context), so consecutive runs are
// preserved instead of overwriting one another.
export const getSceneOutputDirectory = (sceneSlug: string): string =>
  getSceneRunDirectory(sceneSlug)

export const getStructuredScriptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'structured-script.json')

export const getDraftPromptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'draft-prompt.md')

export const getSceneJsonPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'scene.json')

export const getInvalidSceneJsonPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'scene.invalid.json')

export const getPanelPromptsDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'panel-prompts')

export const getPanelPromptCoverageReportPath = (sceneSlug: string): string =>
  join(getPanelPromptsDirectory(sceneSlug), 'source-coverage.json')

export const getSketchesDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'sketches')

export const getPagesDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'pages')

export const getPanelsDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'panels')

export const resolveSceneSlug = (scriptPath: string): string =>
  basename(scriptPath, extname(scriptPath))

export const normalizeProjectPath = (path: string): string => path.replace(/\\/g, '/')

export const resolveComicScriptReference = async (
  scriptReference: string,
  options: ResolveComicScriptReferenceOptions = {}
): Promise<string> => {
  const match = scriptReference.match(COMIC_SCRIPT_SHORTHAND_PATTERN)
  if (!match?.[1] || !match[2]) {
    return scriptReference
  }

  const episode = match[1]
  const scene = match[2]
  const episodeScriptsRoot = options.episodeScriptsRoot ?? EPISODE_SCRIPTS_ROOT
  const episodeDirectory = join(episodeScriptsRoot, `${episode}-script`)
  const expectedPrefix = `${scene}-`

  const entries = await (async () => {
    try {
      return await readdir(episodeDirectory, { withFileTypes: true })
    } catch (error) {
      throw InfraError(
        `Comic script shorthand "${scriptReference}" could not be resolved. ` +
        `Expected exactly one Markdown file in "${normalizeProjectPath(episodeDirectory)}" ` +
        `beginning with "${expectedPrefix}". ` +
        `${error instanceof Error ? error.message : String(error)}`,
        { stage: 'comic:project-paths', ...(error instanceof Error ? { cause: error } : {}) }
      )
    }
  })()

  const matches = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name.startsWith(expectedPrefix))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

  if (matches.length !== 1) {
    const detail = matches.length === 0
      ? 'Found none.'
      : `Found ${matches.length}: ${matches.join(', ')}.`
    throw ValidationError(
      `Comic script shorthand "${scriptReference}" could not be resolved. ` +
      `Expected exactly one Markdown file in "${normalizeProjectPath(episodeDirectory)}" ` +
      `beginning with "${expectedPrefix}". ${detail}`,
      { stage: 'comic:project-paths' }
    )
  }

  return join(episodeDirectory, matches[0]!)
}
