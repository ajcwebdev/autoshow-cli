import * as l from '~/utils/app-logger/app-logger'
import { extractErrorHints, InternalError, isAppError } from '~/utils/error-handler'
import { flushFatalResult } from '~/utils/app-logger/result-emitter'

const emitFatalResult = (error: unknown, exitCode: number, message: string): void => {
  try { flushFatalResult(error, exitCode, message, extractErrorHints(error)) }
  catch (failure) { l.error('Unable to write fatal command result', { category: 'command', error: failure }) }
}

let handlersInstalled = false
let fatalHandled = false

const handleFatal = (label: string, error: unknown): void => {
  if (fatalHandled) {
    return
  }

  fatalHandled = true
  if (isAppError(error)) {
    l.error(`${label}: ${error.message}`, { category: 'command', metadata: { label }, error })
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint, { category: 'command' })
    }
    emitFatalResult(error, error.exitCode, `${label}: ${error.message}`)
    process.exit(error.exitCode)
  }

  const payloadLabel = error instanceof Error && error.name.length > 0
    ? `${label} (${error.name} payload redacted)`
    : `${label} (payload redacted)`
  const diagnostic = InternalError(payloadLabel, { stage: 'cli:fatal' })
  l.error(payloadLabel, { category: 'command', error: diagnostic })
  emitFatalResult(diagnostic, 1, payloadLabel)
  process.exit(1)
}

export const installProcessFailureHandlers = (): void => {
  if (handlersInstalled) {
    return
  }

  handlersInstalled = true

  process.on('uncaughtException', (error) => {
    handleFatal('Uncaught exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    handleFatal('Unhandled promise rejection', reason)
  })
}
