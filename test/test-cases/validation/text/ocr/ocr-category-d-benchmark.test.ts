import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCategoriesBcSlotCommand, OCR_CATEGORY_D_BENCHMARK_SCOPE } from '~/tools/ocr-categories-bc-benchmark'
import { redDotPng } from '../../../../test-utils/media-fixtures'

for (const target of [{ provider: 'openai', model: 'gpt-6-luna' }, { provider: 'tesseract', model: 'tesseract' }]) test(`advertisement JPEG ${target.provider} slot reaches native price-only dispatch without OCR artifacts`, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'ocr-d-native-price-'))
  try {
    const input = join(temporary, 'input.jpg'), output = join(temporary, 'must-not-exist')
    await Bun.write(input, await new Bun.Image(redDotPng).jpeg().bytes())
    const command = [...buildCategoriesBcSlotCommand(input, target, output, 'src/cli/create-cli.ts', OCR_CATEGORY_D_BENCHMARK_SCOPE.guardPath), '--price']
    const child = Bun.spawn(command, { env: { ...process.env, AUTOSHOW_OCR_D_GUARD: undefined, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_SPENDING_GUARD: undefined }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(0)
    expect(stderr.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    const result = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row => row.type === 'result').data
    expect(result.dryRun).toBe(true)
    expect(result.estimate.steps.map((row: { provider: string, model: string }) => `${row.provider}/${row.model}`)).toEqual([`${target.provider}/${target.model}`])
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test('advertisement entry point names its approved batch and rejects broad execution flags before any plan or network access', async () => {
  const run = async (argument: string) => {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/ocr-category-d-benchmark.ts', argument], { stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    return { stdout, stderr, code }
  }
  const help = await run('--help')
  expect(help.code).toBe(0)
  expect(help.stdout).toContain('6-file / 6-page / 21-target')
  expect(help.stdout).toContain('Default is price-only')
  expect(help.stdout).toContain('USD 25 approval')
  const invalid = await run('--all-providers')
  expect(invalid.code).toBe(1)
  expect(invalid.stderr).toContain('Usage: bun src/tools/ocr-category-d-benchmark.ts')
})
