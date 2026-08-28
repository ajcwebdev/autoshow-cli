import { appendFile, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { RunnerLogHandle, TestRunArtifacts } from '~/types'
import { formatTimestampForDir } from './utils'
import { isObjectLike } from '~/utils/value-helpers'

const LATEST_LOG_FILE = 'latest.log'
const ACTIVE_RUN_FILE = '.active-run.json'
const RUNNER_LOG_FLUSH_INTERVAL_MS = 100
const RUNNER_LOG_FLUSH_SIZE_BYTES = 64 * 1024
const COMMAND_LOG_TAIL_BYTES = 256 * 1024

export const TEST_OUTPUT_ROOT = resolve(process.cwd(), 'output/test-output')

const runnerLogHandles = new WeakMap<TestRunArtifacts, RunnerLogHandle>()

const readTextIfExists = async (path: string): Promise<string> => {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

const readTextTailIfExists = async (path: string, maxBytes: number): Promise<string> => {
  try {
    const file = Bun.file(path)
    const size = file.size
    if (size <= maxBytes) {
      return await file.text()
    }
    const omitted = size - maxBytes
    const tail = await file.slice(omitted).text()
    return `[truncated ${omitted} leading bytes]\n${tail}`
  } catch {
    return ''
  }
}

const parseJsonRecord = (text: string): Record<string, unknown> | null => {
  if (!text.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(text) as unknown
    return isObjectLike(parsed) ? parsed : null
  } catch {
    return null
  }
}

const readJsonIfExists = async (path: string): Promise<Record<string, unknown> | null> => {
  return parseJsonRecord(await readTextIfExists(path))
}

const openRunnerLogSink = (artifacts: TestRunArtifacts): void => {
  const handle: RunnerLogHandle = {
    writer: Bun.file(artifacts.runnerLogPath).writer(),
    pendingBytes: 0,
    closed: false,
    flushTimer: setInterval(() => {
      if (handle.closed || handle.pendingBytes === 0) {
        return
      }
      handle.pendingBytes = 0
      void handle.writer.flush()
    }, RUNNER_LOG_FLUSH_INTERVAL_MS),
  }
  handle.flushTimer.unref()
  runnerLogHandles.set(artifacts, handle)
}

const endRunnerLogSink = async (artifacts: TestRunArtifacts): Promise<void> => {
  const handle = runnerLogHandles.get(artifacts)
  if (!handle || handle.closed) {
    return
  }
  handle.closed = true
  clearInterval(handle.flushTimer)
  handle.pendingBytes = 0
  await handle.writer.end()
  runnerLogHandles.delete(artifacts)
}

const ensureParentDirectory = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
}

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const isActiveRunDir = async (dir: string): Promise<boolean> => {
  const marker = await readJsonIfExists(resolve(dir, ACTIVE_RUN_FILE))
  const pid = marker?.['pid']
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 && isPidAlive(pid)
}

const formatUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const appendRunSummary = (
  lines: string[],
  report: Record<string, unknown> | null,
  artifacts: TestRunArtifacts,
  exitCode: number
): void => {
  const runRaw = report?.['run']
  const summaryRaw = report?.['summary']
  const run = isObjectLike(runRaw) ? runRaw : {}
  const summary = isObjectLike(summaryRaw) ? summaryRaw : {}

  lines.push('AutoShow test runner latest log')
  lines.push(`Run ID: ${formatUnknown(run['id']) ?? artifacts.runId}`)
  lines.push(`Mode: ${formatUnknown(run['mode']) ?? 'unknown'}`)
  lines.push(`Exit code: ${exitCode}`)
  lines.push(`Started: ${formatUnknown(run['startedAt']) ?? artifacts.startedAtIso}`)
  lines.push(`Ended: ${formatUnknown(run['endedAt']) ?? 'unknown'}`)
  lines.push(`Duration ms: ${formatUnknown(run['durationMs']) ?? 'unknown'}`)

  const argv = Array.isArray(run['argv'])
    ? run['argv'].filter((value): value is string => typeof value === 'string')
    : []
  lines.push(`Args: ${argv.join(' ')}`)
  lines.push('')
  lines.push('Summary')
  lines.push(`Total: ${formatUnknown(summary['total']) ?? 'unknown'}`)
  lines.push(`Passed: ${formatUnknown(summary['passed']) ?? 'unknown'}`)
  lines.push(`Failed: ${formatUnknown(summary['failed']) ?? 'unknown'}`)
  lines.push(`Skipped: ${formatUnknown(summary['skipped']) ?? 'unknown'}`)
}

const appendFailures = (lines: string[], report: Record<string, unknown> | null): void => {
  lines.push('')
  lines.push('Failures')

  const testsRaw = report?.['tests']
  const commandsRaw = report?.['commands']
  const failedTests = Array.isArray(testsRaw)
    ? testsRaw.filter((entry): entry is Record<string, unknown> =>
        isObjectLike(entry) && entry['status'] === 'failed')
    : []
  const failedCommands = Array.isArray(commandsRaw)
    ? commandsRaw.filter((entry): entry is Record<string, unknown> =>
        isObjectLike(entry) && entry['status'] === 'failed')
    : []

  if (failedTests.length === 0 && failedCommands.length === 0 && !report?.['error']) {
    lines.push('None recorded')
    return
  }

  for (const entry of failedTests) {
    const file = formatUnknown(entry['file']) ?? 'unknown file'
    const name = formatUnknown(entry['name']) ?? 'unknown test'
    const message = formatUnknown(entry['failureMessage'])
    lines.push(`- ${file} :: ${name}${message ? `: ${message}` : ''}`)
  }

  for (const entry of failedCommands) {
    const name = formatUnknown(entry['name']) ?? 'unknown command'
    const message = formatUnknown(entry['failureMessage'])
    lines.push(`- ${name}${message ? `: ${message}` : ''}`)
  }

  const error = formatUnknown(report?.['error'])
  if (error) {
    lines.push(`- runner error: ${error}`)
  }
}

export const cleanupTestOutputRoot = async (
  rootDir = TEST_OUTPUT_ROOT,
  options: { keepRunDir?: string, preserveActiveRuns?: boolean } = {}
): Promise<void> => {
  await mkdir(rootDir, { recursive: true })

  const entries = await readdir(rootDir, { withFileTypes: true })
  const keepRunDir = options.keepRunDir ? resolve(options.keepRunDir) : null
  const pathsToRemove: string[] = []

  for (const entry of entries) {
    if (entry.name === LATEST_LOG_FILE) {
      continue
    }

    const entryPath = resolve(rootDir, entry.name)
    if (keepRunDir && entryPath === keepRunDir) {
      continue
    }

    if (options.preserveActiveRuns) {
      if (entry.name === '.test-cache') {
        continue
      }
      if (entry.isDirectory() && await isActiveRunDir(entryPath)) {
        continue
      }
    }

    pathsToRemove.push(entryPath)
  }

  await Promise.all(pathsToRemove.map(path => rm(path, { recursive: true, force: true })))
}

export const cleanupRunArtifacts = async (artifacts: TestRunArtifacts): Promise<void> => {
  await endRunnerLogSink(artifacts)
  await rm(artifacts.runDir, { recursive: true, force: true })
}

export const createRunArtifacts = async (rootDir = TEST_OUTPUT_ROOT): Promise<TestRunArtifacts> => {
  const started = new Date()
  const startedAtMs = started.getTime()
  const startedAtIso = started.toISOString()
  await mkdir(rootDir, { recursive: true })

  const base = `${formatTimestampForDir(started)}_test-run`
  let runId = base
  let runDir = resolve(rootDir, runId)

  for (let i = 1; i < 1000; i++) {
    try {
      await mkdir(runDir, { recursive: false })
      break
    } catch {
      runId = `${base}_${i}`
      runDir = resolve(rootDir, runId)
    }
  }

  const runnerLogPath = resolve(runDir, 'runner.log')
  const commandLogPath = resolve(runDir, 'commands.log')
  const metricsLogPath = resolve(runDir, 'metrics.ndjson')
  const activeRunPath = resolve(runDir, ACTIVE_RUN_FILE)
  const metadataDirPath = resolve(runDir, 'metadata')
  await Bun.write(activeRunPath, `${JSON.stringify({
    pid: process.pid,
    startedAt: startedAtIso,
  }, null, 2)}\n`)
  await Bun.write(commandLogPath, '')
  await Bun.write(metricsLogPath, '')
  await mkdir(metadataDirPath, { recursive: true })

  const artifacts: TestRunArtifacts = {
    rootDir,
    runId,
    runDir,
    runnerLogPath,
    commandLogPath,
    metricsLogPath,
    activeRunPath,
    junitPath: resolve(runDir, 'junit.xml'),
    reportJsonPath: resolve(runDir, 'report.json'),
    e2eReportJsonPath: resolve(runDir, 'e2e-report.json'),
    calibrationReportJsonPath: resolve(runDir, 'model-calibration.json'),
    metadataDirPath,
    startedAtMs,
    startedAtIso,
  }
  openRunnerLogSink(artifacts)
  return artifacts
}

export const appendRunnerLog = (artifacts: TestRunArtifacts, text: string): void => {
  const handle = runnerLogHandles.get(artifacts)
  if (handle && !handle.closed) {
    handle.writer.write(text)
    handle.pendingBytes += text.length
    if (handle.pendingBytes >= RUNNER_LOG_FLUSH_SIZE_BYTES) {
      handle.pendingBytes = 0
      void handle.writer.flush()
    }
    return
  }

  void appendFile(artifacts.runnerLogPath, text)
}

export const appendCommandLog = async (artifacts: TestRunArtifacts, text: string): Promise<void> => {
  await ensureParentDirectory(artifacts.commandLogPath)
  await appendFile(artifacts.commandLogPath, text)
}

export const writeReportJson = async (
  artifacts: TestRunArtifacts,
  json: Record<string, unknown>
): Promise<void> => {
  await ensureParentDirectory(artifacts.reportJsonPath)
  await Bun.write(artifacts.reportJsonPath, JSON.stringify(json, null, 2))
}

export const writeJsonFile = async (
  path: string,
  json: Record<string, unknown>
): Promise<void> => {
  await ensureParentDirectory(path)
  await Bun.write(path, JSON.stringify(json, null, 2))
}

export const writeLatestRunLog = async (
  artifacts: TestRunArtifacts,
  exitCode: number
): Promise<string> => {
  await endRunnerLogSink(artifacts)
  const latestLogPath = resolve(artifacts.rootDir, LATEST_LOG_FILE)
  const [reportText, runnerLog, commandLog] = await Promise.all([
    readTextIfExists(artifacts.reportJsonPath),
    readTextIfExists(artifacts.runnerLogPath),
    readTextTailIfExists(artifacts.commandLogPath, COMMAND_LOG_TAIL_BYTES),
  ])
  const report = parseJsonRecord(reportText)
  const lines: string[] = []

  appendRunSummary(lines, report, artifacts, exitCode)
  appendFailures(lines, report)

  lines.push('')
  lines.push('=== report.json ===')
  lines.push(reportText.trim() || '<missing>')
  lines.push('')
  lines.push('=== runner.log ===')
  lines.push(runnerLog.trim() || '<missing>')
  lines.push('')
  lines.push('=== commands.log ===')
  lines.push(commandLog.trim() || '<missing>')

  await mkdir(artifacts.rootDir, { recursive: true })
  await Bun.write(latestLogPath, `${lines.join('\n')}\n`)
  return latestLogPath
}
