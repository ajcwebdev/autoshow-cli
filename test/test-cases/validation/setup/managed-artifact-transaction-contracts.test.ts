import { describe, expect, test } from 'bun:test'
import { access, lstat, mkdir, readdir, symlink } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  createManagedToolStagingDirectory,
  managedToolTransactionPath,
  promoteManagedToolDirectory,
  readManagedToolTransactionIssue,
  recoverManagedToolDirectory
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact-transaction'
import { isIgnoredManagedArtifactPath } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact-schema'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const temporary = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'managed-install-transaction-' })
const exists = async (path: string): Promise<boolean> => { try { await access(path); return true } catch { return false } }
const ownEntries = async (path: string): Promise<string[]> => (await readdir(path)).filter(name => !isIgnoredManagedArtifactPath(name))
const modulePath = resolve('src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact-transaction.ts')

describe('managed installation mutation boundaries', () => {
  test('read-only readiness leaves missing installation directories and journals uncreated', async () => {
    const root = await temporary.make()
    const destination = join(root, 'not-installed/package')
    const before = await ownEntries(root)
    expect(await readManagedToolTransactionIssue(destination)).toBeUndefined()
    expect(await exists(join(root, 'not-installed'))).toBe(false)
    expect(await ownEntries(root)).toEqual(before)
  })

  test('creates a cold package parent and rejects a parent link escaping runtime before validation', async () => {
    const root = await temporary.make()
    const destination = join(root, 'nested/tools/package')
    const staging = await createManagedToolStagingDirectory(destination)
    expect((await lstat(staging)).isDirectory()).toBe(true)
    const escape = join(root, 'external-tools')
    await symlink('/usr/bin', escape)
    await expect(createManagedToolStagingDirectory(join(escape, 'package'))).rejects.toThrow('inside the project runtime')
    let validations = 0
    await expect(promoteManagedToolDirectory({ stagingDir: staging, destinationDir: join(escape, 'package'), validateStaging: async () => { validations++ } })).rejects.toThrow('inside the project runtime')
    expect(validations).toBe(0)
    expect((await lstat(staging)).isDirectory()).toBe(true)
  })

  test('rejects replacing runtime itself and corrupt recovery journals without changing installations', async () => {
    await expect(createManagedToolStagingDirectory(RUNTIME_DIR)).rejects.toThrow('runtime root')
    const root = await temporary.make()
    const destination = join(root, 'package')
    await mkdir(destination)
    await Bun.write(join(destination, 'payload'), 'healthy prior')
    const invalidReceipt = JSON.stringify({ schemaVersion: 1 })
    await Bun.write(join(root, '.package.transaction.json'), invalidReceipt)
    expect(await readManagedToolTransactionIssue(destination)).toContain('transaction could not be inspected')
    expect(await Bun.file(join(root, '.package.transaction.json')).text()).toBe(invalidReceipt)
    await expect(recoverManagedToolDirectory(destination)).rejects.toThrow('transaction identity is invalid')
    expect(await Bun.file(join(destination, 'payload')).text()).toBe('healthy prior')
  })
})

describe('durable managed installation recovery', () => {
  for (const checkpoint of ['previous-renamed', 'candidate-renamed', 'committed'] as const) {
    test(`recovers after SIGKILL at ${checkpoint} without losing the prior installation or interrupted candidate`, async () => {
      const root = await temporary.make()
      const destination = join(root, 'package')
      await mkdir(destination)
      await Bun.write(join(destination, 'payload'), 'healthy prior')
      const staging = await createManagedToolStagingDirectory(destination)
      await Bun.write(join(staging, 'payload'), 'verified candidate')
      const marker = join(root, 'checkpoint')
      const script = `import {promoteManagedToolDirectory} from ${JSON.stringify(modulePath)};
        await promoteManagedToolDirectory({stagingDir:${JSON.stringify(staging)},destinationDir:${JSON.stringify(destination)},
          validateStaging:async path=>{if(await Bun.file(path+'/payload').text()!=='verified candidate')throw Error('candidate changed')},
          checkpoint:async phase=>{if(phase===${JSON.stringify(checkpoint)}){await Bun.write(${JSON.stringify(marker)},phase);process.kill(process.pid,'SIGKILL')}}});`
      const child = Bun.spawn([process.execPath, '--no-env-file', '-e', script], { cwd: process.cwd(), env: { PATH: process.env['PATH'] ?? '' }, stdout: 'pipe', stderr: 'pipe' })
      const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
      expect(exitCode, stderr).not.toBe(0)
      expect(await Bun.file(marker).text()).toBe(checkpoint)
      if (checkpoint === 'previous-renamed') expect(await exists(destination)).toBe(false)
      const journal = managedToolTransactionPath(destination)
      const receiptBefore = await Bun.file(journal).text()
      const entriesBefore = await ownEntries(root)
      const installedBefore = await exists(destination)
      expect(await readManagedToolTransactionIssue(destination)).toContain('unfinished')
      expect(await Bun.file(journal).text()).toBe(receiptBefore)
      expect(await ownEntries(root)).toEqual(entriesBefore)
      expect(await exists(destination)).toBe(installedBefore)
      // The next normal staging invocation performs recovery before a new build.
      const nextStaging = await createManagedToolStagingDirectory(destination)
      expect((await lstat(nextStaging)).isDirectory()).toBe(true)
      const expectedPayload = checkpoint === 'committed' ? 'verified candidate' : 'healthy prior'
      expect(await Bun.file(join(destination, 'payload')).text()).toBe(expectedPayload)
      const entries = await ownEntries(root)
      expect(entries.includes('.package.transaction.json')).toBe(false)
      expect(await readManagedToolTransactionIssue(destination)).toBeUndefined()
      if (checkpoint === 'committed') {
        expect(entries.some(name => name.startsWith('package.backup-'))).toBe(false)
      } else {
        const archive = entries.find(name => name.startsWith('.package.transaction-') && name.endsWith('.interrupted.json'))
        expect(archive).toBeDefined()
        const receipt = await Bun.file(join(root, archive!)).json()
        expect(receipt.phase).toBe('recovered')
        expect(receipt.destination).not.toStartWith('/')
        const preservedCandidate = checkpoint === 'previous-renamed' ? staging : join(RUNTIME_DIR, receipt.evidence)
        expect(await Bun.file(join(preservedCandidate, 'payload')).text()).toBe('verified candidate')
      }
    })
  }

  test('does not recover a transaction while its owner is alive', async () => {
    const root = await temporary.make()
    const destination = join(root, 'package')
    const staging = await createManagedToolStagingDirectory(destination)
    await Bun.write(join(staging, 'payload'), 'candidate')
    await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: destination, validateStaging: async () => undefined, checkpoint: async phase => {
      if (phase === 'journal-prepared') await expect(recoverManagedToolDirectory(destination)).rejects.toThrow('live process owns')
    } })
    expect(await Bun.file(join(destination, 'payload')).text()).toBe('candidate')
  })

  test('preserves a foreign-host transaction and both installations when ownership cannot be verified', async () => {
    const root = await temporary.make()
    const destination = join(root, 'package')
    await mkdir(destination)
    await Bun.write(join(destination, 'payload'), 'healthy prior')
    const staging = await createManagedToolStagingDirectory(destination)
    await Bun.write(join(staging, 'payload'), 'candidate')
    await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: destination, validateStaging: async () => undefined, checkpoint: async phase => {
      if (phase !== 'journal-prepared') return
      const journal = join(root, '.package.transaction.json')
      const receipt = await Bun.file(journal).json()
      receipt.ownerHost = 'unverifiable-foreign-host'
      const preserved = JSON.stringify(receipt)
      await Bun.write(journal, preserved)
      await expect(recoverManagedToolDirectory(destination)).rejects.toThrow('cannot verify the owner on another host')
      expect(await Bun.file(journal).text()).toBe(preserved)
      expect(await Bun.file(join(destination, 'payload')).text()).toBe('healthy prior')
      expect(await Bun.file(join(staging, 'payload')).text()).toBe('candidate')
    } })
  })

  test('retains both original and rollback diagnostics while preserving the failed candidate', async () => {
    const root = await temporary.make()
    const destination = join(root, 'package')
    await mkdir(destination)
    await Bun.write(join(destination, 'payload'), 'healthy prior')
    const staging = await createManagedToolStagingDirectory(destination)
    await Bun.write(join(staging, 'payload'), 'failed candidate')
    let failure: unknown
    try {
      await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: destination, validateStaging: async () => undefined,
        activate: async () => { throw new Error('activation failed first') }, rollbackActivation: async () => { throw new Error('shim rollback also failed') } })
    } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).message).toContain('activation failed first')
    expect((failure as AggregateError).errors.map(error => error.message)).toEqual(['activation failed first', 'shim rollback also failed'])
    expect(await Bun.file(join(destination, 'payload')).text()).toBe('healthy prior')
    const candidate = (await ownEntries(root)).find(name => name.startsWith(`.${basename(destination)}.interrupted-`))
    expect(candidate).toBeDefined()
    expect(await Bun.file(join(root, candidate!, 'payload')).text()).toBe('failed candidate')
  })
})
