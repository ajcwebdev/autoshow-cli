import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import type { CiRunPayload } from '~/types'
import {
  CI_RUN_VIEW_FIELDS,
  formatClockDuration,
  renderMarkdownTable,
  renderPriceMetricsMarkdown,
  renderRunTimingsMarkdown,
  summarizePriceMetrics,
  summarizeRunTimings
} from '~/tools/ci-run-timings'
import { parseJsonlBytes } from '~/utils/jsonl-reader'
import runFixture from './ci-run-timings-fixture-run.json'

const runFixturePath = resolve(import.meta.dir, 'ci-run-timings-fixture-run.json')
const metricsFixturePath = resolve(import.meta.dir, 'ci-run-timings-fixture-metrics.ndjson')
const payload = runFixture as CiRunPayload

const tableBlocks = (markdown: string): string[][] => {
  const blocks: string[][] = []
  let current: string[] = []
  for (const line of markdown.split('\n')) {
    if (line.startsWith('|')) {
      current.push(line)
    } else if (current.length > 0) {
      blocks.push(current)
      current = []
    }
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

const runTool = async (...args: string[]): Promise<{ exitCode: number, stdout: string, stderr: string }> => {
  const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/ci-run-timings.ts', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

describe('CI run timings contracts', () => {
  test('run summaries measure steps, job walls, run wall, and skip conclusions from gh run view payloads', () => {
    const summary = summarizeRunTimings(payload, { id: '34781574577' })
    const verify = summary.jobs.find(job => job.name === 'No-cost verification')
    const hygiene = summary.jobs.find(job => job.name === 'Package hygiene')
    const skipped = summary.jobs.filter(job => job.conclusion === 'skipped')

    expect(summary.run).toEqual({
      id: '34781574577',
      url: 'https://github.com/ajcwebdev/autoshow-cli/actions/runs/34781574577',
      event: 'pull_request',
      branch: 'staging',
      sha: '58018562b694196fbc8c4c68d5525c743b39b71f',
      wallMs: 127_000
    })
    expect(verify?.startOffsetMs).toBe(3_000)
    expect(verify?.durationMs).toBe(123_000)
    expect(verify?.steps.find(step => step.name === 'Run repository checks')).toEqual({ name: 'Run repository checks', durationMs: 73_000, shareOfJob: 73 / 123 })
    expect(verify?.steps.map(step => step.name)).toContain('Install local image composition dependency')
    expect(hygiene?.durationMs).toBe(8_000)
    expect(skipped).toHaveLength(2)
    for (const job of skipped) {
      expect(job.durationMs).toBe(0)
      expect(job.steps).toEqual([])
    }
  })

  test('critical path walks back from the last-finishing completed job', () => {
    const summary = summarizeRunTimings(payload)
    expect(summary.criticalPath).toEqual([{ job: 'No-cost verification', durationMs: 123_000 }])

    const chained = summarizeRunTimings({
      createdAt: '2026-09-13T20:00:00Z',
      updatedAt: '2026-09-13T20:10:00Z',
      jobs: [
        { name: 'verify', conclusion: 'success', startedAt: '2026-09-13T20:00:00Z', completedAt: '2026-09-13T20:02:00Z', steps: [] },
        { name: 'hygiene', conclusion: 'success', startedAt: '2026-09-13T20:00:00Z', completedAt: '2026-09-13T20:00:10Z', steps: [] },
        { name: 'build', conclusion: 'success', startedAt: '2026-09-13T20:02:05Z', completedAt: '2026-09-13T20:08:00Z', steps: [] },
        { name: 'late-skip', conclusion: 'skipped', startedAt: '2026-09-13T20:09:00Z', completedAt: '2026-09-13T20:08:59Z', steps: [] },
        { name: 'accept', conclusion: 'success', startedAt: '2026-09-13T20:08:10Z', completedAt: '2026-09-13T20:09:00Z', steps: [] }
      ]
    })
    expect(chained.criticalPath.map(entry => entry.job)).toEqual(['verify', 'build', 'accept'])
    expect(chained.criticalPath.reduce((sum, entry) => sum + entry.durationMs, 0)).toBe(120_000 + 355_000 + 50_000)
  })

  test('rendered tables pad every row to the same width, align the delimiter row, and escape pipes', () => {
    const markdown = renderRunTimingsMarkdown(summarizeRunTimings(payload, { id: '34781574577' }))
    expect(markdown).toContain('- Wall: 2m 7s (127000 ms from createdAt to updatedAt)')
    expect(markdown).toContain('| Run repository checks                      | 1m 13s   | 59.3% |')
    expect(markdown).toContain('1. No-cost verification: 2m 3s')
    expect(markdown).toContain('Total: 2m 3s (123000 ms across 1 job)')

    const blocks = tableBlocks(markdown)
    expect(blocks).toHaveLength(3)
    for (const block of blocks) {
      const [header, delimiter, ...rows] = block
      expect(rows.length).toBeGreaterThan(0)
      const width = header?.length ?? 0
      expect(delimiter).toMatch(/^\| -+( \| -+)* \|$/)
      expect(delimiter?.length).toBe(width)
      expect(delimiter?.split('|').map(cell => cell.length)).toEqual(header?.split('|').map(cell => cell.length))
      for (const row of rows) expect(row.length).toBe(width)
    }

    const filtered = renderRunTimingsMarkdown(summarizeRunTimings(payload), { job: 'hygiene' })
    expect(tableBlocks(filtered)).toHaveLength(2)
    expect(filtered).toContain('## Package hygiene steps')
    expect(filtered).not.toContain('## No-cost verification steps')

    expect(renderMarkdownTable(['Name', 'Value'], [['a|b', 'x'], ['long name', 'y']])).toEqual([
      '| Name      | Value |',
      '| --------- | ----- |',
      '| a\\|b      | x     |',
      '| long name | y     |'
    ])
    expect(formatClockDuration(0)).toBe('0s')
    expect(formatClockDuration(59_400)).toBe('59s')
    expect(formatClockDuration(73_000)).toBe('1m 13s')
  })

  test('price metrics summarize the runner NDJSON with count, percentiles, max, and slowest-first ranking', async () => {
    const records = parseJsonlBytes(await Bun.file(metricsFixturePath).bytes(), { allowTornFinalRecord: true, label: 'fixture' })
    const summary = summarizePriceMetrics(records, 3)

    expect(summary.count).toBe(5)
    expect(summary.totalMs).toBe(23_750)
    expect(summary.p50Ms).toBe(1_200)
    expect(summary.p90Ms).toBe(18_450)
    expect(summary.maxMs).toBe(18_450)
    expect(summary.slowest).toHaveLength(3)
    expect(summary.slowest[0]).toEqual({
      command: 'src/cli/create-cli.ts extract https://ajcwebdev.com --provider supadata --price',
      durationMs: 18_450,
      exitCode: 0
    })
    expect(summary.slowest.map(entry => entry.durationMs)).toEqual([18_450, 2_500, 1_200])
    expect(summarizePriceMetrics([{ kind: 'note' }, 'text', { durationMs: 'bad' }])).toMatchObject({ count: 0, totalMs: 0, p50Ms: 0, maxMs: 0, slowest: [] })

    const markdown = renderPriceMetricsMarkdown(summary, 'metrics.ndjson')
    expect(markdown).toContain('- Commands: 5')
    expect(markdown).toContain('- p50: 1.20s')
    expect(markdown).toContain('- Max: 18.45s')
    const [table = []] = tableBlocks(markdown)
    const tableWidth = table[0]?.length ?? 0
    expect(tableWidth).toBeGreaterThan(0)
    expect(table[2]).toContain('| 1    | 18.45s   | 0    | src/cli/create-cli.ts extract https://ajcwebdev.com --provider supadata --price |')
    for (const row of table) expect(row.length).toBe(tableWidth)
  })

  test('the CLI renders both subcommands from files and rejects unknown subcommands before spawning gh', async () => {
    expect(CI_RUN_VIEW_FIELDS).toBe('jobs,conclusion,createdAt,updatedAt,event,headBranch,headSha,url,workflowName,displayTitle')

    const run = await runTool('run', '34781574577', '--json-file', runFixturePath, '--job', 'No-cost')
    expect(run.exitCode).toBe(0)
    expect(run.stdout).toContain('# CI run timings for run 34781574577')
    expect(run.stdout).toContain('| Run repository checks                      | 1m 13s   | 59.3% |')
    expect(run.stdout).not.toContain('## Package hygiene steps')

    const price = await runTool('price', metricsFixturePath, '--top', '2')
    expect(price.exitCode).toBe(0)
    expect(price.stdout).toContain('## Slowest 2 commands')
    expect(price.stdout).toContain('--provider supadata --price')

    const unknown = await runTool('bogus')
    expect(unknown.exitCode).not.toBe(0)
    expect(unknown.stderr).toContain('Expected run or price as the first argument.')

    const nonNumeric = await runTool('run', 'latest', '--json-file', runFixturePath)
    expect(nonNumeric.exitCode).not.toBe(0)
    expect(nonNumeric.stderr).toContain('Expected a numeric run id after run.')
  })
})
