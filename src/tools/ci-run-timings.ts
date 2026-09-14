import { UsageError } from '~/utils/error-handler'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type {
  CiPriceCommandTiming,
  CiPriceMetricsSummary,
  CiRunCriticalPathEntry,
  CiRunJobPayload,
  CiRunJobTiming,
  CiRunPayload,
  CiRunTimingsSummary
} from '~/types'
import { childEnv } from '~/utils/child-env'
import { parseJsonlBytes } from '~/utils/jsonl-reader'
import { runSyncCommandOrThrow } from '~/utils/sync-subprocess'
import { isObjectLike } from '~/utils/value-helpers'

export const CI_RUN_VIEW_FIELDS = 'jobs,conclusion,createdAt,updatedAt,event,headBranch,headSha,url,workflowName,displayTitle'

const DEFAULT_TOP = 10
const COMMAND_DISPLAY_LIMIT = 120

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (typeof value !== 'string' || value.length === 0) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

const spanMs = (start: string | null | undefined, end: string | null | undefined): number => {
  const startMs = parseTimestamp(start)
  const endMs = parseTimestamp(end)
  if (startMs === null || endMs === null) return 0
  return Math.max(0, endMs - startMs)
}

const isSkipped = (job: CiRunJobPayload): boolean => job.conclusion === 'skipped'

const buildCriticalPath = (jobs: CiRunJobPayload[]): CiRunCriticalPathEntry[] => {
  const candidates = jobs
    .filter(job => !isSkipped(job))
    .map(job => ({ job, startedAt: parseTimestamp(job.startedAt), completedAt: parseTimestamp(job.completedAt) }))
    .filter((entry): entry is { job: CiRunJobPayload, startedAt: number, completedAt: number } =>
      entry.startedAt !== null && entry.completedAt !== null)
  const latest = (entries: typeof candidates) =>
    entries.reduce<typeof candidates[number] | null>((best, entry) => best === null || entry.completedAt > best.completedAt ? entry : best, null)
  const path: CiRunCriticalPathEntry[] = []
  let current = latest(candidates)
  while (current !== null) {
    const { job, startedAt, completedAt } = current
    path.unshift({ job: job.name, durationMs: Math.max(0, completedAt - startedAt) })
    current = latest(candidates.filter(entry => entry.job !== job && entry.completedAt <= startedAt))
  }
  return path
}

export const summarizeRunTimings = (payload: CiRunPayload, options: { id?: string } = {}): CiRunTimingsSummary => {
  const runStart = parseTimestamp(payload.createdAt)
  const jobs = payload.jobs ?? []
  return {
    run: {
      ...(options.id === undefined ? {} : { id: options.id }),
      url: payload.url ?? '',
      event: payload.event ?? '',
      branch: payload.headBranch ?? '',
      sha: payload.headSha ?? '',
      wallMs: spanMs(payload.createdAt, payload.updatedAt)
    },
    jobs: jobs.map((job): CiRunJobTiming => {
      const durationMs = spanMs(job.startedAt, job.completedAt)
      const jobStart = parseTimestamp(job.startedAt)
      return {
        name: job.name,
        startOffsetMs: runStart === null || jobStart === null ? 0 : Math.max(0, jobStart - runStart),
        durationMs,
        conclusion: job.conclusion ?? job.status ?? 'unknown',
        steps: isSkipped(job)
          ? []
          : (job.steps ?? []).map(step => {
              const stepMs = spanMs(step.startedAt, step.completedAt)
              return { name: step.name, durationMs: stepMs, shareOfJob: durationMs === 0 ? 0 : stepMs / durationMs }
            })
      }
    }),
    criticalPath: buildCriticalPath(jobs)
  }
}

export const formatClockDuration = (ms: number): string => {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

export const formatSeconds = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(2)}s`

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

export const renderMarkdownTable = (header: string[], rows: string[][]): string[] => {
  const cells = [header, ...rows].map(row => row.map(escapeCell))
  const widths = header.map((_, column) => Math.max(...cells.map(row => (row[column] ?? '').length)))
  const line = (row: string[]): string => `| ${row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(' | ')} |`
  const [headerCells = [], ...bodyCells] = cells
  return [line(headerCells), `| ${widths.map(width => '-'.repeat(width)).join(' | ')} |`, ...bodyCells.map(line)]
}

export const renderRunTimingsMarkdown = (summary: CiRunTimingsSummary, options: { job?: string } = {}): string => {
  const filter = options.job?.toLowerCase()
  const detailed = summary.jobs.filter(job => job.steps.length > 0 && (filter === undefined || job.name.toLowerCase().includes(filter)))
  const lines = [
    `# CI run timings${summary.run.id === undefined ? '' : ` for run ${summary.run.id}`}`,
    '',
    `- Run: ${summary.run.url}`,
    `- Event: ${summary.run.event}`,
    `- Branch: ${summary.run.branch}`,
    `- Commit: ${summary.run.sha}`,
    `- Wall: ${formatClockDuration(summary.run.wallMs)} (${summary.run.wallMs} ms from createdAt to updatedAt)`,
    '',
    '## Jobs',
    '',
    ...renderMarkdownTable(
      ['Job', 'Start offset', 'Duration', 'Conclusion'],
      summary.jobs.map(job => [job.name, formatClockDuration(job.startOffsetMs), formatClockDuration(job.durationMs), job.conclusion])
    )
  ]
  for (const job of detailed) {
    lines.push('', `## ${job.name} steps`, '', ...renderMarkdownTable(
      ['Step', 'Duration', 'Share'],
      job.steps.map(step => [step.name, formatClockDuration(step.durationMs), `${(step.shareOfJob * 100).toFixed(1)}%`])
    ))
  }
  const total = summary.criticalPath.reduce((sum, entry) => sum + entry.durationMs, 0)
  lines.push('', '## Critical path', '')
  if (summary.criticalPath.length === 0) lines.push('- No completed jobs with timestamps.')
  for (const [index, entry] of summary.criticalPath.entries()) lines.push(`${index + 1}. ${entry.job}: ${formatClockDuration(entry.durationMs)}`)
  lines.push('', `Total: ${formatClockDuration(total)} (${total} ms across ${summary.criticalPath.length} job${summary.criticalPath.length === 1 ? '' : 's'})`)
  return `${lines.join('\n')}\n`
}

const percentile = (sortedAscending: number[], fraction: number): number => {
  if (sortedAscending.length === 0) return 0
  const rank = Math.min(sortedAscending.length, Math.max(1, Math.ceil(fraction * sortedAscending.length)))
  return sortedAscending[rank - 1] ?? 0
}

export const summarizePriceMetrics = (records: unknown[], top = DEFAULT_TOP): CiPriceMetricsSummary => {
  const commands: CiPriceCommandTiming[] = []
  for (const record of records) {
    if (!isObjectLike(record)) continue
    const durationMs = record['durationMs']
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) continue
    const args = Array.isArray(record['args']) ? record['args'].filter((value): value is string => typeof value === 'string') : []
    const command = args.length > 0 ? args.join(' ') : typeof record['command'] === 'string' ? record['command'] : ''
    const exitCode = record['exitCode']
    commands.push({ command, durationMs, exitCode: typeof exitCode === 'number' && Number.isFinite(exitCode) ? exitCode : null })
  }
  const durations = commands.map(entry => entry.durationMs).sort((left, right) => left - right)
  return {
    count: commands.length,
    totalMs: durations.reduce((sum, value) => sum + value, 0),
    p50Ms: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
    maxMs: durations[durations.length - 1] ?? 0,
    slowest: [...commands]
      .sort((left, right) => right.durationMs - left.durationMs || left.command.localeCompare(right.command))
      .slice(0, top)
  }
}

const truncateCommand = (command: string): string =>
  command.length <= COMMAND_DISPLAY_LIMIT ? command : `${command.slice(0, COMMAND_DISPLAY_LIMIT - 1)}…`

export const renderPriceMetricsMarkdown = (summary: CiPriceMetricsSummary, source: string): string => {
  const lines = [
    '# Price preflight command timings',
    '',
    `- Metrics: ${source}`,
    `- Commands: ${summary.count}`,
    `- Sum: ${formatSeconds(summary.totalMs)}`,
    `- p50: ${formatSeconds(summary.p50Ms)}`,
    `- p90: ${formatSeconds(summary.p90Ms)}`,
    `- Max: ${formatSeconds(summary.maxMs)}`,
    '',
    `## Slowest ${summary.slowest.length} command${summary.slowest.length === 1 ? '' : 's'}`,
    '',
    ...renderMarkdownTable(
      ['Rank', 'Duration', 'Exit', 'Command'],
      summary.slowest.map((entry, index) => [String(index + 1), formatSeconds(entry.durationMs), entry.exitCode === null ? '-' : String(entry.exitCode), truncateCommand(entry.command)])
    )
  ]
  return `${lines.join('\n')}\n`
}

const fetchRunPayload = (runId: string): CiRunPayload => {
  const output = runSyncCommandOrThrow('gh', ['run', 'view', runId, '--json', CI_RUN_VIEW_FIELDS], {
    env: childEnv({ allow: ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_HOST', 'GH_REPO'] }),
    maxBuffer: 64 * 1024 * 1024
  })
  const parsed = JSON.parse(output) as unknown
  if (!isObjectLike(parsed)) throw UsageError(`gh run view ${runId} did not return a JSON object.`)
  return parsed as CiRunPayload
}

const readRunPayload = async (path: string): Promise<CiRunPayload> => {
  const parsed = await Bun.file(path).json() as unknown
  if (!isObjectLike(parsed) || !Array.isArray(parsed['jobs'])) throw UsageError(`Expected a gh run view JSON payload with a jobs array at ${path}.`)
  return parsed as CiRunPayload
}

const parseTop = (value: string | undefined): number => {
  if (value === undefined) return DEFAULT_TOP
  const top = Number(value)
  if (!Number.isInteger(top) || top < 1) throw UsageError(`Expected --top to be a positive integer, received ${value}.`)
  return top
}

const USAGE = [
  'Usage:',
  '  bun src/tools/ci-run-timings.ts run <run-id> [--job <substring>] [--json-file <path>] [--save-json <path>]',
  '  bun src/tools/ci-run-timings.ts price <metrics.ndjson> [--top <count>]',
  '',
  `run reads a GitHub Actions run through gh run view --json ${CI_RUN_VIEW_FIELDS} (or --json-file) and prints per-job and per-step timings with the critical path.`,
  'price reads the test runner metrics NDJSON left by bun t --price --no-cleanup and prints count, sum, percentiles, and the slowest commands.'
].join('\n')

export const runCiRunTimingsCli = async (argv: string[]): Promise<string> => {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      job: { type: 'string' },
      'json-file': { type: 'string' },
      'save-json': { type: 'string' },
      top: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })
  if (values.help) return USAGE
  const [subcommand, target, ...extra] = positionals
  if (extra.length > 0) throw UsageError(`Unexpected arguments: ${extra.join(' ')}\n${USAGE}`)
  if (subcommand === 'run') {
    if (target === undefined || !/^\d+$/.test(target)) throw UsageError(`Expected a numeric run id after run.\n${USAGE}`)
    if (values.top !== undefined) throw UsageError('--top applies only to the price subcommand.')
    const payload = values['json-file'] === undefined ? fetchRunPayload(target) : await readRunPayload(values['json-file'])
    if (values['save-json'] !== undefined) {
      const savePath = resolve(values['save-json'])
      await mkdir(dirname(savePath), { recursive: true })
      await Bun.write(savePath, `${JSON.stringify(payload, null, 2)}\n`)
    }
    return renderRunTimingsMarkdown(summarizeRunTimings(payload, { id: target }), values.job === undefined ? {} : { job: values.job })
  }
  if (subcommand === 'price') {
    if (target === undefined) throw UsageError(`Expected a metrics NDJSON path after price.\n${USAGE}`)
    for (const flag of ['job', 'json-file', 'save-json'] as const) {
      if (values[flag] !== undefined) throw UsageError(`--${flag} applies only to the run subcommand.`)
    }
    const file = Bun.file(target)
    if (!await file.exists()) throw UsageError(`Metrics file not found: ${target}`)
    const records = parseJsonlBytes(await file.bytes(), { allowTornFinalRecord: true, label: `Metrics file ${target}` })
    return renderPriceMetricsMarkdown(summarizePriceMetrics(records, parseTop(values.top)), target)
  }
  throw UsageError(`Expected run or price as the first argument.\n${USAGE}`)
}

if (import.meta.main) console.log((await runCiRunTimingsCli(Bun.argv.slice(2))).trimEnd())
