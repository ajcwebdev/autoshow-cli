import { mkdir, rename, rm } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BuildSingleArtifactMapOptions, MultiFileRunResult, ProviderIdentity, RunMediaArtifactTargetsOptions, RunSingleFileTargetsOptions, RunTargetsOptions, SingleFileArtifactNameOptions, SingleFileRunResult } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { runProviderTargetScheduler } from './provider-target-scheduler'


export const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

export const getSingleFileArtifactName = (
  target: ProviderIdentity,
  singleTarget: boolean,
  options: SingleFileArtifactNameOptions
): string => {
  if (singleTarget) {
    return options.singleFileName
  }

  return `${options.multiFilePrefix}-${target.service}-${sanitizeModelName(target.model)}.${options.extension}`
}

export const buildSingleArtifactMap = <T,>(
  items: T[],
  options: BuildSingleArtifactMapOptions<T>
): Record<string, string> => {
  if (items.length === 1) {
    return { [options.singleKey]: options.getFileName(items[0] as T) }
  }

  return Object.fromEntries(
    items.map((item) => [
      `${options.multiKeyPrefix}-${options.getService(item)}-${sanitizeModelName(options.getModel(item))}`,
      options.getFileName(item)
    ])
  )
}

export const runTargets = async <TTarget extends ProviderIdentity, TResult>(
  opts: RunTargetsOptions<TTarget, TResult>
): Promise<TResult[]> => {
  const { targets, outputDir, stepLabel, noProviderMessage } = opts
  const singleTarget = targets.length === 1
  const scheduled = await runProviderTargetScheduler<TTarget, TResult>({
    entries: targets.map((target, index) => ({
      index,
      target,
      priority: opts.getTargetPriority?.(target, index)
    })),
    concurrency: opts.concurrency ?? {
      provider: DEFAULT_CLI_CONCURRENCY,
      local: DEFAULT_CLI_CONCURRENCY
    },
    resourceGate: opts.resourceGate,
    getResourceGate: opts.getResourceGate,
    hostedConcurrencyCoordinator: opts.hostedConcurrencyCoordinator,
    hostedWorkClass: opts.hostedWorkClass,
    getHostedWorkId: (index, target) => `${stepLabel}:${outputDir}:${target.service}:${target.model}:${index}`,
    getPool: opts.getTargetPool ?? (() => 'hosted'),
    runTarget: async (_index, target) => {
      const usesWorkspace = !singleTarget || opts.useWorkspaceForSingleTarget === true
      const workspaceDir = usesWorkspace ? opts.getWorkspaceDir(outputDir, target) : outputDir
      let completed = false

      if (usesWorkspace) {
        await mkdir(workspaceDir, { recursive: true })
      }

      try {
        const result = await opts.runTarget(target, workspaceDir)
        const finalized = await opts.finalizeTarget(target, result, singleTarget)
        completed = true
        return finalized
      } catch (error) {
        await opts.onTargetFailure?.(target, error, workspaceDir)
        throw error
      } finally {
        if (usesWorkspace && (completed || opts.preserveWorkspaceOnFailure !== true)) {
          await rm(workspaceDir, { recursive: true, force: true })
        }
      }
    }
  })
  const successes = scheduled.results.filter((result): result is TResult => result !== undefined)
  const failedTargets = scheduled.failures.map(({ target, message, error }) => {
    l.warn(`Failed to run ${stepLabel} target ${target.service}/${target.model}: ${message}`, {
      category: 'pipeline',
      metadata: { step: stepLabel, service: target.service, model: target.model }, error: error
    })
    return { summary: `${target.service}/${target.model}: ${message}`, error }
  })

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.map(failure => failure.summary).join('; ') : noProviderMessage
    const firstCause = failedTargets[0]?.error
    throw InfraError(`No ${stepLabel} outputs were generated. ${details}`, {
      stage: 'process:run-targets',
      ...(firstCause instanceof Error ? { cause: firstCause } : {}),
      metadata: { failures: failedTargets.map(failure => failure.summary) }
    })
  }

  if (failedTargets.length > 0) {
    l.warn(`${stepLabel} run completed with partial failures: ${failedTargets.map(failure => failure.summary).join('; ')}`, {
      category: 'pipeline',
      metadata: { step: stepLabel, failureCount: failedTargets.length, failures: failedTargets.map(failure => failure.summary) }
    })
  }

  return successes
}

export const runMediaArtifactTargets = async <TTarget extends ProviderIdentity, TMetadata>(
  opts: RunMediaArtifactTargetsOptions<TTarget, TMetadata>
): Promise<Array<MultiFileRunResult<TMetadata>>> =>
  runTargets<TTarget, MultiFileRunResult<TMetadata>>({
    targets: opts.targets,
    outputDir: opts.outputDir,
    stepLabel: opts.stepLabel,
    noProviderMessage: opts.noProviderMessage,
    getWorkspaceDir: (dir, target) =>
      `${dir}/${opts.workspacePrefix}-${target.service}-${sanitizeModelName(target.model)}`,
    concurrency: opts.concurrency,
    resourceGate: opts.resourceGate,
    getResourceGate: opts.getResourceGate,
    getTargetPool: opts.getTargetPool,
    getTargetPriority: opts.getTargetPriority,
    hostedConcurrencyCoordinator: opts.hostedConcurrencyCoordinator,
    hostedWorkClass: opts.hostedWorkClass,
    runTarget: opts.runTarget,
    finalizeTarget: async (target, result, singleTarget) => {
      if (singleTarget && opts.finalizeSingleTarget !== true) {
        return result
      }

      const finalFileNames = opts.getArtifactFileNames(target, result.filePaths.map(filePath => basename(filePath)), singleTarget)
      const finalPaths: string[] = []

      for (const [index, filePath] of result.filePaths.entries()) {
        const finalFileName = finalFileNames[index]
        if (!finalFileName) continue

        // A single target already writes into the output directory, so only fan-out runs need renaming.
        const finalPath = singleTarget ? filePath : `${opts.outputDir}/${finalFileName}`
        if (!singleTarget) await rename(filePath, finalPath)
        finalPaths.push(finalPath)
      }

      if (finalPaths.length === 0) {
        throw InfraError(`No finalized ${opts.stepLabel} artifacts were produced for ${target.service}/${target.model}`, {
          stage: opts.artifactFailureStage ?? `${opts.stepLabel}:run`
        })
      }

      return {
        filePaths: finalPaths,
        metadata: opts.finalizeMetadata(result.metadata, finalFileNames, finalPaths)
      }
    }
  })

export const runSingleFileTargets = async <TTarget extends ProviderIdentity, TMetadata>(
  opts: RunSingleFileTargetsOptions<TTarget, TMetadata>
): Promise<Array<SingleFileRunResult<TMetadata>>> => {
  const results = await runMediaArtifactTargets<TTarget, TMetadata>({
    targets: opts.targets,
    outputDir: opts.outputDir,
    stepLabel: opts.stepLabel,
    noProviderMessage: opts.noProviderMessage,
    workspacePrefix: opts.workspacePrefix,
    concurrency: opts.concurrency,
    resourceGate: opts.resourceGate,
    getResourceGate: opts.getResourceGate,
    getTargetPool: opts.getTargetPool,
    getTargetPriority: opts.getTargetPriority,
    hostedConcurrencyCoordinator: opts.hostedConcurrencyCoordinator,
    hostedWorkClass: opts.hostedWorkClass,
    runTarget: async (target, workspaceDir) => {
      const result = await opts.runTarget(target, workspaceDir)
      return { filePaths: [result.filePath], metadata: result.metadata }
    },
    getArtifactFileNames: (target, _sourceFileNames, singleTarget) => [opts.getArtifactFileName(target, singleTarget)],
    finalizeMetadata: (metadata, finalFileNames, finalPaths) => opts.finalizeMetadata(metadata, finalFileNames[0] as string, finalPaths[0] as string)
  })

  return results.map(result => ({ filePath: result.filePaths[0] as string, metadata: result.metadata }))
}

export const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items
