import type { ExpectedOutputOptions } from '~/types'
import { expectedWriteArtifactFiles } from '~/cli/commands/text/write/run-write-command'

export const buildWriteExpectedFiles = (opts: ExpectedOutputOptions): string[] =>
  expectedWriteArtifactFiles(opts)
