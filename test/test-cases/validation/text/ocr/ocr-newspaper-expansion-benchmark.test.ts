import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCategoriesBcSlotCommand, newspaperFirstPassWithinBudget, OCR_NEWSPAPER_EXPANSION_BENCHMARK_SCOPE, shouldDeferOcrBudgetReservation } from '~/tools/ocr-categories-bc-benchmark'
import { redDotPng } from '../../../../test-utils/media-fixtures'

test('reservation pressure waits only for zero-admission slots while other requests are still reserved', () => {
  const message = 'OCR spending guard: request reservation 384.000000 cents exceeds the remaining cumulative approval'
  expect(shouldDeferOcrBudgetReservation(message, [], [{ status: 'reserved' }])).toBe(true)
  expect(shouldDeferOcrBudgetReservation(message, [{ status: 'rejected', chargedCents: 0 }], [{ status: 'reserved' }])).toBe(true)
  expect(shouldDeferOcrBudgetReservation(message, [], [{ status: 'settled' }])).toBe(false)
  for (const status of ['settled', 'ambiguous', 'breach', 'reserved']) expect(shouldDeferOcrBudgetReservation(message, [{ status, chargedCents: 1 }], [{ status: 'reserved' }])).toBe(false)
  expect(shouldDeferOcrBudgetReservation('Network timed out', [], [{ status: 'reserved' }])).toBe(false)
  expect(shouldDeferOcrBudgetReservation('automatic redispatch is blocked', [], [{ status: 'reserved' }])).toBe(false)
  expect(shouldDeferOcrBudgetReservation(message, [{ status: 'rejected', chargedCents: 1 }], [{ status: 'reserved' }])).toBe(false)
})

test('approved first-pass planning does not assert that every possible retry fits the budget', () => {
  const costs = { firstPassReferenceLength: 1291.47271, firstPassExpanded: 1518.57551, firstPassEmpirical: 1632.31671, threeAttemptsEachSlotEmpirical: 4896.95013 }
  expect(newspaperFirstPassWithinBudget(costs, 3000)).toBe(true)
  expect(newspaperFirstPassWithinBudget(undefined, 3000)).toBe(false)
  expect(newspaperFirstPassWithinBudget({ ...costs, firstPassEmpirical: 3001 }, 3000)).toBe(false)
  expect(newspaperFirstPassWithinBudget({ ...costs, firstPassReferenceLength: Number.NaN }, 3000)).toBe(false)
  expect(newspaperFirstPassWithinBudget({ ...costs, firstPassExpanded: 0 }, 3000)).toBe(false)
})

test('newspaper help fixes the twelve-file approval and twelve-worker scope before any plan or API access', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/ocr-newspaper-expansion-benchmark.ts', '--help'], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(code).toBe(0)
  expect(stderr).toBe('')
  expect(stdout).toContain('12-file / 12-page / 21-target')
  expect(stdout).toContain('USD 30 approval')
  expect(stdout).toContain('12 concurrent jobs')
  expect(stdout).toContain('Default is price-only')
})

for (const target of [{ provider: 'openai', model: 'gpt-6-luna' }, { provider: 'tesseract', model: 'tesseract' }]) test(`newspaper ${target.provider} command reaches price-only native dispatch without creating extraction artifacts`, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'ocr-newspaper-price-'))
  try {
    const input = join(temporary, 'input.png'), output = join(temporary, 'must-not-exist')
    await Bun.write(input, redDotPng)
    const command = [...buildCategoriesBcSlotCommand(input, target, output, 'src/cli/create-cli.ts', OCR_NEWSPAPER_EXPANSION_BENCHMARK_SCOPE.guardPath), '--price']
    const child = Bun.spawn(command, { env: { ...process.env, AUTOSHOW_OCR_NEWSPAPER_GUARD: undefined, AUTOSHOW_OCR_EFG_GUARD: undefined, AUTOSHOW_OCR_D_GUARD: undefined, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_SPENDING_GUARD: undefined }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(0)
    expect(stderr.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    const data = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row => row.type === 'result').data
    expect(data.dryRun).toBe(true)
    expect(data.estimate.steps.map((row: { provider: string, model: string }) => `${row.provider}/${row.model}`)).toEqual([`${target.provider}/${target.model}`])
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
