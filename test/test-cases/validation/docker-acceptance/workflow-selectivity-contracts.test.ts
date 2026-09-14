import { expect, test } from 'bun:test'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const actionDirectory = resolve(repositoryRoot, '.github/actions/detect-changes')
const classifyScript = resolve(actionDirectory, 'classify.sh')
const detectScript = resolve(actionDirectory, 'detect-changes.sh')
const CODE_GATE = "steps.changes.outputs.code == 'true'"
const IMAGE_PUSH_GATE = "github.event_name == 'push' && needs.changes.outputs.image == 'true'"

type Flags = { image: string; alignment: string; javascript_graph: string; code: string }
type Step = { name?: string; id?: string; if?: string; uses?: string; run?: string }
type Job = { needs?: string | string[]; if?: string; outputs?: Record<string, string>; steps?: Step[] }
type Workflow = { concurrency: Record<string, string>; jobs: Record<string, Job> }

const NONE: Flags = { image: 'false', alignment: 'false', javascript_graph: 'false', code: 'false' }
const CODE_ONLY: Flags = { ...NONE, code: 'true' }

function parseOutputs(stdout: string): Record<string, string> {
  return Object.fromEntries(stdout.split('\n').filter(Boolean).map(line => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
}

async function run(command: string[], options: { stdin?: string; env?: Record<string, string> } = {}) {
  const child = Bun.spawn(command, {
    cwd: repositoryRoot,
    env: { PATH: process.env['PATH'] ?? '', ...options.env },
    stdin: new TextEncoder().encode(options.stdin ?? ''),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr, outputs: parseOutputs(stdout) }
}

async function classify(paths: string[]): Promise<Flags> {
  const result = await run(['bash', classifyScript], { stdin: paths.map(path => `${path}\n`).join('') })
  expect(result.stderr).toBe('')
  expect(result.exitCode).toBe(0)
  expect(Object.keys(result.outputs).sort()).toEqual(['alignment', 'code', 'image', 'javascript_graph'])
  return result.outputs as Flags
}

async function workflow(name: string): Promise<Workflow> {
  return Bun.YAML.parse(await Bun.file(resolve(repositoryRoot, '.github/workflows', name)).text()) as Workflow
}

test('report-style documentation and root agent guidance never trigger any job', async () => {
  expect(await classify([
    'docs/benchmarks/ocr/combined-comparison-report.md',
    'docs/reports/x.md',
    'docs/todo/y.md',
    'docs/diagrams/05-x.md',
    'docs/diagrams.md',
    'AGENTS.md'
  ])).toEqual(NONE)
  expect(await classify([])).toEqual(NONE)
})

test('documentation read by verify-listed contract tests counts as code without rebuilding anything', async () => {
  for (const path of [
    'docs/docker.md',
    'docs/adr/ADR-014-distribute-the-cli-as-a-docker-image.md',
    'docs/adr/ADR-005-reduce-environment-variable-surface-area.md',
    'docs/commands/testing.md',
    'README.md',
    'test/test-cases/validation/cli/cli-help-contracts.test.ts'
  ]) {
    expect(await classify([path])).toEqual(CODE_ONLY)
  }
})

test('image inputs, alignment graph inputs, and JavaScript graph inputs are attributed separately', async () => {
  expect(await classify(['src/prompts/entries/chapters/default.md'])).toEqual({ ...CODE_ONLY, image: 'true' })
  expect(await classify(['Dockerfile'])).toEqual({ ...CODE_ONLY, image: 'true' })
  expect(await classify(['config/stt-alignment/package.json'])).toEqual({ ...CODE_ONLY, image: 'true', alignment: 'true' })
  expect(await classify(['config/defuddle/bun.lock'])).toEqual({ ...CODE_ONLY, image: 'true', javascript_graph: 'true' })
  const everything: Flags = { image: 'true', alignment: 'true', javascript_graph: 'true', code: 'true' }
  expect(await classify(['bun.lock'])).toEqual(everything)
  expect(await classify(['.github/workflows/dependency-graphs.yml'])).toEqual(everything)
  expect(await classify(['docs/reports/x.md', 'Dockerfile', 'AGENTS.md'])).toEqual({ ...CODE_ONLY, image: 'true' })
})

test('detection runs everything whenever the diff base is unknown and nothing when the diff is empty', async () => {
  const dispatch = await run(['bash', detectScript], { env: { EVENT_NAME: 'workflow_dispatch' } })
  expect(dispatch.exitCode).toBe(0)
  expect(dispatch.outputs).toMatchObject({ all: 'true', image: 'true', alignment: 'true', javascript_graph: 'true', code: 'true' })
  const initialPush = await run(['bash', detectScript], { env: { EVENT_NAME: 'push', BEFORE_SHA: '0'.repeat(40), FORCED: 'false' } })
  expect(initialPush.exitCode).toBe(0)
  expect(initialPush.outputs).toMatchObject({ all: 'true', image: 'true', code: 'true' })
  const head = (await run(['git', 'rev-parse', 'HEAD'])).stdout.trim()
  expect(head).toMatch(/^[0-9a-f]{40}$/)
  const forced = await run(['bash', detectScript], { env: { EVENT_NAME: 'push', BEFORE_SHA: head, FORCED: 'true' } })
  expect(forced.outputs).toMatchObject({ all: 'true', image: 'true', code: 'true' })
  const emptyPullRequestBase = await run(['bash', detectScript], { env: { EVENT_NAME: 'pull_request', BASE_SHA: '' } })
  expect(emptyPullRequestBase.outputs).toMatchObject({ all: 'true', image: 'true', code: 'true' })
  const unchanged = await run(['bash', detectScript], { env: { EVENT_NAME: 'push', BEFORE_SHA: head, FORCED: 'false' } })
  expect(unchanged.exitCode).toBe(0)
  expect(unchanged.outputs).toEqual({ all: 'false', reason: `diff ${head}..HEAD`, ...NONE })
})

test('the composite action exposes every classifier flag and its scripts are executable bash', async () => {
  const action = Bun.YAML.parse(await Bun.file(resolve(actionDirectory, 'action.yml')).text()) as {
    outputs: Record<string, { value: string }>
    runs: { using: string; steps: Array<{ id?: string; shell?: string; env?: Record<string, string> }> }
  }
  expect(Object.keys(action.outputs).sort()).toEqual(['alignment', 'all', 'code', 'image', 'javascript_graph'])
  for (const [name, output] of Object.entries(action.outputs)) expect(output.value).toBe(`\${{ steps.classify.outputs.${name} }}`)
  expect(action.runs.using).toBe('composite')
  const classifyStep = action.runs.steps.find(step => step.id === 'classify')
  expect(classifyStep?.shell).toBe('bash')
  expect(Object.keys(classifyStep?.env ?? {}).sort()).toEqual(['BASE_SHA', 'BEFORE_SHA', 'EVENT_NAME', 'FORCED'])
  for (const script of [classifyScript, detectScript]) {
    expect((await stat(script)).mode & 0o111).toBe(0o111)
    expect((await Bun.file(script).text()).startsWith('#!/usr/bin/env bash\n')).toBe(true)
  }
})

test('dependency graph jobs run only for the graph inputs a change touches and superseded PR runs are cancelled', async () => {
  const graphs = await workflow('dependency-graphs.yml')
  expect(graphs.concurrency).toEqual({
    group: "dependency-graphs-${{ github.event_name == 'push' && github.sha || github.ref }}",
    'cancel-in-progress': "${{ github.event_name == 'pull_request' }}"
  })
  const changes = graphs.jobs['changes']!
  expect(changes.needs).toBeUndefined()
  expect(changes.steps?.some(step => step.uses === './.github/actions/detect-changes' && step.id === 'changes')).toBe(true)
  expect(changes.outputs).toEqual({
    image: '${{ steps.changes.outputs.image }}',
    alignment: '${{ steps.changes.outputs.alignment }}',
    javascript_graph: '${{ steps.changes.outputs.javascript_graph }}'
  })
  const gates = { javascript: 'javascript_graph', alignment: 'alignment', images: 'image' }
  for (const [job, flag] of Object.entries(gates)) {
    expect(graphs.jobs[job]?.needs).toBe('changes')
    expect(graphs.jobs[job]?.if).toBe(`needs.changes.outputs.${flag} == 'true'`)
  }
})

test('Docker publication skips contract tests, builds, and acceptance for changes that cannot affect them', async () => {
  const publish = await workflow('docker-publish.yml')
  expect(publish.jobs['changes']?.outputs).toEqual({ image: '${{ steps.changes.outputs.image }}', code: '${{ steps.changes.outputs.code }}' })
  expect(publish.jobs['changes']?.steps?.some(step => step.uses === './.github/actions/detect-changes' && step.id === 'changes')).toBe(true)

  const verifySteps = publish.jobs['verify']?.steps ?? []
  const checkoutIndex = verifySteps.findIndex(step => step.uses?.startsWith('actions/checkout@'))
  const detectIndex = verifySteps.findIndex(step => step.uses === './.github/actions/detect-changes')
  expect(checkoutIndex).toBe(0)
  expect(detectIndex).toBe(checkoutIndex + 1)
  expect(verifySteps[detectIndex]?.id).toBe('changes')
  const checks = verifySteps.filter(step => step.name?.includes('repository checks'))
  expect(checks).toHaveLength(1)
  expect(checks[0]?.if).toBeUndefined()
  const contracts = verifySteps.filter(step => step.name?.includes('contracts'))
  expect(contracts.length).toBeGreaterThan(0)
  for (const step of contracts) expect(step.if).toBe(CODE_GATE)
  for (const step of verifySteps) {
    if (step.if === CODE_GATE) expect(step.name?.includes('contracts')).toBe(true)
  }

  for (const job of ['build-amd64', 'build-arm64']) {
    expect(publish.jobs[job]?.needs).toEqual(['changes'])
    expect(publish.jobs[job]?.if).toBe(IMAGE_PUSH_GATE)
  }
  expect(publish.jobs['acceptance-required']?.needs).toEqual(['changes', 'publish-manifest', 'acceptance'])
  expect(publish.jobs['acceptance-required']?.if).toBe(`always() && ${IMAGE_PUSH_GATE}`)

  const docs = await Bun.file(resolve(repositoryRoot, 'docs/docker.md')).text()
  expect(docs).toContain('docs-only pushes keep the previous `latest`')
})
