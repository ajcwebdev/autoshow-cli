import { join } from 'node:path'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { CLIUsageError } from '~/utils/error-handler'

let pinnedRunDir: string | undefined
let claimedBy: string | undefined

export const configurePinnedRunDir = (dir: string): void => {
  const trimmed = dir.trim()
  if (trimmed.length === 0) {
    throw CLIUsageError('Output directory cannot be empty.')
  }
  pinnedRunDir = trimmed
  claimedBy = undefined
}

export const getPinnedRunDir = (): string | undefined => pinnedRunDir

export const claimPinnedRunDir = (claimant: string): string | undefined => {
  if (pinnedRunDir === undefined) {
    return undefined
  }

  if (claimedBy !== undefined && claimedBy !== claimant) {
    throw CLIUsageError(
      `--output-dir cannot be used for a run that creates more than one output directory (claimed by "${claimedBy}", then "${claimant}").`,
      'Use --output-root to place multiple run directories under a shared base instead.'
    )
  }

  claimedBy = claimant
  return pinnedRunDir
}

export const resolveRunDirectory = (baseDir: string, label: string, stage: string): string =>
  claimPinnedRunDir(`${stage}:${label}`) ?? join(baseDir, createUniqueDirectoryName(label))

export const resetPinnedRunDir = (): void => {
  pinnedRunDir = undefined
  claimedBy = undefined
}
