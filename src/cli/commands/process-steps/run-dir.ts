import { join } from 'node:path'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { CLIUsageError } from '~/utils/error-handler'

// The global --output-dir flag pins the exact run directory for one invocation instead of the
// timestamped output/<timestamp>_<slug> convention. It is configured once by the CLI dispatcher and
// read here so deep call sites (media runners, STT, comic scene runs) resolve it without threading a
// new option through every runtime options type. This mirrors output-root.ts.

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

// Claims the pinned directory for one top-level run directory. Batch children never reach this
// because reserveBatchChildOutputDir resolves them under the batch root first, so a second claim
// means the invocation is producing two independent runs and cannot honor a single pinned path.
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

// The claim key pairs the stage with the run label so a stage that legitimately resolves the same
// run twice is idempotent, while two different runs from the same stage are rejected.
export const resolveRunDirectory = (baseDir: string, label: string, stage: string): string =>
  claimPinnedRunDir(`${stage}:${label}`) ?? join(baseDir, createUniqueDirectoryName(label))

export const resetPinnedRunDir = (): void => {
  pinnedRunDir = undefined
  claimedBy = undefined
}
