import { AsyncLocalStorage } from 'node:async_hooks'
import { InternalError, serializeResultError, UsageError } from '~/utils/error-handler'
import { closeResultArtifact, openResultArtifact, writeResultArtifact } from './result-artifact'

type ResultStatus = 'success' | 'failure'

type PendingResult = {
  status: ResultStatus
  exitCode: number
  message: string
  data?: Record<string, unknown>
  error?: Record<string, unknown>
  hints?: string[]
}

type ResultInvocation = {
  json: boolean
  runId: string
  startedAtMs: number
  command?: string
  pending?: PendingResult | undefined
  flushed: boolean
  compact: boolean
  resultFile?: ReturnType<typeof openResultArtifact> | undefined
}

const resultStore = new AsyncLocalStorage<ResultInvocation>()

/** Write a standalone command's payload verbatim, without staging a terminal result or logging. */
export const writeCommandPayload = (payload: string, stream: 'stdout' | 'stderr' = 'stdout'): void => {
  if (invocation()?.compact) throw UsageError('Raw command payloads cannot be combined with --result-file; use the terminal result protocol.')
  if (stream === 'stderr') process.stderr.write(payload)
  else process.stdout.write(payload)
}

export const runWithResultInvocation = async <T>(
  options: { json: boolean, runId: string, command?: string, compact?: boolean },
  fn: () => Promise<T> | T
): Promise<T> => await resultStore.run({
  json: options.json,
  runId: options.runId,
  startedAtMs: Date.now(),
  compact: options.compact ?? false,
  ...(options.command ? { command: options.command } : {}),
  flushed: false
}, async () => {
  try { return await fn() }
  finally {
    const active = invocation()
    if (active?.resultFile) closeResultArtifact(active.resultFile)
  }
})

const invocation = (): ResultInvocation | undefined => resultStore.getStore()

export const setResultFile = (path: string): void => {
  const active = invocation()
  if (!active?.json) throw UsageError('--result-file requires --json.')
  if (active.resultFile) throw InternalError('The invocation already owns a result artifact.', { stage: 'cli:result-artifact' })
  active.resultFile = openResultArtifact(path)
  active.compact = true
}

export type IsolatedCommandResult<T> = {
  value: T
  result?: { data: Record<string, unknown>, message: string } | undefined
}

// Runs one workflow in its own result scope so a command can compose several workflows.
// Whatever the workflow stages is returned to the caller instead of being published.
export const isolateCommandResult = async <T>(
  fn: () => Promise<T>
): Promise<IsolatedCommandResult<T>> => {
  const parent = invocation()
  return await runWithResultInvocation({ json: parent?.json ?? false, runId: parent?.runId ?? 'internal', compact: parent?.compact ?? false, ...(parent?.command ? { command: parent.command } : {}) }, async () => {
    const value = await fn()
    const pending = invocation()?.pending
    return { value, ...(pending?.status === 'success' && pending.data ? { result: { data: pending.data, message: pending.message } } : {}) }
  })
}

export const requireIsolatedResult = <T>(isolated: IsolatedCommandResult<T>): { data: Record<string, unknown>, message: string } => {
  if (!isolated.result) throw InternalError('The workflow returned without staging a successful result', { stage: 'cli:result' })
  return isolated.result
}

export const isJsonResultActive = (): boolean => invocation()?.json === true

export const setResultCommand = (command: string | undefined): void => {
  const active = invocation()
  if (!active || command === undefined) return
  active.command = command
}

const assignPendingResult = (
  active: ResultInvocation,
  data: Record<string, unknown>,
  message: string
): void => {
  active.pending = { status: 'success', exitCode: 0, message, data }
}

export const stageResult = (data: Record<string, unknown>, message = 'Complete'): void => {
  const active = invocation()
  if (!active) return
  if (active.pending) {
    throw InternalError('The command attempted to stage more than one terminal result', {
      stage: 'cli:result',
      metadata: { command: active.command }
    })
  }
  assignPendingResult(active, data, message)
}

// Later batch items must not replace the one terminal result.
export const stageResultIfEmpty = (data: Record<string, unknown>, message = 'Complete'): void => {
  const active = invocation()
  if (!active || active.pending) return
  assignPendingResult(active, data, message)
}

export const stageFailureResult = (
  error: unknown,
  exitCode: number,
  message: string,
  hints: string[] = []
): void => {
  const active = invocation()
  if (!active) return
  active.pending = {
    status: 'failure',
    exitCode,
    message,
    error: serializeResultError(error),
    ...(hints.length > 0 ? { hints } : {})
  }
}

export const discardStagedResult = (): void => {
  const active = invocation()
  if (active) active.pending = undefined
}

export const flushStagedResult = (): void => {
  const active = invocation()
  if (!active) return
  if (active.flushed) {
    throw InternalError('The terminal result was already flushed', { stage: 'cli:result' })
  }
  if (!active.pending) {
    throw InternalError('The command returned without staging a terminal result', {
      stage: 'cli:result',
      metadata: { command: active.command }
    })
  }

  if (!active.json) { active.flushed = true; return }
  const envelope = {
    schemaVersion: 1,
    type: 'result',
    timestamp: new Date().toISOString(),
    runId: active.runId,
    ...(active.command ? { command: active.command } : {}),
    status: active.pending.status,
    exitCode: active.pending.exitCode,
    durationMs: Math.max(0, Date.now() - active.startedAtMs),
    message: active.pending.message,
    ...(active.pending.data ? { data: active.pending.data } : {}),
    ...(active.pending.error ? { error: active.pending.error } : {}),
    ...(active.pending.hints ? { hints: active.pending.hints } : {})
  }
  let output: string
  try { output = active.resultFile ? writeResultArtifact(active.resultFile, envelope) : `${JSON.stringify(envelope)}\n` }
  catch (error) {
    if (active.resultFile) closeResultArtifact(active.resultFile)
    active.resultFile = undefined
    throw error
  }
  active.flushed = true
  process.stdout.write(output)
}
