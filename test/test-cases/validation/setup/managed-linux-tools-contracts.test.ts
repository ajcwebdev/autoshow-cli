import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, mkdtemp, readlink, rename, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildManagedAptPlanArgs, managedAptBootstrapConfig, parseInstalledLinuxPackages, parseLinuxDebContents, parseManagedAptUris,
  readCachedLinuxPackagePlan, resolveInstalledLinuxPackageClosure, resolveManagedAptSha256
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-linux-package-plan'
import {
  collectLinuxPayload, copyInstalledLinuxPackagePaths, installLinuxToolWrappers,
  linuxPayloadPath, normalizeExtractedLinuxSymlinks, validateLinuxPayload
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-linux-payload'
import { stageInstalledLinuxToolchain, validateManagedLinuxToolchain } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-linux-tools'

const withTemp = async (fn: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-linux-contract-'))
  try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test('managed APT plans resolve all dependencies against an empty private installation state', () => {
  const args = buildManagedAptPlanArgs('/runtime/cache/linux-apt', ['ffmpeg', 'tesseract-ocr'])
  expect(args).toContain('Dir::State::status=/runtime/cache/linux-apt/status')
  expect(args).toContain('Dir::State::lists=/runtime/cache/linux-apt/lists')
  expect(args).toContain('Dir::Cache::archives=/runtime/cache/linux-apt/plan-cache/archives')
  expect(args).toContain('Dir::Etc::parts=-')
  expect(args).toContain('Acquire::AllowInsecureRepositories=false')
  expect(args).toContain('--download-only')
  expect(args).toContain('--print-uris')
  expect(args).toContain('--reinstall')
  expect(args.slice(-3)).toEqual(['install', 'ffmpeg', 'tesseract-ocr'])
  expect(managedAptBootstrapConfig()).toBe('Dir::Etc::main "-";\nDir::Etc::parts "-";\n')
})

test('signed APT package records bind URI, filename, byte size and SHA256 before extraction', () => {
  const sha256 = 'a'.repeat(64)
  const [entry] = parseManagedAptUris("'https://deb.debian.org/debian/pool/main/f/ffmpeg/ffmpeg_1.0_arm64.deb' ffmpeg_1.0_arm64.deb 123 MD5Sum:old\n")
  expect(entry).toBeDefined()
  expect(resolveManagedAptSha256(entry!, `Package: ffmpeg\nVersion: 1.0\nFilename: pool/main/f/ffmpeg/ffmpeg_1.0_arm64.deb\nSize: 123\nSHA256: ${sha256}\n`)).toBe(sha256)
  expect(() => resolveManagedAptSha256(entry!, `Filename: pool/other.deb\nSize: 123\nSHA256: ${sha256}`)).toThrow('no matching SHA256')
  expect(() => resolveManagedAptSha256(entry!, `Filename: pool/main/f/ffmpeg/ffmpeg_1.0_arm64.deb\nSize: 124\nSHA256: ${sha256}`)).toThrow('no matching SHA256')
  expect(resolveManagedAptSha256({ ...entry!, hash: `SHA256:${sha256}` }, '')).toBe(sha256)
  const [securityEntry] = parseManagedAptUris("'https://security.debian.org/pool/security_1_arm64.deb' security_1_arm64.deb 123 \n")
  expect(securityEntry?.hash).toBe('')
  expect(resolveManagedAptSha256(securityEntry!, `Filename: pool/security_1_arm64.deb\nSize: 123\nSHA256: ${sha256}`)).toBe(sha256)
})

test('APT planning rejects unsafe destinations, embedded credentials and incomplete package lists', () => {
  expect(() => parseManagedAptUris("'https://deb.debian.org/a.deb' ../a.deb 12 SHA256:a")).toThrow('unsafe')
  expect(() => parseManagedAptUris("'https://user:password@example.test/a.deb' a.deb 12 SHA256:a")).toThrow('without embedded credentials')
  expect(() => parseManagedAptUris('Reading package lists...')).toThrow('did not resolve any packages')
  expect(() => linuxPayloadPath('/runtime/tools/linux-root', '../../outside')).toThrow('escapes')
})

test('offline repair reuses an exact strong-hash package plan and rejects image-only or malformed records', () => {
  const plan = [{ url: 'https://deb.debian.org/debian/pool/qpdf_1_arm64.deb', fileName: 'qpdf_1_arm64.deb', size: 123, sha256: 'b'.repeat(64) }]
  expect(readCachedLinuxPackagePlan(plan)).toEqual(plan)
  expect(readCachedLinuxPackagePlan([{ name: 'qpdf', version: '1' }])).toBeUndefined()
  expect(readCachedLinuxPackagePlan([{ ...plan[0], sha256: 'weak' }])).toBeUndefined()
  expect(readCachedLinuxPackagePlan([{ ...plan[0], fileName: '../escape.deb' }])).toBeUndefined()
})

test('installed-image package closure follows installed alternatives and pre-dependencies', () => {
  const installed = parseInstalledLinuxPackages('tool\t1\tmissing | library (>= 2), common:any\tloader\nlibrary:arm64\t2\tcommon\t\ncommon\t3\t\t\nloader\t4\t\t\n')
  const closure = resolveInstalledLinuxPackageClosure(installed, ['tool'])
  expect(closure.map(entry => entry.name)).toEqual(['common', 'library:arm64', 'loader', 'tool'])
  expect(() => resolveInstalledLinuxPackageClosure(installed, ['unavailable'])).toThrow('not installed')
})

test('archive ownership parsing preserves spaces and link paths while rejecting unsafe or unreadable records', () => {
  expect(parseLinuxDebContents('drwxr-xr-x root/root 0 2026-01-01 12:00 ./usr/bin/\n-rwxr-xr-x root/root 12 2026-01-01 12:00 ./usr/bin/a tool\nlrwxrwxrwx root/root 0 2026-01-01 12:00 ./usr/bin/alias -> a tool\n')).toEqual(['/usr/bin/', '/usr/bin/a tool', '/usr/bin/alias'])
  expect(() => parseLinuxDebContents('-rw-r--r-- root/root 1 2026-01-01 12:00 ./../outside')).toThrow('Unsafe')
  expect(() => parseLinuxDebContents('unreadable archive output')).toThrow('Cannot read')
})

test('package copy preserves bytes, executable modes and internal symlink relationships after relocation', async () => {
  await withTemp(async root => {
    const source = join(root, 'source'), destination = join(root, 'payload')
    await mkdir(join(source, 'usr/bin'), { recursive: true })
    await Bun.write(join(source, 'usr/bin/qpdf-real'), '#!/bin/sh\nprintf "managed tool\\n"\n')
    await chmod(join(source, 'usr/bin/qpdf-real'), 0o755)
    await symlink('/usr/bin/qpdf-real', join(source, 'usr/bin/qpdf'))
    await symlink('.', join(source, 'usr/bin/X11'))
    await copyInstalledLinuxPackagePaths(source, destination, ['/usr/bin/qpdf', '/usr/bin/X11'])
    expect(await readlink(join(destination, 'usr/bin/qpdf'))).toBe('qpdf-real')
    const entries = await collectLinuxPayload(destination)
    expect(await readlink(join(destination, 'usr/bin/X11'))).toBe('.')
    expect(entries).toHaveLength(3)
    expect(entries.find(entry => entry.path === 'usr/bin/qpdf-real')?.mode).toBe(0o755)
    await rename(destination, join(root, 'moved-payload'))
    await validateLinuxPayload(join(root, 'moved-payload'), entries)
    await symlink('moved-payload', join(root, 'payload-alias'))
    await validateLinuxPayload(join(root, 'payload-alias'), entries)
    await Bun.write(join(root, 'moved-payload/usr/bin/qpdf-real'), 'corrupt')
    await expect(validateLinuxPayload(join(root, 'moved-payload'), entries)).rejects.toThrow('integrity failed')
  })
})

test('unactivated distribution alternatives retain their internal missing-target relationship', async () => {
  await withTemp(async root => {
    await mkdir(join(root, 'usr/bin'), { recursive: true })
    await symlink('../../etc/optional-alternative', join(root, 'usr/bin/optional-tool'))
    const entries = await collectLinuxPayload(root)
    expect(entries).toMatchObject([{ kind: 'symlink', target: '../../etc/optional-alternative', targetExists: false }])
    await validateLinuxPayload(root, entries)
    await mkdir(join(root, 'etc'), { recursive: true })
    await Bun.write(join(root, 'etc/optional-alternative'), 'unexpected replacement')
    await expect(validateLinuxPayload(root, entries)).rejects.toThrow('target relationship changed')
  })
})

test('extracted absolute links are rebased inside runtime and traversal links are rejected', async () => {
  await withTemp(async root => {
    await mkdir(join(root, 'usr/lib'), { recursive: true })
    await Bun.write(join(root, 'usr/lib/libfixture.so.1'), 'library')
    await symlink('/usr/lib/libfixture.so.1', join(root, 'usr/lib/libfixture.so'))
    await normalizeExtractedLinuxSymlinks(root)
    expect(await readlink(join(root, 'usr/lib/libfixture.so'))).toBe('libfixture.so.1')
    await symlink('../../../../outside', join(root, 'usr/lib/escape'))
    await expect(normalizeExtractedLinuxSymlinks(root)).rejects.toThrow('escapes runtime')
  })
})

test('managed wrappers execute relocated payloads with private font, cache and temp paths', async () => {
  await withTemp(async root => {
    const runtime = join(root, 'runtime'), payload = join(runtime, 'tools/linux-root')
    await mkdir(join(payload, 'usr/bin'), { recursive: true })
    await Bun.write(join(payload, 'usr/bin/qpdf'), '#!/bin/sh\nprintf "%s\\n" "$FONTCONFIG_FILE" "$TMPDIR" "$XDG_CACHE_HOME" "$1"\n')
    await chmod(join(payload, 'usr/bin/qpdf'), 0o755)
    await Bun.write(join(payload, 'usr/bin/pdftohtml'), '#!/bin/sh\nprintf "managed-delegate:%s\\n" "$1"\n')
    await chmod(join(payload, 'usr/bin/pdftohtml'), 0o755)
    await installLinuxToolWrappers(runtime)
    const moved = join(root, 'moved-runtime')
    await rename(runtime, moved)
    const result = Bun.spawnSync([join(moved, 'bin/qpdf'), 'argument with spaces'], { env: { PATH: '/usr/bin:/bin' } })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString().trim().split('\n')).toEqual([join(moved, 'fonts/fonts.conf'), join(moved, 'tmp'), join(moved, 'cache'), 'argument with spaces'])
    expect(Bun.spawnSync([join(moved, 'bin/pdftohtml'), 'a document.pdf']).stdout.toString()).toBe('managed-delegate:a document.pdf\n')
  })
})

test('nested output symlinks cannot redirect package or font writes outside the selected runtime', async () => {
  await withTemp(async root => {
    const source = join(root, 'source'), runtime = join(root, 'runtime'), outside = join(root, 'outside')
    await mkdir(join(source, 'usr/bin'), { recursive: true })
    await mkdir(join(runtime, 'tools/linux-root/usr/bin'), { recursive: true })
    await mkdir(outside)
    await Bun.write(join(source, 'usr/bin/qpdf'), '#!/bin/sh\nexit 0\n')
    await Bun.write(join(runtime, 'tools/linux-root/usr/bin/qpdf'), '#!/bin/sh\nexit 0\n')
    await chmod(join(runtime, 'tools/linux-root/usr/bin/qpdf'), 0o755)
    await symlink(outside, join(runtime, 'fonts'))
    await expect(installLinuxToolWrappers(runtime)).rejects.toThrow('inside the selected runtime')
    expect(await Bun.file(join(outside, 'fonts.conf')).exists()).toBe(false)
    const payload = join(root, 'payload')
    await mkdir(join(payload, 'usr'), { recursive: true })
    await symlink(outside, join(payload, 'usr/bin'))
    await expect(copyInstalledLinuxPackagePaths(source, payload, ['/usr/bin/qpdf'])).rejects.toThrow('inside the selected runtime')
    expect(await Bun.file(join(outside, 'qpdf')).exists()).toBe(false)
  })
})

test('Tesseract wrapper preserves explicit managed data errors and confines data-directory aliases', async () => {
  await withTemp(async root => {
    const runtime = join(root, 'runtime'), payload = join(runtime, 'tools/linux-root')
    const packaged = join(payload, 'usr/share/tesseract-ocr/5/tessdata')
    const explicit = join(runtime, 'tools/tessdata')
    const external = join(root, 'external-data')
    await mkdir(join(payload, 'usr/bin'), { recursive: true })
    for (const path of [packaged, explicit, external]) await mkdir(path, { recursive: true })
    await Bun.write(join(packaged, 'eng.traineddata'), 'packaged fixture bytes')
    await Bun.write(join(explicit, 'eng.traineddata'), '')
    await Bun.write(join(external, 'eng.traineddata'), 'external bytes')
    await Bun.write(join(payload, 'usr/bin/tesseract'), '#!/bin/sh\nprintf "%s\\n" "$TESSDATA_PREFIX"\ntest -s "$TESSDATA_PREFIX/eng.traineddata" || exit 9\n')
    await chmod(join(payload, 'usr/bin/tesseract'), 0o755)
    await installLinuxToolWrappers(runtime)
    const command = join(runtime, 'bin/tesseract')
    const fallback = Bun.spawnSync([command], { env: { PATH: '/usr/bin:/bin' } })
    expect(fallback.exitCode).toBe(0)
    expect(fallback.stdout.toString().trim()).toBe(packaged)
    const invalid = Bun.spawnSync([command], { env: { PATH: '/usr/bin:/bin', TESSDATA_PREFIX: explicit } })
    expect(invalid.exitCode).toBe(9)
    expect(invalid.stdout.toString().trim()).toBe(explicit)
    const outside = Bun.spawnSync([command], { env: { PATH: '/usr/bin:/bin', TESSDATA_PREFIX: external } })
    expect(outside.exitCode).toBe(2)
    expect(outside.stderr.toString()).toContain('must resolve inside runtime')
    await symlink(external, join(runtime, 'tools/escaped-tessdata'))
    const escaped = Bun.spawnSync([command], { env: { PATH: '/usr/bin:/bin', TESSDATA_PREFIX: join(runtime, 'tools/escaped-tessdata') } })
    expect(escaped.exitCode).toBe(2)
    const staged = join(root, 'staged-runtime')
    await mkdir(join(staged, 'tools'), { recursive: true })
    await symlink(payload, join(staged, 'tools/linux-root'))
    await installLinuxToolWrappers(staged, payload)
    const stagedFallback = Bun.spawnSync([join(staged, 'bin/tesseract')], { env: { PATH: '/usr/bin:/bin' } })
    expect(stagedFallback.exitCode, stagedFallback.stderr.toString()).toBe(0)
    expect(stagedFallback.stdout.toString().trim()).toBe(join(staged, 'tools/linux-root/usr/share/tesseract-ocr/5/tessdata'))
    const stagedExplicit = Bun.spawnSync([join(staged, 'bin/tesseract')], { env: { PATH: '/usr/bin:/bin', TESSDATA_PREFIX: packaged } })
    expect(stagedExplicit.exitCode).toBe(2)
  })
})

test('image packaging records its installed dependency closure and activates an executable wrapper', async () => {
  await withTemp(async root => {
    const source = join(root, 'source'), runtime = join(root, 'runtime')
    await mkdir(join(source, 'usr/bin'), { recursive: true })
    await Bun.write(join(source, 'usr/bin/qpdf'), '#!/bin/sh\nprintf "fixture-qpdf\\n"\n')
    await chmod(join(source, 'usr/bin/qpdf'), 0o755)
    await mkdir(join(source, 'var/lib/dpkg/info'), { recursive: true })
    await Bun.write(join(source, 'var/lib/dpkg/status'), 'Package: qpdf\nStatus: install ok installed\nVersion: 12.3\nArchitecture: arm64\nSource: qpdf (12.3)\nDescription: synthetic tool\n\n')
    await Bun.write(join(source, 'var/lib/dpkg/info/qpdf.list'), '/usr/bin/qpdf\n')
    await Bun.write(join(source, 'var/lib/dpkg/info/qpdf.md5sums'), `${new Bun.CryptoHasher('md5').update(await Bun.file(join(source, 'usr/bin/qpdf')).bytes()).digest('hex')}  usr/bin/qpdf\n`)
    const calls: string[][] = []
    await stageInstalledLinuxToolchain(runtime, {
      sourceRoot: source, packages: ['qpdf'], run: async (command, args) => {
        calls.push([command, ...args])
        return { exitCode: 0, stderr: '', stdout: args.includes('-W') ? 'qpdf\t12.3\t\t\n' : '/usr/bin/qpdf\n' }
      }
    })
    const receipt = await Bun.file(join(runtime, 'tools/linux-root/.autoshow-linux-toolchain.json')).json()
    expect(receipt.requestedPackages).toEqual(['qpdf'])
    expect(receipt.packages).toEqual([{ name: 'qpdf', version: '12.3' }])
    expect(receipt.catalogPrefixes).toBeUndefined()
    expect(receipt.payload.map((entry: {path:string}) => entry.path)).toEqual(['usr/bin/qpdf', 'var/lib/dpkg/info/qpdf.list', 'var/lib/dpkg/info/qpdf.md5sums', 'var/lib/dpkg/status'])
    expect(await Bun.file(join(runtime, 'tools/linux-root/var/lib/dpkg/info/qpdf.list')).text()).toBe(`${runtime}/tools/linux-root/usr/bin/qpdf\n`)
    expect(calls.every(call => call[0] === '/usr/bin/dpkg-query')).toBe(true)
    expect(Bun.spawnSync([join(runtime, 'bin/qpdf')]).stdout.toString()).toBe('fixture-qpdf\n')
    const before = await lstat(join(runtime, 'bin/qpdf'))
    await validateManagedLinuxToolchain(runtime)
    expect((await lstat(join(runtime, 'bin/qpdf'))).mtimeMs).toBe(before.mtimeMs)
    await mkdir(join(runtime, 'tools/wrapper-aliases'), { recursive: true })
    await rename(join(runtime, 'bin/qpdf'), join(runtime, 'tools/wrapper-aliases/qpdf'))
    await symlink('../tools/wrapper-aliases/qpdf', join(runtime, 'bin/qpdf'))
    await validateManagedLinuxToolchain(runtime)
    await Bun.write(join(runtime, 'bin/qpdf'), '#!/bin/sh\nprintf "same version, wrong executable\\n"\n')
    await expect(validateManagedLinuxToolchain(runtime)).rejects.toThrow('wrapper integrity failed')
    await installLinuxToolWrappers(runtime)
    const outside = join(root, 'external-wrapper')
    await Bun.write(outside, await Bun.file(join(runtime, 'bin/qpdf')).text())
    await chmod(outside, 0o755)
    await rm(join(runtime, 'bin/qpdf'))
    await symlink(outside, join(runtime, 'bin/qpdf'))
    await expect(validateManagedLinuxToolchain(runtime)).rejects.toThrow('escapes runtime')
    await rm(join(runtime, 'bin/qpdf'))
    await installLinuxToolWrappers(runtime)
    await Bun.write(join(runtime, 'tools/linux-root/usr/bin/untracked-plugin'), 'untracked module')
    await expect(validateManagedLinuxToolchain(runtime)).rejects.toThrow('inventory changed')
  })
})

test('image packaging catalogs both active and immutable seed copies without changing package identity', async () => {
  await withTemp(async root => {
    const source = join(root, 'source'), runtime = join(root, 'runtime')
    const executable = '#!/bin/sh\nprintf "fixture-qpdf\\n"\n'
    const digest = new Bun.CryptoHasher('md5').update(executable).digest('hex')
    await mkdir(join(source, 'usr/bin'), { recursive: true })
    await Bun.write(join(source, 'usr/bin/qpdf'), executable)
    await chmod(join(source, 'usr/bin/qpdf'), 0o755)
    await mkdir(join(source, 'var/lib/dpkg/info'), { recursive: true })
    await Bun.write(join(source, 'var/lib/dpkg/status'), 'Package: qpdf\nStatus: install ok installed\nVersion: 12.3\nArchitecture: arm64\nSource: qpdf (12.3)\nDescription: synthetic tool\n\n')
    await Bun.write(join(source, 'var/lib/dpkg/info/qpdf.list'), '/usr/bin/qpdf\n')
    await Bun.write(join(source, 'var/lib/dpkg/info/qpdf.md5sums'), `${digest}  usr/bin/qpdf\n`)
    const active = '/app/runtime/tools/linux-root', seed = '/opt/autoshow-runtime/tools/linux-root'
    await stageInstalledLinuxToolchain(runtime, {
      sourceRoot: source, packages: ['qpdf'], catalogPrefix: active, additionalCatalogPrefixes: [seed],
      run: async (_command, args) => ({ exitCode: 0, stderr: '', stdout: args.includes('-W') ? 'qpdf\t12.3\t\t\n' : '/usr/bin/qpdf\n' })
    })
    const payloadRoot = join(runtime, 'tools/linux-root')
    const receipt = await Bun.file(join(payloadRoot, '.autoshow-linux-toolchain.json')).json()
    expect(receipt.catalogPrefix).toBe(active)
    expect(receipt.catalogPrefixes).toEqual([active, seed])
    expect(receipt.packages).toEqual([{ name: 'qpdf', version: '12.3' }])
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/info/qpdf.list')).text()).toBe(`${active}/usr/bin/qpdf\n${seed}/usr/bin/qpdf\n`)
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/info/qpdf.md5sums')).text()).toBe(`${digest}  ${active.slice(1)}/usr/bin/qpdf\n${digest}  ${seed.slice(1)}/usr/bin/qpdf\n`)
    expect(await Bun.file(join(payloadRoot, 'usr/bin/qpdf')).text()).toBe(executable)
    expect(await Bun.file(join(payloadRoot, 'var/lib/dpkg/status')).text()).toContain('Source: qpdf (12.3)')
  })
})
