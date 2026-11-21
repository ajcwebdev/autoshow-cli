import { constants } from 'node:fs'
import { copyFile, link, mkdir, readdir, rmdir } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { hasErrorCode, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

const existingOutputError = (path: string) => InfraError(
  `Found an existing media resume output or workspace at ${path}. Check for an active resume and inspect the saved files. To purchase a new attempt, move the unrecorded files or workspace aside first.`,
  { stage: 'resume:media-artifacts' }
)

export const createMediaResumeWorkspace = async (dir: string): Promise<void> => {
  try {
    await mkdir(dir)
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) throw existingOutputError(dir)
    throw error
  }
}

export const retainIncompleteMediaWorkspace = async (dir: string): Promise<void> => {
  // Remove only an empty workspace. A failed later download can leave usable, paid files.
  try {
    await rmdir(dir)
  } catch (error) {
    if (!hasErrorCode(error, 'ENOTEMPTY') && !hasErrorCode(error, 'EEXIST')) throw error
    l.warn(`Retained incomplete media outputs in ${dir}`, { category: 'artifact' })
  }
}

export const partialImageResponseDirectoryPrefix = (model: string): string => `partial-images-${model}-`

export const checkMediaResumeDestinations = async (
  outputDir: string,
  bareFileName: string,
  providerFileName: string,
  recordedFileNames: readonly string[],
  imageModel?: string
): Promise<void> => {
  const bareStem = parse(bareFileName).name
  const providerStem = parse(providerFileName).name
  // Accept provider-selected image extensions and numbered outputs, plus music lyric and extra part files.
  const suffix = imageModel ? /^(?:-\d+)?\.(?:png|jpg|jpeg|webp|svg)$/i
    : bareFileName.endsWith('.mp3') ? /^(?:(?:-part-\d+)?\.mp3|\.txt)$/i : /^\.mp4$/i
  const matches = (name: string, stem: string): boolean => name.startsWith(stem) && suffix.test(name.slice(stem.length))
  const entries = await readdir(outputDir, { withFileTypes: true })
  for (const { name } of entries) {
    if (matches(name, providerStem) || (matches(name, bareStem) && !recordedFileNames.includes(name))) {
      throw existingOutputError(join(outputDir, name))
    }
  }
  if (!imageModel) return
  const prefix = partialImageResponseDirectoryPrefix(imageModel)
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix) || entry.name.length !== prefix.length + 6) continue
    const dir = join(outputDir, entry.name)
    if ((await readdir(dir)).some(name => matches(name, bareStem))) throw existingOutputError(dir)
  }
}

export const publishMediaResumeFile = async (source: string, destination: string): Promise<void> => {
  // Linking publishes a complete file without clobbering another attempt. Some user-mounted volumes only
  // support copying; claim the destination exclusively there and retain the workspace until the copy completes.
  try {
    await link(source, destination)
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) throw existingOutputError(destination)
    if (!['ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EPERM', 'EXDEV'].some(code => hasErrorCode(error, code))) throw error
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL)
    } catch (copyError) {
      if (hasErrorCode(copyError, 'EEXIST')) throw existingOutputError(destination)
      throw copyError
    }
  }
}
