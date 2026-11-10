import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { assertRuntimeBudgetDispatch, assertRuntimeBudgetEstimate, resolveRuntimeBudgetMaxCents, withRuntimeSpendingBudget } from '~/utils/runtime-spending-budget'
import { readSpendingLedger, spendingHeldCents } from '~/utils/spending-ledger'
import { resolveMaxCents } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { withRetry } from '~/utils/retries'
import { runSpendingLedgerCommand } from '~/tools/spending-ledger-command'
import { enforceTtsBatchBudget } from '~/cli/commands/audio/tts/tts-batch-estimates'
import { assertGeminiBatchBound } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-workflow'
import { buildSetupChildEnv } from '~/cli/create-cli'
import { withEnv } from '../../../test-utils/rest-contract-helpers'

const directories: string[] = []
const setup = async (reserve = 25, cap = 100) => {
  const dir = await makeTempDir('runtime-spending-budget-'); directories.push(dir)
  const path = join(dir, 'ledger.json')
  return { path, env: { AUTOSHOW_BUDGET_LEDGER: path, AUTOSHOW_BUDGET_CENTS: String(cap), AUTOSHOW_BUDGET_RESERVE_CENTS: String(reserve) } }
}
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

describe('shared command admission budgeting', () => {
  test('setup relaunch preserves complete and partial budget scopes and rejects before its handler', async () => {
    const { env } = await setup()
    for (const scope of [env, { ...env, AUTOSHOW_BUDGET_CENTS: undefined }]) {
      await withEnv(scope, async () => {
        const childEnvironment = buildSetupChildEnv()
        for (const [key, value] of Object.entries(scope)) expect(childEnvironment[key]).toBe(value)
        let invoked = false
        await expect(withRuntimeSpendingBudget('setup', {}, async () => { invoked = true }, childEnvironment)).rejects.toThrow(
          scope.AUTOSHOW_BUDGET_CENTS === undefined ? 'positive safe integer' : 'does not support'
        )
        expect(invoked).toBe(false)
      })
    }
  })

  test('unset opt-in preserves ordinary commands and configuration caps', async () => {
    expect(await withRuntimeSpendingBudget('comic', {}, async () => resolveMaxCents(undefined), {})).toBeUndefined()
    expect(resolveRuntimeBudgetMaxCents(50)).toBe(50)
    expect(() => assertRuntimeBudgetDispatch()).not.toThrow()
  })

  test('requires complete valid configuration and rejects unsupported paid paths before handler', async () => {
    const { path, env } = await setup()
    let invoked = false
    const execute = async () => { invoked = true }
    await expect(withRuntimeSpendingBudget('write', { 'require-shared-budget': true }, execute, {})).rejects.toThrow('must name a ledger')
    await expect(withRuntimeSpendingBudget('write', {}, execute, { AUTOSHOW_BUDGET_LEDGER: path })).rejects.toThrow('positive safe integer')
    await expect(withRuntimeSpendingBudget('write', {}, execute, { ...env, AUTOSHOW_BUDGET_CENTS: '1.5' })).rejects.toThrow('positive safe integer')
    await expect(withRuntimeSpendingBudget('write', {}, execute, { ...env, AUTOSHOW_BUDGET_RESERVE_CENTS: '101' })).rejects.toThrow('exceeds')
    for (const command of ['comic generate-images', 'resume', 'voice create']) await expect(withRuntimeSpendingBudget(command, {}, execute, env)).rejects.toThrow('does not support')
    expect(invoked).toBe(false)
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('price-only execution does not create a ledger or consume a reservation', async () => {
    const { path, env } = await setup()
    expect(await withRuntimeSpendingBudget('write', { price: true }, async () => 'quoted', env)).toBe('quoted')
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('forces existing pricing gates and prevents allow-over-budget from bypassing admission', async () => {
    const { path, env } = await setup()
    await expect(withRuntimeSpendingBudget('write', {}, async () => {
      expect(resolveMaxCents(undefined)).toBe(25)
      expect(resolveMaxCents({ maxCents: 10 })).toBe(10)
      evaluatePreflightEstimate({ steps: [], totalEstimatedCost: 26 }, { price: false, allowOverBudget: true }, undefined)
    }, env)).rejects.toThrow('must fit')
    const ledger = await readSpendingLedger(path)
    expect(ledger.receipts[0]?.status).toBe('uncertain')
    expect(spendingHeldCents(ledger)).toBe(25)
  })

  test('shared paid-create boundary rejects an unpriced operation before invoking it', async () => {
    const { path, env } = await setup()
    let invoked = false
    await expect(withRuntimeSpendingBudget('write', {}, async () => await withRetry({ retryClass: 'runtime_http_create_conservative', operationName: 'fixture' }, async () => { invoked = true }), env)).rejects.toThrow('preflight is required')
    expect(invoked).toBe(false)
    expect(spendingHeldCents(await readSpendingLedger(path))).toBe(25)
  })

  test('complete accepted pricing admits work and conservatively books the full declared allocation', async () => {
    const { path, env } = await setup()
    expect(await withRuntimeSpendingBudget('write', {}, async () => {
      assertRuntimeBudgetEstimate(1.25)
      return await withRetry({ retryClass: 'runtime_http_create_conservative', operationName: 'fixture' }, async () => 'done')
    }, env)).toBe('done')
    const ledger = await readSpendingLedger(path)
    expect(ledger.receipts[0]?.status).toBe('settled')
    expect(spendingHeldCents(ledger)).toBe(25)
  })

  test('partially priced and invalid estimates cannot admit provider work', async () => {
    for (const [cost, skipped] of [[1, 1], [NaN, 0], [Infinity, 0], [-1, 0]]) {
      const { env } = await setup()
      await expect(withRuntimeSpendingBudget('extract', {}, async () => assertRuntimeBudgetEstimate(cost!, skipped), env)).rejects.toThrow('must fit')
    }
  })

  test('the TTS whole-directory budget gate also admits only a fitting complete batch', async () => {
    const { env } = await setup()
    await expect(withRuntimeSpendingBudget('tts', {}, async () => enforceTtsBatchBudget(26, undefined, true), env)).rejects.toThrow('must fit')
    await withRuntimeSpendingBudget('tts', {}, async () => {
      enforceTtsBatchBudget(24, undefined, false)
      assertRuntimeBudgetDispatch()
    }, env)
  })

  test('Gemini remote batch authorization bounds must also fit the shared reservation', async () => {
    const { env } = await setup()
    const plan = (authorizationBoundCents: number) => ({ authorizationBoundCents } as Parameters<typeof assertGeminiBatchBound>[0])
    await expect(withRuntimeSpendingBudget('tts', {}, async () => assertGeminiBatchBound(plan(26), undefined), env)).rejects.toThrow('must fit')
    await withRuntimeSpendingBudget('tts', {}, async () => {
      assertGeminiBatchBound(plan(24), undefined)
      assertRuntimeBudgetDispatch()
    }, env)
  })

  test('parallel invocations share the cap and retain failed work without an automatic retry refund', async () => {
    const { path, env } = await setup(25, 100)
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => withRuntimeSpendingBudget('write', {}, async () => {
      assertRuntimeBudgetEstimate(10)
      if (i % 2) throw new Error('lost provider response')
    }, env)))
    expect(results.filter(result => result.status === 'fulfilled').length).toBeLessThanOrEqual(4)
    const ledger = await readSpendingLedger(path)
    expect(ledger.receipts).toHaveLength(4)
    expect(spendingHeldCents(ledger)).toBe(100)
    await expect(withRuntimeSpendingBudget('write', {}, async () => undefined, env)).rejects.toThrow()
  })

  test('operator reconciliation requires explicit evidence and reports bounded status', async () => {
    const { path, env } = await setup()
    await expect(withRuntimeSpendingBudget('write', {}, async () => { throw new Error('uncertain') }, env)).rejects.toThrow('uncertain')
    const id = (await readSpendingLedger(path)).receipts[0]!.id
    await expect(runSpendingLedgerCommand(['reconcile', path, '--budget-cents', '100', '--id', id, '--charged-cents', '3'])).rejects.toThrow('usage:')
    await expect(runSpendingLedgerCommand(['reconcile', path, '--budget-cents', '100', '--id', id, '--charged-cents', '3', '--evidence', 'Partial billing evidence alone does not establish stopped workers.'])).rejects.toThrow('confirm all participating')
    expect(spendingHeldCents(await readSpendingLedger(path))).toBe(25)
    const result = await runSpendingLedgerCommand(['reconcile', path, '--budget-cents', '100', '--id', id, '--charged-cents', '3', '--evidence', 'Provider usage export reconciles the interrupted request to three cents.', '--confirm-stopped'])
    expect(result['heldCents']).toBe(3)
    expect(result['receiptCount']).toBe(1)
    expect((await runSpendingLedgerCommand(['status', path, '--id', id]))['heldCents']).toBe(3)
    await expect(runSpendingLedgerCommand(['status', path, '--unknown', 'value'])).rejects.toThrow('usage:')
  })

  test('the real native write command forces pricing and refuses an excessive estimate before any network dispatch', async () => {
    const { path, env } = await setup(1, 100)
    const input = join(directories.at(-1)!, 'notes.txt')
    await Bun.write(input, 'A long local document for pricing verification. '.repeat(20_000))
    const entrypoint = new URL('../../../../src/cli/create-cli.ts', import.meta.url).pathname
    const source = `let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('Network access is forbidden in this local test') }; const { runCliInProcess } = await import(${JSON.stringify(entrypoint)}); process.exitCode = await runCliInProcess(JSON.parse(Bun.argv[1])); process.stderr.write('NETWORK_DISPATCHES=' + calls)`
    const args = ['write', input, '--provider', 'openai=gpt-6.1-sol', '--prompt', 'shortSummary', '--config-path', join(directories.at(-1)!, 'no-config.json'), '--require-shared-budget', '--json', '--quiet']
    const child = Bun.spawn([process.execPath, '--no-env-file', '--eval', source, JSON.stringify(args)], {
      env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '', OPENAI_API_KEY: 'test-not-a-real-key', ...env }, stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(exit).toBe(2)
    expect(stderr).toContain('NETWORK_DISPATCHES=0')
    expect(stdout).toContain('must fit its shared budget reservation')
    expect(spendingHeldCents(await readSpendingLedger(path))).toBe(1)
  })
})
