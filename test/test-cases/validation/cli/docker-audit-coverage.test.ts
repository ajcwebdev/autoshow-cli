import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { selectDockerAuditTargets } from '~/tools/docker-audit-coverage'
import { HTTP_PAYLOAD_CLASS_BYTES } from '~/utils/http-payload'

const sha = 'a'.repeat(40), otherSha = 'b'.repeat(40)
const context = { event: 'push', ref: 'refs/heads/main', repository: 'Owner/AutoShow-CLI', sha, token: 'test-token', imageChanged: true }
const workflow = { id: 100, path: '.github/workflows/docker-publish.yml', state: 'active' }
const run = { id: 200, workflow_id: 100, path: workflow.path, head_sha: sha, event: 'push', head_branch: 'main', run_attempt: 1, status: 'in_progress', conclusion: null as string | null, repository: { full_name: context.repository }, head_repository: { full_name: context.repository } }
const jobs = ['amd64', 'arm64'].map((arch, index) => ({
  id: 300 + index, run_id: run.id, head_sha: sha, name: `Audit ${arch.toUpperCase()} image`, status: 'completed', conclusion: 'success',
  started_at: '2026-10-19T12:00:00Z', completed_at: '2026-10-19T12:02:00Z'
}))
const artifacts = ['amd64', 'arm64'].map((arch, index) => ({
  id: 400 + index, name: `docker-audit-${arch}`, size_in_bytes: 1024, expired: false, digest: `sha256:${String(index).repeat(64)}`,
  workflow_run: { id: run.id, head_sha: sha, head_branch: 'main' }, created_at: '2026-10-19T12:01:59Z'
}))
type Metadata = { workflow: unknown; runs: unknown[]; jobs: unknown[]; artifacts: unknown[] }
const fixture = (): Metadata => structuredClone({ workflow, runs: [run], jobs, artifacts })
type Overrides = Parameters<typeof selectDockerAuditTargets>[0]

test('standalone target selection emits CI outputs without installed packages or provider credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-audit-selector-'))
  try {
    const root = resolve(import.meta.dir, '../../../..')
    for (const path of [
      'tsconfig.json', 'src/tools/docker-audit-coverage.ts', 'src/utils/error-handler.ts',
      'src/utils/app-logger/result-emitter.ts', 'src/utils/app-logger/redaction.ts',
      'src/utils/project-root.ts', 'src/utils/value-helpers.ts',
      'src/utils/http-payload.ts', 'src/utils/timeouts.ts'
    ]) await Bun.write(join(directory, path), await Bun.file(join(root, path)).bytes())
    const output = join(directory, 'github-output')
    const result = Bun.spawnSync([process.execPath, '--no-env-file', '--no-install', 'src/tools/docker-audit-coverage.ts'], {
      cwd: directory,
      env: { PATH: process.env['PATH'] ?? '', HOME: directory, GITHUB_EVENT_NAME: 'pull_request', IMAGE_CHANGED: 'true', GITHUB_OUTPUT: output },
      stdout: 'pipe', stderr: 'pipe'
    })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stderr.toString()).toBe('')
    expect(JSON.parse(result.stdout.toString())).toEqual({ targets: ['production', 'alignment'], reason: 'Independent event or no image change' })
    expect(await Bun.file(output).text()).toBe('targets=["production","alignment"]\n')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

async function select(metadata: Metadata | ((attempt: number) => Metadata), overrides: Partial<Overrides> = {}, errorStatus?: number,
  options: Pick<NonNullable<Parameters<typeof selectDockerAuditTargets>[1]>, 'waitMs' | 'intervalMs'> = { waitMs: 30, intervalMs: 10 }) {
  let clock = 0, attempts = 0
  const requests: string[] = [], sleeps: number[] = []
  const selected = await selectDockerAuditTargets({ ...context, ...overrides }, {
    ...options, now: () => clock,
    sleep: async milliseconds => { sleeps.push(milliseconds); clock += milliseconds; attempts++ },
    fetch: async (input, init) => {
      const url = new URL(input)
      requests.push(url.pathname + url.search)
      expect(url.origin).toBe('https://api.github.com')
      expect(init.method).toBe('GET')
      expect(init.redirect).toBe('error')
      expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' })
      if (errorStatus) return new Response('{}', { status: errorStatus })
      const current = typeof metadata === 'function' ? metadata(attempts) : metadata
      if (url.pathname.endsWith('/workflows/docker-publish.yml')) return Response.json(current.workflow)
      if (url.pathname.endsWith('/runs')) {
        expect(url.searchParams.get('head_sha')).toBe(sha)
        expect(url.searchParams.get('branch')).toBe('main')
        expect(url.searchParams.get('event')).toBe('push')
        return Response.json({ total_count: current.runs.length, workflow_runs: current.runs })
      }
      if (url.pathname.endsWith('/jobs')) return Response.json({ total_count: current.jobs.length, jobs: current.jobs })
      if (url.pathname.endsWith('/artifacts')) return Response.json({ total_count: current.artifacts.length, artifacts: current.artifacts })
      throw new Error(`Unexpected metadata path: ${url.pathname}`)
    }
  })
  return { selected, requests, sleeps, clock }
}

test('completed native audit jobs and both same-commit artifacts remove only the production duplicate without waiting for acceptance', async () => {
  const result = await select(fixture())
  expect(result.selected).toEqual({ targets: ['alignment'], reason: 'Both native release audits passed with retained same-commit artifacts', releaseRunId: run.id })
  expect(result.sleeps).toEqual([])
  expect(result.requests).toHaveLength(4)
  expect(result.requests.find(path => path.includes('/jobs'))).toContain('/attempts/1/jobs')
})

test('PR, schedule, manual dispatch, other branches, unchanged images, and missing context preserve both native targets without API access', async () => {
  for (const overrides of [
    { event: 'pull_request' }, { event: 'schedule' }, { event: 'workflow_dispatch' }, { ref: 'refs/heads/staging' },
    { imageChanged: false }, { repository: '' }, { sha: otherSha.slice(1) }, { token: undefined }, { apiUrl: 'invalid-url' }, { apiUrl: 'http://api.github.com' }
  ]) {
    const result = await select(fixture(), overrides)
    expect(result.selected.targets).toEqual(['production', 'alignment'])
    expect(result.requests).toEqual([])
  }
})

test('disabled, missing, denied, malformed, failed, cancelled, and skipped release coverage retains independent production audits', async () => {
  for (const state of ['disabled_manually', 'disabled_inactivity', 'deleted']) {
    const metadata = fixture(); metadata.workflow = { ...workflow, state }
    expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
  }
  for (const status of [403, 404, 500]) {
    const result = await select(fixture(), {}, status)
    expect(result.selected.targets).toEqual(['production', 'alignment'])
    expect(result.sleeps).toEqual([])
  }
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out']) {
    const metadata = fixture(); metadata.runs = [{ ...run, status: 'completed', conclusion }]
    const result = await select(metadata)
    expect(result.selected.targets).toEqual(['production', 'alignment'])
    expect(result.sleeps).toEqual([])
    const audit = fixture(); audit.jobs = [{ ...jobs[0], conclusion }, jobs[1]]
    expect((await select(audit)).selected.targets).toEqual(['production', 'alignment'])
  }
  const malformed = fixture(); malformed.jobs = [null]
  expect((await select(malformed)).selected.targets).toEqual(['production', 'alignment'])
})

test('missing or in-progress release audits wait only within the audit budget and can recover before acceptance completes', async () => {
  for (const unavailable of ['run', 'audit', 'artifact']) {
    const pending = fixture()
    if (unavailable === 'run') pending.runs = []
    if (unavailable === 'audit') pending.jobs = [{ ...jobs[0], status: 'in_progress', conclusion: null }, jobs[1]]
    if (unavailable === 'artifact') pending.artifacts = [artifacts[0]]
    const waiting = await select(pending)
    expect(waiting.selected.targets).toEqual(['production', 'alignment'])
    expect(waiting.selected.reason).toBe('No complete release audit coverage within the bounded wait')
    expect(waiting.clock).toBe(30)
    // The deadline is terminal: there is no last-millisecond request after the final sleep.
    expect(waiting.requests.filter(path => path.includes('/runs?'))).toHaveLength(3)
    const recovered = await select(attempt => attempt === 0 ? pending : fixture())
    expect(recovered.selected.targets).toEqual(['alignment'])
    expect(recovered.sleeps).toEqual([10])
  }
})

test('the default production lookup covers the observed 213-second release readiness with polling margin', async () => {
  const pending = fixture()
  pending.jobs = jobs.map(job => ({ ...job, status: 'in_progress', conclusion: null }))
  pending.artifacts = []
  // Run 39966902310 lookup began 14:07:24Z; run 39966902349's final native audit ended 14:10:57Z.
  const result = await select(attempt => attempt * 15_000 >= 213_000 ? fixture() : pending, {}, undefined, { intervalMs: 15_000 })
  expect(result.selected).toEqual({ targets: ['alignment'], reason: 'Both native release audits passed with retained same-commit artifacts', releaseRunId: run.id })
  expect(result.clock).toBe(225_000)
  expect(result.sleeps).toEqual(Array(15).fill(15_000))
})

test('the production lookup remains bounded inside the unchanged five-minute job for slow releases and oversized overrides', async () => {
  const source = await Bun.file(resolve(import.meta.dir, '../../../../.github/workflows/dependency-graphs.yml')).text()
  const configuration = Bun.YAML.parse(source) as { jobs: Record<string, { 'timeout-minutes': number }> }
  const jobTimeoutMinutes = configuration.jobs['image-targets']?.['timeout-minutes']
  expect(jobTimeoutMinutes).toBe(5)
  const pending = fixture()
  pending.jobs = []
  pending.artifacts = []
  for (const options of [{ intervalMs: 15_000 }, { waitMs: 3_600_000, intervalMs: 15_000 }]) {
    const result = await select(pending, {}, undefined, options)
    expect(result.selected).toEqual({ targets: ['production', 'alignment'], reason: 'No complete release audit coverage within the bounded wait' })
    expect(result.clock).toBe(255_000)
    expect(result.requests.filter(path => path.includes('/runs?'))).toHaveLength(17)
    expect(Number(jobTimeoutMinutes) * 60_000 - result.clock).toBe(45_000)
  }
})

test('an expired or disabled lookup budget retains both targets without issuing another request', async () => {
  let requests = 0
  const selected = await selectDockerAuditTargets(context, {
    waitMs: 0,
    fetch: async () => { requests++; return Response.json(workflow) }
  })
  expect(requests).toBe(0)
  expect(selected).toEqual({ targets: ['production', 'alignment'], reason: 'No complete release audit coverage within the bounded wait' })
})

test('a real HTTP response body is aborted at the total deadline and reported as bounded-wait expiry', async () => {
  let requests = 0
  let requestSignal: AbortSignal | null = null
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch: () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')) }
    }), { headers: { 'content-type': 'application/json' } })
  })
  const started = Date.now()
  try {
    const selected = await selectDockerAuditTargets(context, {
      waitMs: 40,
      fetch: async (input, init) => {
        requests++
        requestSignal = init.signal as AbortSignal
        return fetch(new URL(new URL(input).pathname, server.url), init)
      }
    })
    expect(selected).toEqual({ targets: ['production', 'alignment'], reason: 'No complete release audit coverage within the bounded wait' })
    expect(requests).toBe(1)
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true)
    expect(Date.now() - started).toBeLessThan(1000)
  } finally {
    await server.stop(true)
  }
})

test('a transport failure before the total deadline remains distinguishable from exhausted coverage wait', async () => {
  const selected = await selectDockerAuditTargets(context, {
    waitMs: 1000,
    fetch: async () => { throw new Error('connection refused') }
  })
  expect(selected).toEqual({ targets: ['production', 'alignment'], reason: 'Release metadata unavailable; independent production audit retained' })
})

test('oversized release metadata is cancelled under the shared control-payload ceiling before another request', async () => {
  let requests = 0, cancelled = false
  const selected = await selectDockerAuditTargets(context, {
    waitMs: 1000,
    fetch: async () => {
      requests++
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(workflow))) },
        cancel() { cancelled = true }
      }), { headers: { 'content-length': String(HTTP_PAYLOAD_CLASS_BYTES.control + 1) } })
    }
  })
  expect(selected).toEqual({ targets: ['production', 'alignment'], reason: 'Release metadata unavailable; independent production audit retained' })
  expect(requests).toBe(1)
  expect(cancelled).toBe(true)
})

test('successful metadata reads and early transport failures clear their request deadline timers', async () => {
  const signals: AbortSignal[] = []
  for (const fail of [false, true]) {
    const selected = await selectDockerAuditTargets(context, {
      waitMs: 40,
      fetch: async (_input, init) => {
        signals.push(init.signal as AbortSignal)
        if (fail) throw new Error('connection refused')
        return Response.json({ ...workflow, state: 'disabled_manually' })
      }
    })
    expect(selected.targets).toEqual(['production', 'alignment'])
  }
  await Bun.sleep(80)
  expect(signals).toHaveLength(2)
  expect(signals.every(signal => !signal.aborted)).toBe(true)
})

test('both artifact identities must match this run, source, native job attempt, and retention state', async () => {
  for (const index of [0, 1]) for (const mutation of [
    { expired: true }, { id: 0 }, { size_in_bytes: 0 }, { digest: 'bad' },
    { workflow_run: { id: run.id + 1, head_sha: sha, head_branch: 'main' } },
    { workflow_run: { id: run.id, head_sha: otherSha, head_branch: 'main' } },
    { workflow_run: { id: run.id, head_sha: sha, head_branch: 'staging' } },
    { created_at: '2026-10-19T11:00:00Z' }, { created_at: '2026-10-19T13:00:00Z' }
  ]) {
    const metadata = fixture()
    metadata.runs = [{ ...run, status: 'completed', conclusion: 'success' }]
    metadata.artifacts[index] = { ...artifacts[index], ...mutation }
    expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
  }
})

test('neither architecture can omit production with an unfinished or mismatched native audit job', async () => {
  for (const index of [0, 1]) for (const mutation of [
    { status: 'in_progress', conclusion: null }, { status: 'queued', conclusion: null },
    { head_sha: otherSha }, { run_id: run.id + 1 }, { name: 'Audit emulated image' }
  ]) {
    const metadata = fixture()
    metadata.runs = [{ ...run, status: 'completed', conclusion: 'success' }]
    metadata.jobs[index] = { ...jobs[index], ...mutation }
    expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
  }
})

test('wrong run source or event, ambiguous audit identities, and missing completed artifacts never suppress production', async () => {
  for (const mutation of [
    { head_sha: otherSha }, { event: 'pull_request' }, { head_branch: 'staging' }, { workflow_id: 101 }, { path: '.github/workflows/other.yml' },
    { repository: { full_name: 'fork/AutoShow-CLI' } }, { head_repository: { full_name: 'fork/AutoShow-CLI' } }
  ]) {
    const metadata = fixture(); metadata.runs = [{ ...run, ...mutation }]
    expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
  }
  for (const duplicate of ['jobs', 'artifacts'] as const) {
    const metadata = fixture(); metadata[duplicate].push(metadata[duplicate][0])
    expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
  }
  const metadata = fixture(); metadata.runs = [{ ...run, status: 'completed', conclusion: 'success' }]; metadata.artifacts = []
  expect((await select(metadata)).selected.targets).toEqual(['production', 'alignment'])
})

test('incomplete API pages and transport/JSON failures preserve independent production auditing', async () => {
  for (const body of [{ total_count: 2, workflow_runs: [run] }, '{invalid']) {
    const selected = await selectDockerAuditTargets(context, { waitMs: 1000, fetch: async input => input.endsWith('/docker-publish.yml') ? Response.json(workflow) : typeof body === 'string' ? new Response(body) : Response.json(body) })
    expect(selected.targets).toEqual(['production', 'alignment'])
    expect(selected.reason).toBe('Release metadata unavailable; independent production audit retained')
  }
  const selected = await selectDockerAuditTargets(context, { fetch: async () => { throw new Error('unavailable metadata') } })
  expect(selected.targets).toEqual(['production', 'alignment'])
})
