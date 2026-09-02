import { AsyncLocalStorage } from 'node:async_hooks'
import { InternalError, serializeResultError } from '~/utils/error-handler'

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
}

const resultStore = new AsyncLocalStorage<ResultInvocation>()

export const runWithResultInvocation = async <T>(
  options: { json: boolean, runId: string, command?: string },
  fn: () => Promise<T> | T
): Promise<T> => await resultStore.run({
  json: options.json,
  runId: options.runId,
  startedAtMs: Date.now(),
  ...(options.command ? { command: options.command } : {}),
  flushed: false
}, fn)

const invocation = (): ResultInvocation | undefined => resultStore.getStore()

export const isJsonResultActive = (): boolean => invocation()?.json === true

export const setResultCommand = (command: string | undefined): void => {
  const active = invocation()
  if (!active || command === undefined) return
  active.command = command
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
  active.pending = { status: 'success', exitCode: 0, message, data }
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

  active.flushed = true
  if (!active.json) return
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
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
}
