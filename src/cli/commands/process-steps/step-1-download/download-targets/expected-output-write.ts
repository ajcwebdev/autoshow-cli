import type { ExpectedOutputOptions } from '~/types'
import { expectedWriteArtifactFiles } from '~/cli/commands/process-steps/step-3-write/run-write-command'

export const buildWriteExpectedFiles = (opts: ExpectedOutputOptions): string[] =>
  expectedWriteArtifactFiles(opts)
