import { mkdir, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { DialogueWorkItem, DialogueWorkSelectorOptions } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { normalizePositiveInt } from '~/utils/value-helpers'

const resolveWorkspaces = <TResult>(
  workspaceRoot: string,
  work: readonly DialogueWorkItem<TResult>[]
): Array<DialogueWorkItem<TResult> & { workspaceDir: string }> => {
  const root = resolve(workspaceRoot)
  const seen = new Set<string>()

  return work.map((entry) => {
    const workspaceDir = resolve(root, entry.workspaceName)
    const isSafeName = entry.workspaceName.length > '.work-'.length
      && entry.workspaceName.startsWith('.work-')
      && basename(entry.workspaceName) === entry.workspaceName
      && !entry.workspaceName.includes('\\')
      && dirname(workspaceDir) === root

    if (!isSafeName) {
      throw ValidationError(`Invalid dialogue workspace name: ${entry.workspaceName}`, { stage: 'tts:dialogue', retryable: false })
    }
    if (seen.has(workspaceDir)) {
      throw ValidationError(`Duplicate dialogue workspace name: ${entry.workspaceName}`, { stage: 'tts:dialogue', retryable: false })
    }

    seen.add(workspaceDir)
    return { ...entry, workspaceDir }
  })
}

export const runDialogueWorkSelector = async <TResult>(
  options: DialogueWorkSelectorOptions<TResult>
): Promise<TResult[]> => {
  const entries = resolveWorkspaces(options.workspaceRoot, options.work)
  if (entries.length === 0) {
    return []
  }

  const controller = new AbortController()
  const results: Array<TResult | undefined> = new Array(entries.length)
  let nextIndex = 0
  let firstFailure: unknown
  let failed = false

  const recordFailure = (error: unknown): void => {
    if (failed) return
    failed = true
    firstFailure = error
    controller.abort(error)
  }

  const execute = async (
    entry: DialogueWorkItem<TResult> & { workspaceDir: string }
  ): Promise<TResult> => {
    let workFailed = false
    try {
      await mkdir(entry.workspaceDir, { recursive: true })
      if (controller.signal.aborted) {
        throw controller.signal.reason ?? InfraError('Dialogue work was cancelled', { stage: 'tts:dialogue', retryable: false })
      }
      return await entry.run(entry.workspaceDir, controller.signal)
    } catch (error) {
      workFailed = true
      recordFailure(error)
      throw error
    } finally {
      try {
        await rm(entry.workspaceDir, { recursive: true, force: true })
      } catch (error) {
        recordFailure(error)
        if (!workFailed) {
          throw error
        }
      }
    }
  }

  const runWorker = async (): Promise<void> => {
    while (!failed) {
      const index = nextIndex
      nextIndex += 1
      if (index >= entries.length) return

      try {
        results[index] = await execute(entries[index] as DialogueWorkItem<TResult> & { workspaceDir: string })
      } catch {
        return
      }
    }
  }

  const workerCount = Math.min(normalizePositiveInt(options.concurrency), entries.length)
  await Promise.all(Array.from({ length: workerCount }, async () => await runWorker()))

  if (failed) {
    throw firstFailure
  }
  return results as TResult[]
}
