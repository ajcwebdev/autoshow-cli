#!/usr/bin/env bun

import { l } from '~/utils/app-logger/app-logger'
import { runTestRunner } from './test-runner/runner'

const reportFatal = (label: string, err: unknown): never => {
  l.error(`${label}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
  process.exit(1)
}
process.on('unhandledRejection', (reason) => reportFatal('Unhandled promise rejection in test runner', reason))
process.on('uncaughtException', (error) => reportFatal('Uncaught exception in test runner', error))

let exitCode = 0
try {
  exitCode = await runTestRunner(process.argv)
} catch (error) {
  exitCode = 1
  l.error(error instanceof Error ? error.message : String(error))
}
process.exit(exitCode)
