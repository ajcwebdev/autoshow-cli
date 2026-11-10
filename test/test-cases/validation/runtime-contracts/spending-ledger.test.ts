import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSpendingLedger, reconcileSpendingReservation, reserveSpendingBudget, spendingHeldCents } from '~/utils/spending-ledger'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-spending-ledger-'))
  temporary.push(directory)
  return { directory, path: join(directory, 'budget.json'), budgetCents: 100, reserveCents: 60, operation: 'mock-provider-command' }
}

describe('shared spending reservations', () => {
  test('settles a known charge and admits only the remaining cumulative budget', async () => {
    const options = await fixture()
    const first = await reserveSpendingBudget(options)
    expect(spendingHeldCents(await readSpendingLedger(options.path))).toBe(60)
    await expect(reserveSpendingBudget(options)).rejects.toThrow('cannot admit')
    await first.settle(35)
    await first.settle(35) // identical successful settlement is safe to observe again.
    await expect(first.settle(30)).rejects.toThrow('only an active reservation')
    const second = await reserveSpendingBudget(options)
    expect(spendingHeldCents(await readSpendingLedger(options.path))).toBe(95)
    await second.releaseRejected()
    expect(spendingHeldCents(await readSpendingLedger(options.path))).toBe(35)
    expect((await stat(options.path)).mode & 0o777).toBe(0o600)
  })

  test('preserves uncertain charges until reconciliation provides explicit evidence', async () => {
    const options = await fixture(), reservation = await reserveSpendingBudget(options)
    await reservation.retainUncertain()
    await reservation.retainUncertain()
    await expect(reservation.settle(0)).rejects.toThrow('explicit reconciliation evidence')
    await expect(reservation.releaseRejected()).rejects.toThrow('never-dispatched')
    await expect(reserveSpendingBudget(options)).rejects.toThrow('cannot admit')
    await expect(reconcileSpendingReservation({ ...options, confirmStopped: true, id: reservation.id, chargedCents: 0, evidence: '' })).rejects.toThrow('evidence')
    await reconcileSpendingReservation({ ...options, confirmStopped: true, id: reservation.id, chargedCents: 21, evidence: 'Provider request receipt confirms 21 cents charged.' })
    const ledger = await readSpendingLedger(options.path)
    expect(spendingHeldCents(ledger)).toBe(21)
    expect(ledger.receipts[0]?.reconciliationEvidence).toContain('21 cents')
  })

  test('refuses to reset a ledger budget or reuse a reservation identity', async () => {
    const options = await fixture()
    const reservation = await reserveSpendingBudget({ ...options, id: 'existing-request' })
    await expect(reserveSpendingBudget({ ...options, id: reservation.id })).rejects.toThrow('already exists')
    await expect(reserveSpendingBudget({ ...options, budgetCents: 500 })).rejects.toThrow('existing budget differs')
    expect((await readSpendingLedger(options.path)).budgetCents).toBe(100)
  })

  test('requires explicit stopped-work confirmation before reconciling a still-reserved receipt', async () => {
    const options = await fixture(), reservation = await reserveSpendingBudget(options)
    await expect(reconcileSpendingReservation({ ...options, id: reservation.id, chargedCents: 0,
      evidence: 'A partial usage export does not establish that the request finished.', confirmStopped: false })).rejects.toThrow('confirm all participating')
    const ledger = await readSpendingLedger(options.path)
    expect(ledger.receipts[0]?.status).toBe('reserved')
    expect(spendingHeldCents(ledger)).toBe(60)
  })

  test('serializes concurrent reservations rather than oversubscribing', async () => {
    const options = await fixture()
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => reserveSpendingBudget({ ...options, reserveCents: 30 })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3)
    const ledger = await readSpendingLedger(options.path)
    expect(ledger.receipts).toHaveLength(3)
    expect(spendingHeldCents(ledger)).toBe(90)
  })

  test('coordinates separate processes and retains holds after each process exits', async () => {
    const options = await fixture()
    const module = new URL('../../../../src/utils/spending-ledger.ts', import.meta.url).pathname
    const source = `import { reserveSpendingBudget } from ${JSON.stringify(module)}; try { await reserveSpendingBudget(JSON.parse(process.argv[1])); process.exitCode = 0 } catch { process.exitCode = 9 }`
    const processes = Array.from({ length: 10 }, (_, index) => Bun.spawn({
      cmd: [process.execPath, '--no-env-file', '--eval', source, JSON.stringify({ ...options, reserveCents: 25, id: `child-${index}` })],
      env: { PATH: process.env['PATH'] ?? '' }, stdout: 'pipe', stderr: 'pipe'
    }))
    const codes = await Promise.all(processes.map(process => process.exited))
    expect(codes.filter(code => code === 0)).toHaveLength(4)
    expect(codes.filter(code => code === 9)).toHaveLength(6)
    const ledger = await readSpendingLedger(options.path)
    expect(ledger.receipts.every(receipt => receipt.status === 'reserved')).toBe(true)
    expect(spendingHeldCents(ledger)).toBe(100)
  })

  test('persists over-reservation actual charges and blocks every subsequent admission', async () => {
    const options = await fixture(), reservation = await reserveSpendingBudget(options)
    await expect(reservation.settle(75)).rejects.toThrow('breach was recorded')
    const ledger = await readSpendingLedger(options.path)
    expect(ledger.receipts[0]?.chargedCents).toBe(75)
    expect(ledger.fatal).toContain('exceeded its reservation')
    await expect(reserveSpendingBudget({ ...options, reserveCents: 1 })).rejects.toThrow('no further admission')
  })

  test('records a reconciliation breach without freeing its reservation', async () => {
    const options = await fixture(), reservation = await reserveSpendingBudget(options)
    await reservation.retainUncertain()
    await expect(reconcileSpendingReservation({ ...options, confirmStopped: true, id: reservation.id, chargedCents: 110, evidence: 'Provider receipt records an unexpectedly higher charge.' })).rejects.toThrow('breach was recorded')
    expect(spendingHeldCents(await readSpendingLedger(options.path))).toBe(110)
  })

  test('never removes an existing stale lock', async () => {
    const options = await fixture()
    await mkdir(`${options.path}.lock`)
    await writeFile(join(`${options.path}.lock`, 'owner'), 'abandoned-owner')
    await expect(reserveSpendingBudget({ ...options, lockTimeoutMs: 0 })).rejects.toThrow('no stale lock or reservation was removed')
    expect(await readFile(join(`${options.path}.lock`, 'owner'), 'utf8')).toBe('abandoned-owner')
  })

  test('refuses a ledger symlink without altering its destination', async () => {
    const options = await fixture(), target = join(options.directory, 'protected.json')
    await writeFile(target, 'preserve this evidence')
    await symlink(target, options.path)
    await expect(reserveSpendingBudget(options)).rejects.toThrow('regular file')
    expect(await readFile(target, 'utf8')).toBe('preserve this evidence')
  })

  test('rejects a named pipe before reading without blocking admission', async () => {
    const options = await fixture()
    const created = Bun.spawnSync(['mkfifo', options.path], { stdout: 'pipe', stderr: 'pipe' })
    expect(created.exitCode).toBe(0)
    await expect(readSpendingLedger(options.path)).rejects.toThrow('regular file')
    await expect(reserveSpendingBudget(options)).rejects.toThrow('regular file')
  }, 1000)

  test('refuses a lock symlink without deleting its destination', async () => {
    const options = await fixture(), target = join(options.directory, 'other-owner')
    await mkdir(target)
    await writeFile(join(target, 'owner'), 'preserve-owner')
    await symlink(target, `${options.path}.lock`)
    await expect(reserveSpendingBudget(options)).rejects.toThrow('real directory')
    expect(await readFile(join(target, 'owner'), 'utf8')).toBe('preserve-owner')
  })

  test('preserves corrupt ledgers and rejects impossible accounting', async () => {
    const options = await fixture()
    await writeFile(options.path, '{broken')
    await expect(reserveSpendingBudget(options)).rejects.toThrow('JSON is invalid')
    expect(await readFile(options.path, 'utf8')).toBe('{broken')
    await writeFile(options.path, JSON.stringify({ schemaVersion: 1, budgetCents: 100, receipts: [{ id: 'bad', operation: 'write', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), reservedCents: 200, chargedCents: 0, status: 'uncertain' }] }))
    await expect(reserveSpendingBudget(options)).rejects.toThrow('over-budget accounting')
  })

  test('rejects fractional, negative and unsafe monetary values before admission', async () => {
    const options = await fixture()
    for (const amount of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(reserveSpendingBudget({ ...options, reserveCents: amount })).rejects.toThrow('safe-integer cents')
      await expect(reserveSpendingBudget({ ...options, budgetCents: amount })).rejects.toThrow('safe-integer cents')
    }
  })
})
