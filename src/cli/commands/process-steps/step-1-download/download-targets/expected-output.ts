import type { ExpectedOutputOptions, ProcessCommand } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { buildExtractExpectedFiles } from './expected-output-extract'
import { buildDownloadExpectedFiles, buildMetadataExpectedFiles } from './expected-output-metadata-download'
import { buildWriteExpectedFiles } from './expected-output-write'

export const buildExpectedFilesList = async (
  command: ProcessCommand,
  opts: ExpectedOutputOptions,
  resolvedTarget?: string
): Promise<string[]> => {
  if (command === 'write') return buildWriteExpectedFiles(opts)
  if (command === 'metadata') return buildMetadataExpectedFiles(opts)
  if (command === 'download') return await buildDownloadExpectedFiles(opts, resolvedTarget)
  if (isExtractCommand(command)) {
    const routing = typeof resolvedTarget === 'string'
      ? await resolveInputRoutingForCommand(command, resolvedTarget, opts)
      : undefined
    return buildExtractExpectedFiles(opts, routing, resolvedTarget)
  }
  return buildExtractExpectedFiles(opts, undefined, resolvedTarget)
}

export const buildBatchExpectedFilesList = async (
  command: ProcessCommand,
  opts: ExpectedOutputOptions,
  sampleTarget: string
): Promise<string[]> => {
  const expectedFiles = await buildExpectedFilesList(command, opts, sampleTarget)
  const childFiles = expectedFiles
    .filter((file) => !file.includes('/*.md'))
    .map((file) => `<child-run>/${file}`)
  const externalFiles = expectedFiles.filter((file) => file.includes('/*.md'))
  return ['manifest.json', ...childFiles, ...externalFiles]
}
