import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '../../../..')
const imageHelper = resolve(root, 'src/tools/docker-image-name.sh')
const loginAction = resolve(root, '.github/actions/ghcr-login/action.yml')
type Step = { uses?: string; run?: string; shell?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown> }
type Job = { permissions?: Record<string, string>; steps?: Step[] }

const normalize = (repository: string | undefined, args: string[] = []) => Bun.spawnSync(['bash', imageHelper, ...args], {
  env: { PATH: process.env['PATH'] ?? '', ...(repository === undefined ? {} : { GITHUB_REPOSITORY: repository }) },
  stdout: 'pipe', stderr: 'pipe'
})

test('shared image naming preserves valid fork/rename identities and Docker path-component separators', () => {
  for (const [repository, expected] of [
    ['Owner/AutoShow-CLI', 'ghcr.io/owner/autoshow-cli'],
    ['Different-Owner/Renamed_Repo', 'ghcr.io/different-owner/renamed_repo'],
    ['TEAM7/Repo__With--Separators.V2', 'ghcr.io/team7/repo__with--separators.v2']
  ]) {
    const result = normalize(repository)
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString()).toBe(expected + '\n')
    expect(result.stderr.toString()).toBe('')
  }
  const explicit = normalize('ignored/repository', ['New-Owner/Selected.Repo'])
  expect(explicit.exitCode).toBe(0)
  expect(explicit.stdout.toString()).toBe('ghcr.io/new-owner/selected.repo\n')
})

test('invalid repository identities fail before producing a registry reference', () => {
  for (const repository of [undefined, '', 'repo', '/repo', 'owner/', 'owner/repo/extra', 'owner/repo:tag',
    'https://ghcr.io/owner/repo', 'owner/repo@sha256:abc', 'owner/repo.', 'owner/repo___name',
    '-owner/repo', 'owner/space name', 'owner/repo\nextra', 'owner/repo\n', 'owner/$(touch sentinel)']) {
    const result = normalize(repository)
    expect(result.exitCode).toBe(2)
    expect(result.stdout.toString()).toBe('')
    expect(result.stderr.toString()).toContain('Expected a valid owner/repository')
  }
  expect(normalize('owner/repo', ['one/repo', 'two/repo']).exitCode).toBe(2)
})

test('all release registry logins share explicit job-scoped inputs without broadening package permissions', async () => {
  const source = await Bun.file(resolve(root, '.github/workflows/docker-publish.yml')).text()
  const workflow = Bun.YAML.parse(source) as { jobs: Record<string, Job> }
  const expectedPermissions: Record<string, string> = {
    'build-amd64': 'write', 'build-arm64': 'write', 'publish-manifest': 'write', 'promote-latest': 'write',
    'smoke-amd64': 'read', 'smoke-arm64': 'read', 'audit-amd64': 'read', 'audit-arm64': 'read'
  }
  let sharedLogins = 0
  for (const [name, expected] of Object.entries(expectedPermissions)) {
    const job = workflow.jobs[name]!
    expect(job.permissions).toEqual({ contents: 'read', packages: expected })
    const logins = job.steps!.filter(step => step.uses === './.github/actions/ghcr-login')
    expect(logins).toHaveLength(1)
    expect(logins[0]!.with).toEqual({ token: '${{ secrets.GITHUB_TOKEN }}', username: '${{ github.actor }}' })
    sharedLogins += logins.length
  }
  expect(sharedLogins).toBe(8)
  expect(source).not.toContain('docker login ghcr.io')
  const graphs = Bun.YAML.parse(await Bun.file(resolve(root, '.github/workflows/dependency-graphs.yml')).text()) as { jobs: Record<string, Job> }
  const checkouts = Object.values(graphs.jobs).flatMap(job => job.steps ?? []).filter(step => step.uses?.startsWith('actions/checkout@'))
  expect(checkouts.length).toBeGreaterThan(0)
  for (const checkout of checkouts) expect(checkout.with?.['persist-credentials']).toBe(false)
})

test('only the acceptance host uses the measured production graph; verification keeps its compiler dependencies', async () => {
  const workflow = Bun.YAML.parse(await Bun.file(resolve(root, '.github/workflows/docker-publish.yml')).text()) as { jobs: Record<string, Job> }
  const acceptance = workflow.jobs['acceptance']!.steps!
  const installation = acceptance.find(step => step.run?.startsWith('bun --no-env-file install'))
  expect(installation?.run).toBe('bun --no-env-file install --frozen-lockfile --production --omit=peer')
  const execution = acceptance.find(step => step.run?.includes('bun t:docker'))?.run
  expect(execution).toContain('--user "$(id -u):$(id -g)"')
  expect(acceptance.some(step => step.run?.includes('chown'))).toBe(false)
  for (const name of ['verify', 'package-hygiene']) {
    const installs = workflow.jobs[name]!.steps!.filter(step => step.run?.includes('install --frozen-lockfile'))
    expect(installs.length).toBeGreaterThan(0)
    for (const step of installs) expect(step.run).not.toContain('--production')
  }
})

test('all CI builders share the reviewed security release pins and native runtime gates keep their inspected image', async () => {
  const pin = { version: 'v0.38.1', 'driver-opts': 'image=moby/buildkit:v0.34.1@sha256:99368f3e46177c6405b9740e4461d91cee004128daeecca78d4ceac50ec1da5c' }
  let builders = 0
  for (const file of ['.github/workflows/docker-publish.yml', '.github/workflows/dependency-graphs.yml']) {
    const workflow = Bun.YAML.parse(await Bun.file(resolve(root, file)).text()) as { jobs: Record<string, Job> }
    for (const job of Object.values(workflow.jobs)) for (const step of job.steps ?? []) {
      if (step.uses?.startsWith('docker/setup-buildx-action@')) { expect(step.with).toMatchObject(pin); builders++ }
    }
  }
  const buildAction = Bun.YAML.parse(await Bun.file(resolve(root, '.github/actions/build-native-image/action.yml')).text()) as { runs: { steps: Step[] } }
  for (const step of buildAction.runs.steps) if (step.uses?.startsWith('docker/setup-buildx-action@')) { expect(step.with).toMatchObject(pin); builders++ }
  expect(builders).toBe(4)
  const audit = Bun.YAML.parse(await Bun.file(resolve(root, '.github/actions/audit-native-image/action.yml')).text()) as { runs: { steps: Step[] } }
  const auditGate = audit.runs.steps.find(step => step.run?.includes('docker-runtime-state-acceptance.ts'))
  expect(auditGate?.run).toContain('--image "${DEPENDENCY_SCAN_IMAGE}"')
  expect(auditGate?.run).toContain('--output "runtime/ci/docker-${ARCH}/runtime-state"')
  expect(audit.runs.steps.find(step => step.run?.startsWith('bun --no-env-file install'))?.run)
    .toBe('bun --no-env-file install --frozen-lockfile --production --omit=peer')
  const dependency = Bun.YAML.parse(await Bun.file(resolve(root, '.github/workflows/dependency-graphs.yml')).text()) as { jobs: Record<string, Job> }
  const steps = dependency.jobs['images']!.steps!
  const dependencies = steps.findIndex(step => step.run?.startsWith('bun --no-env-file install'))
  const stateGate = steps.findIndex(step => step.run?.includes('docker-runtime-state-acceptance.ts'))
  const tesseractGate = steps.findIndex(step => step.run?.includes('docker-tesseract-data-acceptance.ts'))
  expect(dependencies).toBeGreaterThan(-1)
  expect(dependencies).toBeLessThan(tesseractGate)
  expect(dependencies).toBeLessThan(stateGate)
  expect(steps[stateGate]?.run).toContain('--image "autoshow-audit:${{ github.sha }}"')
  expect(steps[stateGate]?.if).toBeUndefined()
})

test('the real composite login shell sends its token only through stdin and rejects absent inputs before Docker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-workflow-login-'))
  try {
    const bin = join(directory, 'bin'), capture = join(directory, 'capture.json')
    await mkdir(bin)
    const docker = join(bin, 'docker')
    await Bun.write(docker, '#!/bin/sh\nexec "$WORKFLOW_TEST_BUN" "$WORKFLOW_TEST_CAPTURE" "$@"\n')
    await chmod(docker, 0o755)
    const captureScript = join(directory, 'capture.ts')
    await Bun.write(captureScript, 'await Bun.write(process.env["WORKFLOW_TEST_OUTPUT"]!,JSON.stringify({args:Bun.argv.slice(2),stdin:await Bun.stdin.text()})); console.log("Login Succeeded");')
    const action = Bun.YAML.parse(await Bun.file(loginAction).text()) as { inputs: Record<string, { required: boolean }>; runs: { using: string; steps: Step[] } }
    expect(action.runs.using).toBe('composite')
    expect(action.inputs['token']?.required).toBe(true)
    expect(action.inputs['username']?.required).toBe(true)
    const step = action.runs.steps[0]!
    expect(step.shell).toBe('bash')
    expect(step.env).toEqual({ GHCR_TOKEN: '${{ inputs.token }}', GHCR_USERNAME: '${{ inputs.username }}' })
    const token = 'fixture-only-token', username = 'owner'
    const env = { PATH: `${bin}:${process.env['PATH'] ?? ''}`, WORKFLOW_TEST_BUN: process.execPath,
      WORKFLOW_TEST_CAPTURE: captureScript, WORKFLOW_TEST_OUTPUT: capture, GHCR_TOKEN: token, GHCR_USERNAME: username }
    const success = Bun.spawnSync(['bash', '-c', step.run!], { env, stdout: 'pipe', stderr: 'pipe' })
    expect(success.exitCode, success.stderr.toString()).toBe(0)
    expect(await Bun.file(capture).json()).toEqual({ args: ['login', 'ghcr.io', '--username', username, '--password-stdin'], stdin: token })
    expect(success.stdout.toString()).toBe('Login Succeeded\n')
    expect(success.stderr.toString()).toBe('')
    for (const missing of ['GHCR_TOKEN', 'GHCR_USERNAME'] as const) {
      await rm(capture)
      const failure = Bun.spawnSync(['bash', '-c', step.run!], { env: { ...env, [missing]: '' }, stdout: 'pipe', stderr: 'pipe' })
      expect(failure.exitCode).toBe(2)
      expect(failure.stdout.toString()).toBe('')
      expect(failure.stderr.toString()).toContain('Registry token and username are required')
      expect(await Bun.file(capture).exists()).toBe(false)
      await Bun.write(capture, '{}')
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('every image-normalizing consumer uses the shared validator, including candidate acceptance and native helpers', async () => {
  for (const file of ['.github/workflows/docker-publish.yml', '.github/workflows/dependency-graphs.yml',
    '.github/actions/audit-native-image/action.yml', 'src/tools/docker-release-build.sh', 'src/tools/docker-release-smoke.sh']) {
    const source = await Bun.file(resolve(root, file)).text()
    expect(source).toContain('docker-image-name.sh')
    expect(source).not.toContain("tr '[:upper:]' '[:lower:]'")
  }
})
