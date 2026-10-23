import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCategoriesBcSlotCommand, estimateCategoriesBcPlanningCost } from '~/tools/ocr-categories-bc-benchmark'
import { redDotPng } from '../../../../test-utils/media-fixtures'

for (const target of [{ provider: 'openai', model: 'gpt-6-luna' }, { provider: 'tesseract', model: 'tesseract' }]) test(`B/C ${target.provider} slot arguments reach the native price-only parser without creating OCR artifacts`, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'ocr-bc-native-price-'))
  try {
    const input = join(temporary, 'input.png'), output = join(temporary, 'must-not-exist')
    await Bun.write(input, redDotPng)
    const command = [...buildCategoriesBcSlotCommand(input, target, output), '--price']
    const child = Bun.spawn(command, { env: { ...process.env, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_SPENDING_GUARD: undefined }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(0)
    expect(stderr.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    const result = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row => row.type === 'result').data
    expect(result.dryRun).toBe(true)
    expect(result.estimate.steps.map((row: { provider: string, model: string }) => `${row.provider}/${row.model}`)).toEqual([`${target.provider}/${target.model}`])
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test('planning counts three structured responses, three OpenAI cache-write allowances and one independent Gemma rate correction', () => {
  const estimate = estimateCategoriesBcPlanningCost([
    { provider: 'openai', model: 'gpt-6.1-sol', promptTokens: 1_000_000, completionTokens: 0, inputCostPer1MCents: 200, totalCostCents: 200 },
    { provider: 'anthropic', model: 'claude-sonnet-5-5', totalCostCents: 100 },
    { provider: 'deepinfra', model: 'google/gemma-4-31B-it', promptTokens: 1_000_000, completionTokens: 1_000_000, inputCostPer1MCents: 13, outputCostPer1MCents: 38, totalCostCents: 51 }
  ])
  expect(estimate.nativeCents).toBe(351)
  expect(estimate.adjustedCents).toBe(410)
  expect(estimate.twoRepairCents).toBe(1110)
})
