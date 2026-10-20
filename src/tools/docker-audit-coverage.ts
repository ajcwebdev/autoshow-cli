/** Skip an independent production rebuild only after this commit's native release audits retain evidence. */
import { appendFile } from 'node:fs/promises'
import { InfraError } from '../utils/error-handler'
import { writeCommandPayload } from '../utils/app-logger/result-emitter'

const workflowPath = '.github/workflows/docker-publish.yml'
const allTargets = ['production', 'alignment'] as const
type Target = typeof allTargets[number]
type ObjectValue = Record<string, unknown>
type CoverageContext = { event: string; ref: string; repository: string; sha: string; token?: string | undefined; apiUrl?: string | undefined; imageChanged: boolean }
export type AuditTargetSelection = { targets: Target[]; reason: string; releaseRunId?: number }
type CoverageOptions = {
  fetch?: (input: string, init: RequestInit) => Promise<Response>
  now?: () => number
  sleep?: (milliseconds: number) => Promise<unknown>
  waitMs?: number
  intervalMs?: number
}
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const fullList = (value: unknown, key: string): ObjectValue[] => {
  const body = object(value)
  const list = body[key]
  if (!Array.isArray(list) || body['total_count'] !== list.length || list.length > 100) throw InfraError('Incomplete release metadata', { stage: 'docker:audit-coverage' })
  return list.map(object)
}
const fallback = (reason: string): AuditTargetSelection => ({ targets: [...allTargets], reason })

export async function selectDockerAuditTargets(context: CoverageContext, options: CoverageOptions = {}): Promise<AuditTargetSelection> {
  if (context.event !== 'push' || context.ref !== 'refs/heads/main' || !context.imageChanged) return fallback('Independent event or no image change')
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repository) || !/^[a-f0-9]{40}$/.test(context.sha) || !context.token) return fallback('Release lookup context unavailable')
  let apiUrl: URL
  try { apiUrl = new URL(context.apiUrl ?? 'https://api.github.com') } catch { return fallback('Invalid GitHub API origin') }
  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) return fallback('Invalid GitHub API origin')
  const fetchApi = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? Bun.sleep
  const waitMs = Math.max(0, Math.min(options.waitMs ?? 180_000, 180_000))
  const intervalMs = Math.max(1, options.intervalMs ?? 15_000)
  const deadline = now() + waitMs
  const prefix = `${apiUrl.href.replace(/\/$/, '')}/repos/${context.repository}/actions`
  async function request(path: string): Promise<unknown> {
    const remaining = Math.max(1, deadline - now())
    const response = await fetchApi(`${prefix}/${path}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(Math.min(10_000, remaining)),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${context.token}`, 'X-GitHub-Api-Version': '2022-11-28' }
    })
    if (!response.ok) throw InfraError('Release metadata unavailable', { stage: 'docker:audit-coverage' })
    return response.json()
  }
  try {
    const workflow = object(await request('workflows/docker-publish.yml'))
    if (workflow['state'] !== 'active' || workflow['path'] !== workflowPath || !positiveId(workflow['id'])) return fallback('Release workflow is unavailable or inactive')
    while (true) {
      const runs = fullList(await request(`workflows/${workflow['id']}/runs?event=push&branch=main&head_sha=${context.sha}&per_page=100`), 'workflow_runs')
        .filter(run => run['head_sha'] === context.sha && run['event'] === 'push' && run['head_branch'] === 'main'
          && run['path'] === workflowPath && run['workflow_id'] === workflow['id']
          && String(object(run['repository'])['full_name']).toLowerCase() === context.repository.toLowerCase()
          && String(object(run['head_repository'])['full_name']).toLowerCase() === context.repository.toLowerCase())
      if (runs.some(run => !positiveId(run['id']) || !positiveId(run['run_attempt']))) return fallback('Invalid release run identity')
      const run = runs.sort((left, right) => Number(right['id']) - Number(left['id']))[0]
      if (run) {
        if (run['status'] === 'completed' && run['conclusion'] !== 'success') return fallback('Release run failed, skipped, or cancelled')
        const [jobsBody, artifactsBody] = await Promise.all([
          request(`runs/${run['id']}/attempts/${run['run_attempt']}/jobs?per_page=100`),
          request(`runs/${run['id']}/artifacts?per_page=100`)
        ])
        const jobs = fullList(jobsBody, 'jobs')
        const artifacts = fullList(artifactsBody, 'artifacts')
        let covered = true
        for (const arch of ['amd64', 'arm64']) {
          const auditJobs = jobs.filter(job => job['name'] === `Audit ${arch.toUpperCase()} image`)
          if (auditJobs.length > 1) return fallback('Ambiguous release audit jobs')
          const job = auditJobs[0]
          if (job?.['status'] === 'completed' && job['conclusion'] !== 'success') return fallback('Native release audit did not pass')
          if (!job || job['status'] !== 'completed' || job['conclusion'] !== 'success' || job['head_sha'] !== context.sha || job['run_id'] !== run['id']) { covered = false; continue }
          const matching = artifacts.filter(artifact => artifact['name'] === `docker-audit-${arch}`)
          if (matching.length > 1) return fallback('Ambiguous release audit artifacts')
          const artifact = matching[0]
          const artifactRun = object(artifact?.['workflow_run'])
          const created = Date.parse(String(artifact?.['created_at']))
          const started = Date.parse(String(job['started_at']))
          const completed = Date.parse(String(job['completed_at']))
          if (!artifact || !positiveId(artifact['id']) || artifact['expired'] !== false || !(Number(artifact['size_in_bytes']) > 0)
            || !/^sha256:[a-f0-9]{64}$/.test(String(artifact['digest'])) || artifactRun['id'] !== run['id']
            || artifactRun['head_sha'] !== context.sha || artifactRun['head_branch'] !== 'main'
            || !Number.isFinite(created) || !Number.isFinite(started) || !Number.isFinite(completed) || created < started || created > completed) covered = false
        }
        if (covered) return { targets: ['alignment'], reason: 'Both native release audits passed with retained same-commit artifacts', releaseRunId: Number(run['id']) }
        if (run['status'] === 'completed') return fallback('Release audit evidence is incomplete')
      }
      const remaining = deadline - now()
      if (remaining <= 0) return fallback('No complete release audit coverage within the bounded wait')
      await sleep(Math.min(intervalMs, remaining))
    }
  } catch {
    return fallback('Release metadata unavailable; independent production audit retained')
  }
}

if (import.meta.main) {
  const selection = await selectDockerAuditTargets({
    event: process.env['GITHUB_EVENT_NAME'] ?? '', ref: process.env['GITHUB_REF'] ?? '', repository: process.env['GITHUB_REPOSITORY'] ?? '',
    sha: process.env['GITHUB_SHA'] ?? '', token: process.env['GITHUB_TOKEN'], apiUrl: process.env['GITHUB_API_URL'], imageChanged: process.env['IMAGE_CHANGED'] === 'true'
  })
  if (process.env['GITHUB_OUTPUT']) await appendFile(process.env['GITHUB_OUTPUT'], `targets=${JSON.stringify(selection.targets)}\n`)
  writeCommandPayload(`${JSON.stringify(selection)}\n`)
}
