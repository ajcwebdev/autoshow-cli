#!/usr/bin/env bun

import { l } from '~/utils/app-logger/app-logger'
import { normalizeExitCode, serializeDiagnosticError } from '~/utils/error-handler'
import { installTimestampedConsole, runTestRunner } from './test-runner/runner'

// Installed before the fatal handlers can fire, so a crash during startup is timestamped
// like every other runner line instead of appearing unprefixed.
installTimestampedConsole()

// Reports the whole chain (stack, cause, AppError classification) rather than only
// `error.message`, and exits with the error's own code so a usage failure from
// `parseRunnerArgs` surfacing asynchronously still exits 2 rather than a hardcoded 1.
const reportFatal = (label: string, err: unknown): never => {
  l.error(label, { category: 'command', error: err })
  l.write('error', 'Fatal runner diagnostics', {
    category: 'command',
    metadata: { error: serializeDiagnosticError(err) }
  })
  process.exit(normalizeExitCode(err))
}
process.on('unhandledRejection', (reason) => reportFatal('Unhandled promise rejection in test runner', reason))
process.on('uncaughtException', (error) => reportFatal('Uncaught exception in test runner', error))

let exitCode = 0
try {
  exitCode = await runTestRunner(process.argv)
} catch (error) {
  exitCode = normalizeExitCode(error)
  l.error('Test runner failed', { category: 'command', error })
  l.write('error', 'Runner failure diagnostics', {
    category: 'command',
    metadata: { error: serializeDiagnosticError(error) }
  })
}
process.exit(exitCode)
