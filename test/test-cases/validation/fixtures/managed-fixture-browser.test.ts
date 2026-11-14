import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import {
  FIXTURE_BROWSER_ARTIFACT,
  extractFixtureBrowserArchive,
  fixtureBrowserArtifactFor,
  readFixtureBrowserArchive,
  resolveRuntimeFixtureBrowser,
  verifyFixtureBrowserInstallation,
  writeFixtureBrowserReceipt
} from '~/tools/managed-fixture-browser'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'

type Member = { path: string, text?: string, mode?: number, corruptCrc?: boolean }
const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const directory = async (): Promise<string> => {
  const path = await createRuntimeTempDirectory('fixture-browser-contract-')
  temporary.push(path)
  return path
}

const zip = (members: Member[]): Buffer => {
  const local: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const member of members) {
    const name = Buffer.from(member.path), bytes = Buffer.from(member.text ?? ''), packed = deflateRawSync(bytes)
    const crc = Bun.hash.crc32(bytes) ^ (member.corruptCrc ? 1 : 0)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8)
    header.writeUInt32LE(crc >>> 0, 14); header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26)
    local.push(header, name, packed)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(8, 10)
    record.writeUInt32LE(crc >>> 0, 16); record.writeUInt32LE(packed.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28)
    record.writeUInt32LE(((member.mode ?? (member.path.endsWith('/') ? 0o040755 : 0o100644)) << 16) >>> 0, 38); record.writeUInt32LE(offset, 42)
    central.push(record, name)
    offset += header.length + name.length + packed.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(members.length, 8); end.writeUInt16LE(members.length, 10)
  end.writeUInt32LE(central.reduce((sum, bytes) => sum + bytes.length, 0), 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, ...central, end])
}

const fixtureInstall = async (): Promise<{ root: string, executable: string, resource: string }> => {
  const root = await directory(), executable = join(root, FIXTURE_BROWSER_ARTIFACT.executable), resource = join(root, 'resources/fixture.txt')
  await mkdir(dirname(executable), { recursive: true })
  await mkdir(dirname(resource), { recursive: true })
  await writeFile(executable, 'synthetic executable bytes\n', { mode: 0o755 })
  await writeFile(resource, 'original resource bytes\n', { mode: 0o644 })
  await symlink('fixture.txt', join(root, 'resources/current.txt'))
  await writeFixtureBrowserReceipt(root)
  return { root, executable, resource }
}

describe('optional runtime fixture browser', () => {
  test('pins the official macOS ARM64 archive and fails explicitly for unprovisioned platforms', () => {
    expect(fixtureBrowserArtifactFor('darwin', 'arm64')).toBe(FIXTURE_BROWSER_ARTIFACT)
    expect(FIXTURE_BROWSER_ARTIFACT.url).toBe(`https://storage.googleapis.com/chrome-for-testing-public/${FIXTURE_BROWSER_ARTIFACT.version}/mac-arm64/chrome-mac-arm64.zip`)
    expect(FIXTURE_BROWSER_ARTIFACT.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(() => fixtureBrowserArtifactFor('linux', 'x64')).toThrow('Automatic fixture-browser provisioning supports macOS ARM64')
    expect(() => fixtureBrowserArtifactFor('darwin', 'x64')).toThrow('AUTOSHOW_FIXTURE_BROWSER')
  })

  test('accepts a contained executable and rejects external and symlink-escaping overrides', async () => {
    const root = await directory(), executable = join(root, 'browser'), escape = join(root, 'escape')
    await writeFile(executable, 'synthetic browser', { mode: 0o755 })
    expect(resolveRuntimeFixtureBrowser(executable)).toBe(executable)
    expect(resolveRuntimeFixtureBrowser(join(root, 'missing'))).toBeUndefined()
    expect(() => resolveRuntimeFixtureBrowser('/usr/bin/false')).toThrow('inside the project runtime directory')
    await symlink('/usr/bin/false', escape)
    expect(() => resolveRuntimeFixtureBrowser(escape)).toThrow('inside the project runtime directory')
  })

  test('validates bytes, file modes, relative symlinks, and resources before assessment and probe', async () => {
    const { root, executable } = await fixtureInstall(), calls: string[] = []
    await verifyFixtureBrowserInstallation(root, {
      assess: async path => { expect(path).toBe(executable); calls.push('assess') },
      probe: async path => { expect(path).toBe(executable); calls.push('probe') }
    })
    expect(calls).toEqual(['assess', 'probe'])
    await chmod(executable, 0o644)
    await expect(verifyFixtureBrowserInstallation(root, { assess: async () => { calls.push('unexpected') }, probe: async () => {} })).rejects.toThrow('payload metadata mismatch')
    expect(calls).toEqual(['assess', 'probe'])
  })

  test('rejects tampered resources, link relationships, and inventory additions before launching', async () => {
    const { root, resource } = await fixtureInstall()
    let probes = 0
    const checks = { assess: async () => {}, probe: async () => { probes++ } }
    await writeFile(resource, 'modified resource bytes\n')
    await expect(verifyFixtureBrowserInstallation(root, checks)).rejects.toThrow('payload hash mismatch')
    await writeFile(resource, 'original resource bytes\n')
    await rm(join(root, 'resources/current.txt'))
    await symlink('../resources/fixture.txt', join(root, 'resources/current.txt'))
    await expect(verifyFixtureBrowserInstallation(root, checks)).rejects.toThrow('payload hash mismatch')
    await rm(join(root, 'resources/current.txt'))
    await symlink('fixture.txt', join(root, 'resources/current.txt'))
    await writeFile(join(root, 'resources/extra.txt'), 'unrecorded file')
    await expect(verifyFixtureBrowserInstallation(root, checks)).rejects.toThrow('payload inventory does not match')
    expect(probes).toBe(0)
  })

  test('an operating-system assessment rejection prevents the executable probe', async () => {
    const { root } = await fixtureInstall()
    let probes = 0
    await expect(verifyFixtureBrowserInstallation(root, {
      assess: async () => { throw Error('operating-system rejection') }, probe: async () => { probes++ }
    })).rejects.toThrow('operating-system rejection')
    expect(probes).toBe(0)
  })

  test('extracts verified member bytes and internal links with executable permissions', async () => {
    const root = await directory(), archive = join(root, 'fixture.zip'), output = join(root, 'payload')
    await writeFile(archive, zip([
      { path: 'bin/', mode: 0o040755 },
      { path: 'bin/browser', text: 'browser bytes', mode: 0o100755 },
      { path: 'share/data', text: 'resource bytes' },
      { path: 'bin/browser-link', text: 'browser', mode: 0o120777 }
    ]))
    await extractFixtureBrowserArchive(archive, output)
    expect(await Bun.file(join(output, 'bin/browser')).text()).toBe('browser bytes')
    expect(await Bun.file(join(output, 'bin/browser-link')).text()).toBe('browser bytes')
    expect(await Bun.file(join(output, 'share/data')).text()).toBe('resource bytes')
    expect(resolveRuntimeFixtureBrowser(join(output, 'bin/browser-link'))).toBe(join(output, 'bin/browser-link'))
  })

  for (const [name, members] of [
    ['absolute member', [{ path: '/escaped', text: 'bad' }]],
    ['parent traversal', [{ path: '../escaped', text: 'bad' }]],
    ['escaping symlink', [{ path: 'bin/link', text: '../../escaped', mode: 0o120777 }]],
    ['symlink parent', [{ path: 'bin/link', text: '../target', mode: 0o120777 }, { path: 'bin/link/child', text: 'bad' }]],
    ['duplicate name', [{ path: 'same' }, { path: 'same' }]],
    ['special file', [{ path: 'device', mode: 0o020666 }]],
    ['corrupt payload', [{ path: 'broken', text: 'bytes', corruptCrc: true }]]
  ] satisfies Array<[string, Member[]]>) {
    test(`rejects ${name} before extracting`, () => {
      expect(() => readFixtureBrowserArchive(zip(members))).toThrow('Invalid fixture-browser archive')
    })
  }
})
