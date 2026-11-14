import { expect, spyOn, test } from 'bun:test'
import { chmod, mkdir, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { readManagedZipExecutable, validateManagedAlignmentRuntime, validateManagedJsRuntime, validateManagedPackageManifest, writeManagedPackageManifest } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime'
import { validateManagedDefuddleRuntime } from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'

const zip = (entries: Array<{ name: string, text: string, method?: number, mode?: number, flags?: number }>): Buffer => {
  const local: Buffer[] = [], directory: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name), raw = Buffer.from(entry.text)
    const method = entry.method ?? 8
    const data = method === 8 ? deflateRawSync(raw) : raw
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50)
    header.writeUInt16LE(entry.flags ?? 0, 6)
    header.writeUInt16LE(method, 8)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(entry.flags ?? 0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE((entry.mode ?? 0o100755) * 65536, 38)
    central.writeUInt32LE(offset, 42)
    local.push(header, name, data)
    directory.push(central, name)
    offset += header.length + name.length + data.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.reduce((sum, part) => sum + part.length, 0), 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, ...directory, end])
}

test('verified runtime archives extract only the exact executable member with stored or deflated bytes', () => {
  for (const method of [0, 8]) {
    const archive = zip([{ name: '../../unrequested', text: 'unused' }, { name: 'runtime/bun', text: 'executable bytes', method }])
    expect(Buffer.from(readManagedZipExecutable(archive, 'runtime/bun')).toString()).toBe('executable bytes')
  }
})

test('runtime archive extraction rejects ambiguous, encrypted, linked and malformed executables', () => {
  expect(() => readManagedZipExecutable(zip([{ name: 'other', text: 'unused' }]), 'bun')).toThrow('missing bun')
  expect(() => readManagedZipExecutable(zip([{ name: 'bun', text: 'one' }, { name: 'bun', text: 'two' }]), 'bun')).toThrow('repeats')
  expect(() => readManagedZipExecutable(zip([{ name: 'bun', text: 'target', mode: 0o120777 }]), 'bun')).toThrow('unsupported')
  expect(() => readManagedZipExecutable(zip([{ name: 'bun', text: 'encrypted', flags: 1 }]), 'bun')).toThrow('unsupported')
  expect(() => readManagedZipExecutable(zip([{ name: 'bun', text: 'unsupported', method: 9 }]), 'bun')).toThrow('compression')
  expect(() => readManagedZipExecutable(Buffer.from('short'), 'bun')).toThrow('truncated')
  const archive = zip([{ name: 'bun', text: 'truncated executable' }])
  const central = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  archive.writeUInt32LE(0xfffffff0, central + 20)
  expect(() => readManagedZipExecutable(archive, 'bun')).toThrow('truncated')
})

test('managed package verification detects changed bytes, modes, identities and symlink relationships', async () => withLocalTestDir('js-payload', async root => {
  await mkdir(join(root, 'lib'))
  const first = join(root, 'lib/first.js'), second = join(root, 'lib/second.js'), link = join(root, 'entry.js')
  await Bun.write(first, 'export default 1\n')
  await Bun.write(second, 'export default 1\n')
  await chmod(first, 0o644)
  await symlink('lib/first.js', link)
  await writeManagedPackageManifest(root, 'fixture@1')
  expect(await validateManagedPackageManifest(root, 'fixture@1')).toBe(true)
  expect(await validateManagedPackageManifest(root, 'fixture@2')).toBe(false)
  await chmod(first, 0o755)
  expect(await validateManagedPackageManifest(root, 'fixture@1')).toBe(false)
  await chmod(first, 0o644)
  await rm(link)
  await symlink('lib/second.js', link)
  expect(await validateManagedPackageManifest(root, 'fixture@1')).toBe(false)
  await rm(link)
  await symlink('lib/first.js', link)
  await Bun.write(first, 'export default 2\n')
  expect(await validateManagedPackageManifest(root, 'fixture@1')).toBe(false)
}))

test('managed package manifests refuse dependencies linked outside their installation', async () => withLocalTestDir('js-link', async root => {
  await symlink(process.execPath, join(root, 'external-runtime'))
  await expect(writeManagedPackageManifest(root, 'fixture@1')).rejects.toThrow('escapes')
}))

test('managed JS provenance diagnostics inspect receipts without spawning tools or downloading dependencies', async () => {
  const spawn = spyOn(Bun, 'spawn').mockImplementation(() => { throw new Error('Read-only diagnostics dispatched a process') })
  const noNetwork = () => { throw new Error('Read-only diagnostics attempted a download') }
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(noNetwork, { preconnect: noNetwork }))
  try {
    for (const result of await Promise.all([validateManagedJsRuntime('bun'), validateManagedJsRuntime('deno'), validateManagedAlignmentRuntime(), validateManagedDefuddleRuntime()])) {
      expect(typeof result.ok).toBe('boolean')
      expect(result.detail.length).toBeGreaterThan(0)
    }
    expect(spawn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { spawn.mockRestore(); fetch.mockRestore() }
})
