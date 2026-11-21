import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseLinuxDebianControl, relocateLinuxCatalogPath, writeInstalledLinuxCatalog, writeLinuxPackageCatalog
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-linux-catalog'

const withTemp = async (fn: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-linux-catalog-'))
  try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
}

const digest = '0123456789abcdef0123456789abcdef'
const control = `Package: libfixture
Status: install ok installed
Priority: optional
Architecture: arm64
Multi-Arch: same
Source: fixture-source (1:2.3-4)
Version: 1:2.3-4+b1
Maintainer: AutoShow Fixture
Conffiles:
 /etc/fixture configuration ${digest}
Description: Synthetic catalog fixture
 The continued description is preserved.
 .
 Its second paragraph remains attached.
`

test('Debian control parsing preserves multiline/source identity and rejects ambiguous duplicate fields', () => {
  const [record] = parseLinuxDebianControl(control.replace(/\n/g, '\r\n'))
  expect(record?.fields.get('Source')).toBe('fixture-source (1:2.3-4)')
  expect(record?.fields.get('Description')).toContain('\n .\n')
  expect(() => parseLinuxDebianControl('Package: fixture\npackage: duplicate\n')).toThrow('Duplicate')
  expect(() => parseLinuxDebianControl(' continued without field\n')).toThrow('no preceding field')
})

test('installed catalog includes only selected exact package versions and relocates ownership without changing hashes', async () => {
  await withTemp(async root => {
    const source = join(root, 'source'), payload = join(root, 'payload')
    const info = join(source, 'var/lib/dpkg/info')
    await mkdir(info, { recursive: true })
    await Bun.write(join(source, 'var/lib/dpkg/status'), `${control}\nPackage: unrelated\nStatus: install ok installed\nArchitecture: all\nVersion: 9\nDescription: Unselected package\n\n`)
    await Bun.write(join(info, 'libfixture:arm64.list'), '/.\n/usr/lib/libfixture.so.1\n/etc/fixture configuration\n')
    const originalMd5 = `${digest}  usr/lib/libfixture.so.1\n`
    await Bun.write(join(info, 'libfixture:arm64.md5sums'), originalMd5)
    await Bun.write(join(info, 'libfixture:arm64.conffiles'), '/etc/fixture configuration\n')
    const result = await writeInstalledLinuxCatalog({ sourceRoot: source, payloadRoot: payload, catalogPrefix: '/app/runtime/tools/linux-root', packages: [{ name: 'libfixture:arm64', version: '1:2.3-4+b1' }] })
    expect(result).toEqual({ packages: 1, files: 4 })
    const status = await Bun.file(join(payload, 'var/lib/dpkg/status')).text()
    expect(status).toContain('Source: fixture-source (1:2.3-4)')
    expect(status).toContain('Version: 1:2.3-4+b1')
    expect(status).toContain(` /app/runtime/tools/linux-root/etc/fixture configuration ${digest}`)
    expect(status).toContain(' The continued description is preserved.\n .\n Its second paragraph remains attached.')
    expect(status).not.toContain('unrelated')
    expect((await readdir(join(payload, 'var/lib/dpkg/info'))).sort()).toEqual(['libfixture:arm64.conffiles', 'libfixture:arm64.list', 'libfixture:arm64.md5sums'])
    expect(await Bun.file(join(payload, 'var/lib/dpkg/info/libfixture:arm64.list')).text()).toBe('/app/runtime/tools/linux-root\n/app/runtime/tools/linux-root/etc/fixture configuration\n/app/runtime/tools/linux-root/usr/lib/libfixture.so.1\n')
    expect(await Bun.file(join(payload, 'var/lib/dpkg/info/libfixture:arm64.md5sums')).text()).toBe(`${digest}  app/runtime/tools/linux-root/usr/lib/libfixture.so.1\n`)
    expect(await Bun.file(join(info, 'libfixture:arm64.md5sums')).text()).toBe(originalMd5)
  })
})

test('downloaded control records gain private installed status and retain expected package/source metadata', async () => {
  await withTemp(async payloadRoot => {
    const result = await writeLinuxPackageCatalog({
      payloadRoot, catalogPrefix: '/another/runtime/tools/linux-root', packages: [{
        controlText: 'Package: fixture-app\nVersion: 3.4-2\nArchitecture: all\nSource: fixture-source\nDescription: Synthetic application\n',
        expected: { name: 'fixture-app', version: '3.4-2' },
        packagePaths: ['./', './usr/share/fixture/data with spaces'],
        md5sumsText: `${digest}  usr/share/fixture/data with spaces\n`
      }]
    })
    expect(result.packages).toBe(1)
    const status = await Bun.file(join(payloadRoot, 'var/lib/dpkg/status')).text()
    expect(status).toContain('Package: fixture-app\nStatus: install ok installed\n')
    expect(status).toContain('Source: fixture-source')
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/info/fixture-app.md5sums')).text()).toBe(`${digest}  another/runtime/tools/linux-root/usr/share/fixture/data with spaces\n`)
  })
})

test('installed catalog attributes identical active and immutable seed copies to unchanged Debian identities', async () => {
  await withTemp(async root => {
    const sourceRoot = join(root, 'source'), payloadRoot = join(root, 'seed')
    const sourceInfo = join(sourceRoot, 'var/lib/dpkg/info')
    await mkdir(sourceInfo, { recursive: true })
    await Bun.write(join(sourceRoot, 'var/lib/dpkg/status'), control)
    const ownedPath = '/usr/lib/python3/dist-packages/fixture-1.0.dist-info/METADATA'
    await Bun.write(join(sourceInfo, 'libfixture:arm64.list'), `${ownedPath}\n`)
    await Bun.write(join(sourceInfo, 'libfixture:arm64.md5sums'), `${digest}  ${ownedPath.slice(1)}\n`)
    await Bun.write(join(sourceInfo, 'libfixture:arm64.conffiles'), 'remove-on-upgrade /etc/fixture configuration\n')
    const active = '/app/runtime/tools/linux-root', seed = '/opt/autoshow-runtime/tools/linux-root'
    await writeInstalledLinuxCatalog({
      sourceRoot, payloadRoot, catalogPrefix: active,
      additionalCatalogPrefixes: [seed, `${seed}/`, active],
      packages: [{ name: 'libfixture:arm64', version: '1:2.3-4+b1' }]
    })
    const info = join(payloadRoot, 'var/lib/dpkg/info')
    expect(await Bun.file(join(info, 'libfixture:arm64.list')).text()).toBe(`${active}${ownedPath}\n${seed}${ownedPath}\n`)
    expect(await Bun.file(join(info, 'libfixture:arm64.md5sums')).text()).toBe(`${digest}  ${active.slice(1)}${ownedPath}\n${digest}  ${seed.slice(1)}${ownedPath}\n`)
    expect(await Bun.file(join(info, 'libfixture:arm64.conffiles')).text()).toBe(`remove-on-upgrade ${active}/etc/fixture configuration\nremove-on-upgrade ${seed}/etc/fixture configuration\n`)
    const status = await Bun.file(join(payloadRoot, 'var/lib/dpkg/status')).text()
    expect(status).toContain(` ${active}/etc/fixture configuration ${digest}\n ${seed}/etc/fixture configuration ${digest}\n`)
    const records = parseLinuxDebianControl(status)
    expect(records.length).toBe(1)
    expect(records[0]?.fields.get('Source')).toBe('fixture-source (1:2.3-4)')
    expect(records[0]?.fields.get('Version')).toBe('1:2.3-4+b1')
    expect(await Bun.file(join(sourceRoot, 'var/lib/dpkg/status')).text()).toBe(control)
    expect(await Bun.file(join(sourceInfo, 'libfixture:arm64.md5sums')).text()).toBe(`${digest}  ${ownedPath.slice(1)}\n`)
  })
})

test('conffile relocation preserves remove-on-upgrade directives and obsolete status checksums', async () => {
  await withTemp(async payloadRoot => {
    await writeLinuxPackageCatalog({
      payloadRoot, catalogPrefix: '/app/runtime/tools/linux-root', packages: [{
        controlText: control.replace(`${digest}\nDescription:`, `${digest} obsolete\nDescription:`),
        packagePaths: ['/etc/fixture configuration'],
        conffilesText: 'remove-on-upgrade /etc/fixture configuration\n/etc/ordinary configuration\n'
      }]
    })
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/info/libfixture:arm64.conffiles')).text()).toBe('remove-on-upgrade /app/runtime/tools/linux-root/etc/fixture configuration\n/app/runtime/tools/linux-root/etc/ordinary configuration\n')
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/status')).text()).toContain(` /app/runtime/tools/linux-root/etc/fixture configuration ${digest} obsolete\n`)
  })
})

test('catalog identity, checksum and traversal failures occur before writing output', async () => {
  await withTemp(async root => {
    const payloadRoot = join(root, 'payload')
    const record = { controlText: control, packagePaths: ['/usr/lib/libfixture.so.1'], expected: { name: 'libfixture:arm64', version: 'wrong' } }
    await expect(writeLinuxPackageCatalog({ payloadRoot, catalogPrefix: '/app/runtime/tools/linux-root', packages: [record] })).rejects.toThrow('identity differs')
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/status')).exists()).toBe(false)
    await expect(writeLinuxPackageCatalog({ payloadRoot, catalogPrefix: '/app/runtime/tools/linux-root', packages: [{ ...record, expected: undefined, md5sumsText: 'not a digest  usr/lib/libfixture.so.1\n' }] })).rejects.toThrow('Malformed')
    expect(() => relocateLinuxCatalogPath('../../escape', '/app/runtime/tools/linux-root')).toThrow('Unsafe path')
    expect(() => relocateLinuxCatalogPath('/usr/file', '/app/runtime/../outside')).toThrow('normalized absolute')
  })
})

test('nested catalog symlinks cannot redirect writes outside the selected payload', async () => {
  await withTemp(async root => {
    const payloadRoot = join(root, 'payload'), outside = join(root, 'outside')
    await mkdir(join(payloadRoot, 'var/lib'), { recursive: true })
    await mkdir(outside)
    await symlink(outside, join(payloadRoot, 'var/lib/dpkg'))
    await expect(writeLinuxPackageCatalog({ payloadRoot, catalogPrefix: '/app/runtime/tools/linux-root', packages: [{ controlText: control, packagePaths: ['/usr/lib/libfixture.so.1'] }] })).rejects.toThrow('inside the selected payload')
    expect(await readdir(outside)).toEqual([])
  })
})

test('installed catalog rejects changed versions and removed package state', async () => {
  await withTemp(async root => {
    const sourceRoot = join(root, 'source')
    await mkdir(join(sourceRoot, 'var/lib/dpkg/info'), { recursive: true })
    await Bun.write(join(sourceRoot, 'var/lib/dpkg/status'), control)
    await Bun.write(join(sourceRoot, 'var/lib/dpkg/info/libfixture:arm64.list'), '/usr/lib/libfixture.so.1\n')
    await expect(writeInstalledLinuxCatalog({ sourceRoot, payloadRoot: join(root, 'payload'), catalogPrefix: '/app/runtime/tools/linux-root', packages: [{ name: 'libfixture:arm64', version: 'different' }] })).rejects.toThrow('identity differs')
    await Bun.write(join(sourceRoot, 'var/lib/dpkg/status'), control.replace('install ok installed', 'deinstall ok config-files'))
    await expect(writeInstalledLinuxCatalog({ sourceRoot, payloadRoot: join(root, 'payload'), catalogPrefix: '/app/runtime/tools/linux-root', packages: [{ name: 'libfixture:arm64', version: '1:2.3-4+b1' }] })).rejects.toThrow('not fully installed')
  })
})
