import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  ACCOUNT_SCOPE_HASH_DERIVATION_VERSION,
  deriveProviderAccountScopeHash
} from '~/utils/account-scope-hash'

describe('provider account-scope hash derivation', () => {
  const installationKey = Uint8Array.from({ length: 32 }, (_value, index) => index + 1)

  test('uses the version-2 installation-keyed derivation deterministically', () => {
    const first = deriveProviderAccountScopeHash('grok', '  credential-value  ', installationKey)
    const second = deriveProviderAccountScopeHash('grok', 'credential-value', installationKey)
    const formerUnsaltedDigest = new Bun.CryptoHasher('sha256')
      .update(JSON.stringify({ schemaVersion: 1, provider: 'grok', credential: 'credential-value' }))
      .digest('hex')

    expect(ACCOUNT_SCOPE_HASH_DERIVATION_VERSION).toBe(2)
    expect(first).toBe('eaec69c5e5d283e427d3dc2be912465d27d84096e9cd0dc85bcb94001ffeb0c8')
    expect(first).toBe(second)
    expect(first).not.toBe(formerUnsaltedDigest)
  })

  test('separates installations providers and credentials', () => {
    const baseline = deriveProviderAccountScopeHash('grok', 'credential-value', installationKey)
    const otherInstallation = deriveProviderAccountScopeHash('grok', 'credential-value', new Uint8Array(32).fill(9))
    const otherProvider = deriveProviderAccountScopeHash('inworld', 'credential-value', installationKey)
    const otherCredential = deriveProviderAccountScopeHash('grok', 'another-credential', installationKey)

    expect(new Set([baseline, otherInstallation, otherProvider, otherCredential]).size).toBe(4)
  })
})

// Isolated processes ensure the default key path never touches the real installation.
const deriveInTemporaryProject = async (root: string): Promise<string> => {
  const modulePath = resolve('src/utils/account-scope-hash.ts')
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `import { deriveProviderAccountScopeHash } from ${JSON.stringify(modulePath)}; console.log(deriveProviderAccountScopeHash('grok', 'credential-value'))`], {
    env: { PATH: process.env['PATH'], AUTOSHOW_PROJECT_ROOT: root },
    stdout: 'pipe', stderr: 'pipe'
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (code !== 0) throw new Error(stderr)
  return stdout.trim()
}

test('keyed hashing preserves RFC 4231 and Unicode/NUL identity vectors', () => {
  expect(new Bun.CryptoHasher('sha256', new Uint8Array(20).fill(0x0b)).update('Hi There').digest('hex'))
    .toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  expect(deriveProviderAccountScopeHash('fake-provider', ' ☃ 🎧\0credential ', Uint8Array.from({ length: 32 }, (_, i) => i + 1)))
    .toBe('fb4d9c6f23d370f4e83c6372564cde303be7b3086f2732b0dd26c45be683dd11')
})

test('fresh concurrent processes converge on one private key and reuse it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-account-key-'))
  try {
    const hashes = await Promise.all(Array.from({ length: 8 }, () => deriveInTemporaryProject(root)))
    expect(new Set(hashes).size).toBe(1)
    const keyPath = join(root, 'runtime', '.account-scope-derivation-key')
    const key = await readFile(keyPath)
    expect(key.byteLength).toBe(32)
    expect((await stat(join(root, 'runtime'))).mode & 0o777).toBe(0o700)
    expect((await stat(keyPath)).mode & 0o777).toBe(0o600)
    expect(await deriveInTemporaryProject(root)).toBe(hashes[0]!)
    expect(await readFile(keyPath)).toEqual(key)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('existing synthetic keys retain old identities and malformed keys are not replaced', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-existing-key-'))
  try {
    await mkdir(join(root, 'runtime'), { mode: 0o700 })
    const keyPath = join(root, 'runtime', '.account-scope-derivation-key')
    const key = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
    await writeFile(keyPath, key, { mode: 0o600 })
    expect(await deriveInTemporaryProject(root)).toBe('eaec69c5e5d283e427d3dc2be912465d27d84096e9cd0dc85bcb94001ffeb0c8')
    await writeFile(keyPath, 'invalid')
    await expect(deriveInTemporaryProject(root)).rejects.toThrow('invalid length')
    expect(await readFile(keyPath, 'utf8')).toBe('invalid')
  } finally { await rm(root, { recursive: true, force: true }) }
})
