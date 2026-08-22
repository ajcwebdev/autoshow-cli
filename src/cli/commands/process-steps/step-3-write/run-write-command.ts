import { resolve } from 'node:path'
import { isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { classifyTopLevelTarget, isLikelyInputListFile } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection'
import { processBatch } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch'
import { reportSuitePriceEstimate } from '~/cli/commands/process-steps/step-1-download/download-targets/process-target-preflight'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { loadConfig, resolveConfigPath, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { readInjectedConfigFlags } from '~/cli/options/option-resolution/build-options-config-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { CliFlagOccurrence, WriteRuntimeOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { runTextWrite } from './run-text-write'
import { collectTextInputFiles, isTextInputPath, readPromptFileText, resolveWriteTextProjectDefaults } from './text-input-utils'

export const WRITE_NON_TEXT_INPUT_MESSAGE =
  'write only accepts local .md or .txt files or directories of those files. Run bun autoshow extract <input> first, then bun autoshow write on the extracted text.'

export const expectedWriteArtifactFiles = (opts: Pick<WriteRuntimeOptions, 'renderedText' | 'renderedOutDir'>): string[] => {
  const files = ['text.json', 'show-note.md']
  if (opts.renderedText) files.push('text.md')
  if (typeof opts.renderedOutDir === 'string' && opts.renderedOutDir.length > 0) {
    files.push(`${opts.renderedOutDir}/*.md`)
  }
  files.push('prompt.md', 'manifest.json')
  return files
}

const resolveWriteInputFiles = async (target: string): Promise<string[]> => {
  if (isLikelyUrl(target)) {
    throw UsageError(WRITE_NON_TEXT_INPUT_MESSAGE)
  }

  const topLevel = await classifyTopLevelTarget(target)
  if (!topLevel.exists) {
    throw UsageError(`Input does not exist: ${target}. Run: bun autoshow help write`)
  }

  if (topLevel.isDirectory) {
    const files = await collectTextInputFiles(target)
    if (files.length === 0) {
      throw UsageError(`No .md or .txt files found in ${target}`)
    }
    return files
  }

  if (!isTextInputPath(target)) {
    throw UsageError(WRITE_NON_TEXT_INPUT_MESSAGE)
  }

  if (await isLikelyInputListFile(target)) {
    throw UsageError(WRITE_NON_TEXT_INPUT_MESSAGE)
  }

  return [resolve(target)]
}

const applyBatchSelection = (files: string[], opts: WriteRuntimeOptions): string[] => {
  const ordered = opts.batchOrder === 'oldest' ? [...files].reverse() : [...files]
  if (opts.batchLimit === 'all') return ordered
  return ordered.slice(0, opts.batchLimit)
}

export const runWriteCommand = async (
  target: string | undefined,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): Promise<void> => {
  if (target === undefined || target.trim().length === 0) {
    throw UsageError(`Missing write input. ${WRITE_NON_TEXT_INPUT_MESSAGE}`)
  }

  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const mergedFlags = mergeConfigIntoRawFlags(flags, config, explicitFlags, 'write')
  const configuredFlags = readInjectedConfigFlags(mergedFlags)
  const optionExplicitFlags = new Set([...explicitFlags, ...configuredFlags])
  const normalized = normalizeGenericProviderSelectorFlags(
    mergedFlags,
    optionExplicitFlags,
    flagOccurrences,
    'llm',
    WRITE_LLM_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-llm' }
  )
  const options: WriteRuntimeOptions = {
    ...buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences }),
    configPath: resolvedConfigPath
  }

  const projectDefaults = await resolveWriteTextProjectDefaults(target, options, explicitFlags)
  const effectiveOptions: WriteRuntimeOptions = projectDefaults
    ? {
        ...options,
        promptFile: projectDefaults.promptFile,
        renderedOutDir: projectDefaults.renderedOutDir,
        ...(projectDefaults.trackList ? { trackList: projectDefaults.trackList } : {})
      }
    : options

  if (projectDefaults && !explicitFlags.has('prompt-file')) {
    await readPromptFileText(projectDefaults.promptFile).catch((error: unknown) => {
      throw UsageError(
        `write project mode requires ${projectDefaults.projectDir}/prompt.md or an explicit --prompt-file`,
        undefined,
        error instanceof Error ? { cause: error } : {}
      )
    })
  }

  const files = applyBatchSelection(await resolveWriteInputFiles(target), effectiveOptions)
  const maxCents = resolveMaxCents(config.pricing)

  if (effectiveOptions.price || maxCents !== undefined) {
    if (files.length === 1) {
      const estimate = await buildAggregatedPriceEstimate('write', files[0] as string, effectiveOptions)
      const { estimate: accepted, shouldExit } = evaluatePreflightEstimate(estimate, effectiveOptions, maxCents)
      if (shouldExit) {
        l.report.expectedOutput('./output/<timestamp>_write-text/', expectedWriteArtifactFiles(effectiveOptions))
        return
      }
      await runTextWrite(files[0] as string, '', effectiveOptions, accepted)
      return
    }

    const suiteCost = await reportSuitePriceEstimate('write', files, effectiveOptions)
    if (effectiveOptions.price) {
      if (projectDefaults) {
        l.report.expectedOutput('./output/<timestamp>_text/', expectedWriteArtifactFiles(effectiveOptions))
      }
      return
    }
    if (maxCents !== undefined && suiteCost > maxCents && !effectiveOptions.allowOverBudget) {
      throw UsageError(
        `Estimated suite cost ${suiteCost.toFixed(3)}¢ exceeds configured budget ${maxCents.toFixed(3)}¢. Use --allow-over-budget to proceed.`
      )
    }
  }

  if (files.length === 1) {
    await runTextWrite(files[0] as string, '', effectiveOptions)
    return
  }

  await processBatch(
    files,
    'text',
    'write',
    effectiveOptions,
    async (_command, item, batchDir, opts) => await runTextWrite(item, batchDir, opts, undefined, { batchDir }),
    { concurrency: effectiveOptions.batchConcurrency }
  )
}
