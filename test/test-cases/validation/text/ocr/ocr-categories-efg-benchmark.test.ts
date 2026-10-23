import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCategoriesBcSlotCommand, createOcrBenchmarkLanes, OCR_CATEGORIES_EFG_BENCHMARK_SCOPE } from '~/tools/ocr-categories-bc-benchmark'
import { redDotPng } from '../../../../test-utils/media-fixtures'

test('twelve independent jobs overlap while provider lanes block excess jobs and release after failures', async () => {
  const caps = { anthropic: 3, openai: 4, grok: 3, mistral: 3 }
  const lanes = createOcrBenchmarkLanes(12, caps)
  const providers = ['anthropic', 'anthropic', 'anthropic', 'openai', 'openai', 'openai', 'openai', 'grok', 'grok', 'grok', 'mistral', 'mistral']
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const started: string[] = []
  const work = providers.map(async provider => {
    const lease = lanes.acquire({ provider, model: 'fixture' })
    try { lease.commit(); started.push(provider); await gate; throw new Error('local fixture outcome') }
    finally { lease.release() }
  })
  expect(started).toHaveLength(12)
  expect(lanes.state().peak).toBe(12)
  expect(lanes.canStart({ provider: 'mistral', model: 'fixture' })).toBe(false)
  expect(() => lanes.acquire({ provider: 'openai', model: 'fixture' })).toThrow('unavailable')
  release()
  const outcomes = await Promise.allSettled(work)
  expect(outcomes.every(value => value.status === 'rejected')).toBe(true)
  expect(lanes.state().active).toBe(0)
  expect(lanes.canStart({ provider: 'openai', model: 'fixture' })).toBe(true)
})

test('provider caps apply while global capacity remains available', () => {
  const lanes = createOcrBenchmarkLanes(12, { anthropic: 3 })
  const holds = Array.from({ length: 3 }, () => lanes.acquire({ provider: 'anthropic', model: 'fixture' }))
  expect(lanes.canStart({ provider: 'anthropic', model: 'another' })).toBe(false)
  expect(lanes.canStart({ provider: 'openai', model: 'fixture' })).toBe(true)
  holds[0]!.release()
  holds[0]!.release()
  expect(lanes.canStart({ provider: 'anthropic', model: 'fixture' })).toBe(true)
  holds.slice(1).forEach(hold => hold.release())
  expect(lanes.state().active).toBe(0)
})

test('one slow model can serialize recovery while other models retain provider capacity', () => {
  const lanes = createOcrBenchmarkLanes(12, { deepinfra: 4 }, { 'deepinfra/google/gemma-4-31B-it': 1 })
  const gemma = { provider: 'deepinfra', model: 'google/gemma-4-31B-it' }
  const first = lanes.acquire(gemma)
  first.commit()
  expect(lanes.canStart(gemma)).toBe(false)
  expect(lanes.canStart({ provider: 'deepinfra', model: 'Qwen/Qwen3.8-27B' })).toBe(true)
  expect(lanes.canStart({ provider: 'openai', model: 'fixture' })).toBe(true)
  first.release()
  expect(lanes.canStart(gemma)).toBe(true)
})

test('Gemini aliases cannot race journal I/O; cached reuse consumes no rate-limit interval', () => {
  const lanes = createOcrBenchmarkLanes(12, { gemini: 4 })
  const flash = { provider: 'gemini', model: 'gemini-3.5-flash' }, alias = { provider: 'gemini', model: 'gemini-3.6-flash' }
  const cached = lanes.acquire(flash, 0)
  expect(lanes.canStart(alias, 0)).toBe(false)
  cached.release()
  expect(lanes.canStart(alias, 0)).toBe(true)
  const actual = lanes.acquire(alias, 0)
  actual.commit(0)
  expect(lanes.canStart(flash, 15_499)).toBe(false)
  const next = lanes.acquire(flash, 15_500)
  actual.release()
  expect(lanes.canStart(alias, 15_500)).toBe(false)
  next.commit(15_500)
  next.release()
  expect(lanes.canStart(alias, 31_000)).toBe(true)
  expect(() => next.commit()).toThrow('twice')
})

for (const format of ['png', 'jpg'] as const) test(`EFG ${format} slot command reaches native price-only parsing without extraction`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocr-efg-price-'))
  try {
    const input = join(root, 'fixture.' + format), output = join(root, 'not-created')
    await Bun.write(input, format === 'jpg' ? await new Bun.Image(redDotPng).jpeg().bytes() : redDotPng)
    const command = [...buildCategoriesBcSlotCommand(input, { provider: 'tesseract', model: 'tesseract' }, output, 'src/cli/create-cli.ts', OCR_CATEGORIES_EFG_BENCHMARK_SCOPE.guardPath), '--price']
    const child = Bun.spawn(command, { env: { ...process.env, AUTOSHOW_OCR_EFG_GUARD: undefined, AUTOSHOW_OCR_D_GUARD: undefined, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_SPENDING_GUARD: undefined }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(0)
    expect(stderr.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    const data = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row => row.type === 'result').data
    expect(data.dryRun).toBe(true)
    expect(data.estimate.steps.map((row: { provider: string }) => row.provider)).toEqual(['tesseract'])
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('EFG help declares exact nineteen-file approval and high concurrency before plan access', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/ocr-categories-efg-benchmark.ts', '--help'], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(code).toBe(0)
  expect(stderr).toBe('')
  expect(stdout).toContain('19-file / 19-page / 21-target')
  expect(stdout).toContain('USD 30 approval')
  expect(stdout).toContain('12 concurrent jobs')
  expect(stdout).toContain('Default is price-only')
})
