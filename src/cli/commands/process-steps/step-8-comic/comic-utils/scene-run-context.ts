import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createUniqueDirectoryName, sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { BeginSceneRunOptions } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { claimPinnedRunDir } from '~/cli/commands/process-steps/run-dir'

const RUN_DIRECTORY_PREFIX = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_/

const runDirectoryBySlug = new Map<string, string>()

const scenePartMatches = (directoryName: string, sanitizedSlug: string): boolean =>
  RUN_DIRECTORY_PREFIX.test(directoryName) &&
  directoryName.replace(RUN_DIRECTORY_PREFIX, '') === sanitizedSlug

export const findLatestSceneRunDirectory = (sceneSlug: string): string | undefined => {
  const outputRoot = getOutputRoot()
  if (!existsSync(outputRoot)) {
    return undefined
  }

  const sanitizedSlug = sanitizeTitleSlug(sceneSlug)
  const matches = readdirSync(outputRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && scenePartMatches(entry.name, sanitizedSlug))
    .map(entry => entry.name)
    .sort()

  const latest = matches.at(-1)
  return latest ? join(outputRoot, latest) : undefined
}

export const beginSceneRun = (sceneSlug: string, options: BeginSceneRunOptions = {}): string => {
  let directory: string
  const outputRoot = getOutputRoot()
  const explicitDirectory = claimPinnedRunDir(`comic:${sceneSlug}`) ?? options.outputDir

  if (explicitDirectory) {
    directory = explicitDirectory
  } else if (options.resume) {
    const latest = findLatestSceneRunDirectory(sceneSlug)
    if (!latest) {
      throw ValidationError(
        `No existing comic run found for "${sceneSlug}" under ${outputRoot}/. ` +
        'Run "bun autoshow comic draft-scenes <script-path>" first, or pass --output-dir.',
        { stage: 'comic:scene-run' }
      )
    }
    directory = latest
  } else {
    directory = join(outputRoot, createUniqueDirectoryName(sceneSlug))
  }

  runDirectoryBySlug.set(sceneSlug, directory)
  return directory
}

export const isSceneRunActive = (sceneSlug: string): boolean =>
  runDirectoryBySlug.has(sceneSlug)

export const getSceneRunDirectory = (sceneSlug: string): string => {
  const active = runDirectoryBySlug.get(sceneSlug)
  if (active) {
    return active
  }

  const directory = claimPinnedRunDir(`comic:${sceneSlug}`)
    ?? findLatestSceneRunDirectory(sceneSlug)
    ?? join(getOutputRoot(), createUniqueDirectoryName(sceneSlug))
  runDirectoryBySlug.set(sceneSlug, directory)
  return directory
}

export const resetSceneRunContext = (): void => {
  runDirectoryBySlug.clear()
}
