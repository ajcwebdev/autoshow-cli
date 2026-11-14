import { describe, expect, test } from 'bun:test'
import { chmod, cp, mkdir, readlink, realpath, rename, rm, stat, symlink, utimes } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  assertManagedFfmpegCapabilities,
  buildManagedCalibreSandboxArguments,
  buildManagedCalibreWrapperScript,
  buildManagedQpdfWrapperScript,
  buildManagedTesseractWrapperScript,
  completeManagedLeptonicaConfig,
  validateManagedCalibreApplication,
  ensureManagedMacosSourceDependencies,
  ensurePinnedTesseractData,
  prepareManagedSourceBuild,
  MANAGED_FFMPEG_BUILD_FLAGS
} from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { withLocalTestDir, withTempDir } from '../../../test-utils/temp-dirs'
import { RUNTIME_BUILD_DIR } from '~/utils/runtime-paths'
import { copyManagedApplicationBundle } from '~/cli/commands/setup-and-utilities/setup/setup-download/dmg'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-native-capability-' })

const runShellFixture = async (path: string, args: string[] = [], environment: Record<string, string> = {}) => {
  const child = Bun.spawn([path, ...args], { stdout: 'pipe', stderr: 'pipe', env: { PATH: '/usr/bin:/bin', ...environment } })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('managed macOS native capabilities', () => {
  test('source prerequisites forward normal, forced and reset options to build helpers, every native component and LAME before application builds', async () => {
    const events: Array<{ component: string, forceRedownload: boolean }> = []
    const record = (component: string, options: { forceRedownload?: boolean }) => { events.push({ component, forceRedownload: options.forceRedownload === true }) }
    const services: Parameters<typeof ensureManagedMacosSourceDependencies>[3] = {
      buildTools: async options => { record('build-tools', options ?? {}) },
      nativeDependency: async (name, options) => { await Promise.resolve(); record(name, options ?? {}) }
    }
    const sources = [async (options: { forceRedownload?: boolean }) => { record('lame', options) }]
    await ensureManagedMacosSourceDependencies(['libass', 'x264', 'zlib'], sources, {}, services)
    await ensureManagedMacosSourceDependencies(['libass', 'x264', 'zlib'], sources, { forceRedownload: true }, services)
    await ensureManagedMacosSourceDependencies(['libass', 'x264', 'zlib'], sources, undefined, services)
    expect(events).toEqual([false, true, false].flatMap(forceRedownload => ['build-tools', 'libass', 'x264', 'zlib', 'lame'].map(component => ({ component, forceRedownload }))))
  })
  test('recorded Calibre producer paths appearing as files, dangling links or symlink ancestors block dispatch', async () => {
    await withTempDir('autoshow-calibre-producer-guard-', async directory => {
      const runtime = join(directory, 'runtime')
      await mkdir(join(runtime, 'bin'), { recursive: true })
      await mkdir(join(runtime, 'tools/calibre/calibre.app/Contents/MacOS'), { recursive: true })
      const marker = join(directory, 'executed')
      const engine = join(runtime, 'tools/calibre/calibre.app/Contents/MacOS/ebook-convert')
      await Bun.write(engine, `#!/bin/sh\nprintf executed > '${marker}'\n`)
      await chmod(engine, 0o755)
      const wrapper = join(runtime, 'bin/ebook-convert')
      for (const kind of ['file', 'dangling-link', 'ancestor-link']) {
        const path = kind === 'ancestor-link' ? join(directory, `${kind}/lib`) : join(directory, kind)
        if (kind === 'file') await Bun.write(path, 'foreign candidate')
        else await symlink(join(directory, 'missing'), kind === 'ancestor-link' ? join(directory, kind) : path)
        const script = buildManagedCalibreWrapperScript([path])
        await Bun.write(wrapper, script)
        await chmod(wrapper, 0o755)
        const result = await runShellFixture(wrapper, ['--version'])
        expect(result.exitCode).toBe(1)
        expect(result.stderr).toContain('Managed Calibre producer search path')
        expect(await Bun.file(marker).exists()).toBe(false)
        expect(script).toContain('unset DYLD_LIBRARY_PATH DYLD_FALLBACK_LIBRARY_PATH')
      }
      const reviewedAliasScript = buildManagedCalibreWrapperScript(['/private/var/fixture-inert-producer/lib'])
      expect(reviewedAliasScript).toContain('CDPATH= cd -P /var && pwd -P')
      expect(reviewedAliasScript).toContain('!= /private/var')
      const absentFramework = 'Contents/Frameworks/Unavailable.framework'
      await mkdir(join(runtime, 'tools/calibre/calibre.app', absentFramework), { recursive: true })
      await Bun.write(wrapper, buildManagedCalibreWrapperScript([], [], [absentFramework]))
      const appeared = await runShellFixture(wrapper, ['--version'])
      expect(appeared.exitCode).toBe(1)
      expect(appeared.stderr).toContain('unavailable framework appeared')
      expect(await Bun.file(marker).exists()).toBe(false)
    })
  })
  test('application copies preserve nested relative framework links after the source mount disappears', async () => {
    await withTempDir('autoshow-app-copy-', async directory => {
      const source = join(directory, 'mounted.app'), copied = join(directory, 'copied.app')
      await mkdir(join(source, 'Contents/Frameworks'), { recursive: true })
      await mkdir(join(source, 'Contents/Helper.app/Contents'), { recursive: true })
      await Bun.write(join(source, 'Contents/Frameworks/payload'), 'synthetic framework content')
      if (process.platform === 'darwin') {
        expect((await runCapture('/usr/bin/xattr', ['-w', 'org.autoshow.fixture', 'retained-metadata', join(source, 'Contents/Frameworks/payload')])).exitCode).toBe(0)
      }
      await symlink('../../Frameworks', join(source, 'Contents/Helper.app/Contents/Frameworks'))
      await copyManagedApplicationBundle(source, copied)
      await rename(source, join(directory, 'unmounted.app'))
      expect(await readlink(join(copied, 'Contents/Helper.app/Contents/Frameworks'))).toBe('../../Frameworks')
      expect(await Bun.file(join(copied, 'Contents/Helper.app/Contents/Frameworks/payload')).text()).toBe('synthetic framework content')
      expect(await realpath(join(copied, 'Contents/Helper.app/Contents/Frameworks'))).toBe(join(copied, 'Contents/Frameworks'))
      if (process.platform === 'darwin') {
        const attributes = await runCapture('/usr/bin/xattr', ['-p', 'org.autoshow.fixture', join(copied, 'Contents/Frameworks/payload')])
        expect(attributes.exitCode).toBe(0)
        expect(attributes.stdout.trim()).toBe('retained-metadata')
      }
    })
  })
  test('a new source attempt preserves the full previous tree, bytes, modes, timestamps and relative link relationships', async () => {
    const root = join(RUNTIME_BUILD_DIR, `test-attempt-preservation-${crypto.randomUUID()}`)
    const component = join(root, 'component')
    try {
      await mkdir(join(component, 'src'), { recursive: true })
      const previousFile = join(component, 'src/source.c')
      await Bun.write(previousFile, 'synthetic retained source bytes\n')
      await chmod(previousFile, 0o640)
      await utimes(previousFile, new Date('2020-01-02T03:04:05Z'), new Date('2020-01-02T03:04:05Z'))
      await symlink('src/source.c', join(component, 'source-link'))
      const before = await stat(previousFile)
      const preserved = await prepareManagedSourceBuild(component)
      expect(preserved).toBeDefined()
      const retainedFile = join(preserved!, 'src/source.c')
      expect(await Bun.file(retainedFile).text()).toBe('synthetic retained source bytes\n')
      const after = await stat(retainedFile)
      expect(after.mode & 0o777).toBe(before.mode & 0o777)
      expect(after.mtimeMs).toBe(before.mtimeMs)
      expect(await readlink(join(preserved!, 'source-link'))).toBe('src/source.c')
      expect(await realpath(join(preserved!, 'source-link'))).toBe(retainedFile)
      await rm(component, { recursive: true })
      expect(await Bun.file(retainedFile).text()).toBe('synthetic retained source bytes\n')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  test('corrupt pinned Tesseract data is repaired by a verified download and healthy data is reused byte-for-byte', async () => {
    await withTempDir('autoshow-tessdata-repair-', async directory => {
      const destination = join(directory, 'eng.traineddata')
      const payload = 'synthetic language artifact\n'
      const sha256 = new Bun.CryptoHasher('sha256').update(payload).digest('hex')
      await Bun.write(destination, 'corrupt language data')
      const requests = installMockFetch(() => new Response(payload))
      const source = { destination, url: 'https://example.test/eng.traineddata', sha256, expectedMinBytes: payload.length }
      expect(await ensurePinnedTesseractData(source)).toBe(true)
      expect(await Bun.file(destination).text()).toBe(payload)
      const before = await stat(destination)
      expect(await ensurePinnedTesseractData(source)).toBe(false)
      const after = await stat(destination)
      expect(after.mtimeMs).toBe(before.mtimeMs)
      expect(requests).toHaveLength(1)
      expect(await ensurePinnedTesseractData({ ...source, forceRedownload: true })).toBe(true)
      expect(requests).toHaveLength(2)
      expect(await Bun.file(destination).text()).toBe(payload)
    })
  })

  test('a failed Tesseract data checksum leaves the installed language bytes intact', async () => {
    await withTempDir('autoshow-tessdata-checksum-', async directory => {
      const destination = join(directory, 'eng.traineddata')
      await Bun.write(destination, 'previous language artifact')
      const expected = 'expected replacement bytes'
      installMockFetch(() => new Response('wrong replacement bytes'))
      await expect(ensurePinnedTesseractData({
        destination, url: 'https://example.test/eng.traineddata',
        sha256: new Bun.CryptoHasher('sha256').update(expected).digest('hex'), expectedMinBytes: 1
      })).rejects.toThrow('SHA-256 mismatch')
      expect(await Bun.file(destination).text()).toBe('previous language artifact')
    })
  })
  test('a rejected signed application assessment prevents Calibre executable dispatch', async () => {
    const calls: string[] = []
    const execute: typeof runCapture = async command => {
      calls.push(command)
      return { exitCode: command === '/usr/sbin/spctl' ? 3 : 0, stdout: '', stderr: 'fixture assessment rejection' }
    }
    let inspected = false
    await expect(validateManagedCalibreApplication('/managed/calibre.app', '9.9.0', {
      execute, inspectDependencies: async () => { inspected = true }
    })).rejects.toThrow('rejected by macOS assessment before application execution')
    expect(calls).toEqual(['/usr/bin/codesign', '/usr/sbin/spctl'])
    expect(inspected).toBe(false)
  })

  test('invalid Calibre signature prevents assessment and executable dispatch', async () => {
    const calls: string[] = []
    const execute: typeof runCapture = async command => {
      calls.push(command)
      return { exitCode: 1, stdout: '', stderr: 'invalid fixture signature' }
    }
    await expect(validateManagedCalibreApplication('/managed/calibre.app', '9.9.0', { execute })).rejects.toThrow('signature verification failed before application execution')
    expect(calls).toEqual(['/usr/bin/codesign'])
  })

  test('stripped signature metadata on unchanged bytes is assessed before every Calibre dispatch', async () => {
    if (process.platform !== 'darwin') return
    await withTempDir('autoshow-calibre-signature-metadata-', async directory => {
      const payload = join(directory, 'signature-resource')
      const app = join(directory, 'calibre.app')
      await mkdir(app)
      const bytes = 'synthetic signed resource bytes'
      await Bun.write(payload, bytes)
      await runCapture('/usr/bin/xattr', ['-w', 'org.autoshow.signature-fixture', 'fixture-signature', payload])
      const calls: string[] = []
      const execute: typeof runCapture = async command => {
        calls.push(command)
        if (command === '/usr/bin/codesign') {
          const metadata = await runCapture('/usr/bin/xattr', ['-p', 'org.autoshow.signature-fixture', payload], { allowFailure: true })
          return { exitCode: metadata.exitCode, stdout: '', stderr: metadata.exitCode ? 'fixture signature metadata missing' : '' }
        }
        return { exitCode: 0, stdout: command === '/usr/bin/sandbox-exec' ? 'ebook-convert (calibre 9.9.0)' : '', stderr: '' }
      }
      const options = { execute, inspectDependencies: async () => {} }
      await validateManagedCalibreApplication(app, '9.9.0', options)
      expect(calls.at(-1)).toBe('/usr/bin/sandbox-exec')
      await runCapture('/usr/bin/xattr', ['-d', 'org.autoshow.signature-fixture', payload])
      expect(await Bun.file(payload).text()).toBe(bytes)
      calls.length = 0
      await expect(validateManagedCalibreApplication(app, '9.9.0', options)).rejects.toThrow('signature verification failed before application execution')
      expect(calls).toEqual(['/usr/bin/codesign'])
    })
  })

  test('accepted application metadata and contained dependencies precede the sandboxed Calibre version probe', async () => {
    await withTempDir('autoshow-calibre-dispatch-', async directory => {
      const app = join(directory, 'calibre.app')
      await mkdir(app)
      const events: string[] = []
      let sandboxArgs: string[] = []
      const execute: typeof runCapture = async (command, args = []) => {
        events.push(command)
        if (command === '/usr/bin/sandbox-exec') sandboxArgs = args
        return { exitCode: 0, stdout: command === '/usr/bin/sandbox-exec' ? 'ebook-convert (calibre 9.9.0)' : '', stderr: '' }
      }
      await validateManagedCalibreApplication(app, '9.9.0', {
        execute, inspectDependencies: async () => { events.push('native dependency inspection') }
      })
      expect(events).toEqual(['/usr/bin/codesign', '/usr/sbin/spctl', 'native dependency inspection', '/usr/bin/sandbox-exec'])
      expect(sandboxArgs.slice(-2)).toEqual([join(await realpath(app), 'Contents/MacOS/ebook-convert'), '--version'])
    })
  })

  test('the injected read-only executor handles Calibre signature assessment and every Mach-O inspection before application dispatch', async () => {
    await withLocalTestDir('calibre-read-only-inspection', async directory => {
      const app = join(directory, 'calibre.app'), binary = join(app, 'Contents/MacOS/ebook-convert')
      await mkdir(dirname(binary), { recursive: true })
      await Bun.write(binary, new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]))
      const calls: Array<{ command: string, args: string[] }> = []
      const execute: typeof runCapture = async (command, args = []) => {
        calls.push({ command, args })
        const stdout = command === '/usr/bin/otool'
          ? args[0] === '-l'
            ? 'Load command 0\n          cmd LC_RPATH\n      cmdsize 48\n         path /external/fixture-lib (offset 12)\n'
            : `${binary}:\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1.0.0)\n`
          : ''
        return { exitCode: 0, stdout, stderr: '' }
      }
      await expect(validateManagedCalibreApplication(app, '9.9.0', { execute })).rejects.toThrow('external or unresolved runpath')
      expect(calls.map(call => call.command)).toEqual(['/usr/bin/codesign', '/usr/sbin/spctl', '/usr/bin/otool', '/usr/bin/otool'])
      expect(calls.slice(-2).map(call => call.args)).toEqual([['-l', binary], ['-L', binary]])
      expect(calls.some(call => call.command === '/usr/bin/sandbox-exec' || call.command === binary)).toBe(false)

      const failedInspection: typeof runCapture = async command => ({ exitCode: command === '/usr/bin/otool' ? 1 : 0, stdout: '', stderr: command === '/usr/bin/otool' ? 'fixture read-only inspection denied' : '' })
      await expect(validateManagedCalibreApplication(app, '9.9.0', { execute: failedInspection })).rejects.toThrow('fixture read-only inspection denied')
    })
  })

  test('failed sandboxed Calibre version checks retain bounded actual subprocess diagnostics', async () => {
    await withTempDir('autoshow-calibre-probe-error-', async directory => {
      const app = join(directory, 'calibre.app')
      await mkdir(app)
      const calls: string[] = []
      const execute: typeof runCapture = async command => {
        calls.push(command)
        return command === '/usr/bin/sandbox-exec'
          ? { exitCode: 71, stdout: '', stderr: `${'diagnostic '.repeat(1000)}\nsandbox_apply: Operation not permitted` }
          : { exitCode: 0, stdout: '', stderr: '' }
      }
      let failure: unknown
      try { await validateManagedCalibreApplication(app, '9.9.0', { execute, inspectDependencies: async () => {} }) } catch (error) { failure = error }
      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toContain('exit 71')
      expect((failure as Error).message).toContain('sandbox_apply: Operation not permitted')
      expect((failure as Error).message.length).toBeLessThan(3200)
      expect(calls).toEqual(['/usr/bin/codesign', '/usr/sbin/spctl', '/usr/bin/sandbox-exec'])
    })
  })

  test('the macOS Calibre sandbox denies optional native-image reads and networking while permitting supported files', async () => {
    if (process.platform !== 'darwin') return
    await withTempDir('autoshow-calibre-sandbox-', async directory => {
      const app = join(directory, 'calibre.app')
      await mkdir(join(app, 'Contents/Frameworks/plugins'), { recursive: true })
      const image = 'Contents/Frameworks/plugins/optional-fixture.so'
      const forbidden = join(app, image), supported = join(app, 'supported.txt')
      await Bun.write(forbidden, 'unavailable native image fixture')
      await Bun.write(supported, 'supported CLI file fixture')
      const args = await buildManagedCalibreSandboxArguments(app, [{ image, missingDependencies: [] }])
      const denied = await runCapture('/usr/bin/sandbox-exec', [...args, '/bin/cat', forbidden], { allowFailure: true })
      const allowed = await runCapture('/usr/bin/sandbox-exec', [...args, '/bin/cat', supported], { allowFailure: true })
      expect(denied.exitCode).not.toBe(0)
      expect(denied.stdout).toBe('')
      expect(allowed).toMatchObject({ exitCode: 0, stdout: 'supported CLI file fixture' })
      const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('local network fixture') })
      try {
        const probe = ['/usr/bin/nc', '-G', '1', '-z', '127.0.0.1', String(server.port)]
        const reachable = await runCapture(probe[0]!, probe.slice(1), { allowFailure: true })
        const blocked = await runCapture('/usr/bin/sandbox-exec', [...args, ...probe], { allowFailure: true })
        expect(reachable.exitCode).toBe(0)
        expect(blocked.exitCode).not.toBe(0)
      } finally { server.stop(true) }
      const wrapper = buildManagedCalibreWrapperScript([], [{ image, missingDependencies: [] }], ['Contents/Frameworks/Absent.framework'])
      expect(wrapper).toContain('if [ ! -x /usr/bin/sandbox-exec ]; then')
      expect(wrapper).toContain('exec /usr/bin/sandbox-exec -p')
      expect(wrapper).toContain("(deny network*)' /usr/bin/codesign --verify")
      expect(wrapper).toContain("(deny network*)' /usr/sbin/spctl --assess")
      expect(wrapper).toContain('unavailable framework appeared')
    })
  })
  test('static Leptonica exports resolve codec targets before downstream CMake compile probes', () => {
    const config = completeManagedLeptonicaConfig('include(CMakeFindDependencyMacro)\ninclude(${CMAKE_CURRENT_LIST_DIR}/LeptonicaTargets.cmake)\n')
    for (const dependency of ['ZLIB', 'PNG', 'JPEG', 'TIFF']) {
      expect(config.indexOf(`find_dependency(${dependency} REQUIRED)`)).toBeGreaterThanOrEqual(0)
      expect(config.indexOf(`find_dependency(${dependency} REQUIRED)`)).toBeLessThan(config.indexOf('include(${CMAKE_CURRENT_LIST_DIR}/LeptonicaTargets.cmake)'))
    }
  })
  test('the FFmpeg recipe explicitly requests ASS rendering and CPU H.264/AAC/MP3 support', () => {
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--disable-autodetect')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--enable-libass')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--enable-libx264')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--enable-libmp3lame')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--enable-zlib')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--enable-securetransport')
    expect(MANAGED_FFMPEG_BUILD_FLAGS).toContain('--pkg-config-flags=--static')
  })

  test('the capability gate dispatches software encoding after inspecting filters and encoders', async () => {
    const calls: string[][] = []
    const execute: typeof runCapture = async (_binary, args = []) => {
      calls.push(args)
      return { exitCode: 0, stderr: '', stdout: args.includes('-filters') ? ' TSC ass V->V Render ASS subtitles\n' : ' V....D libx264 libx264 H.264 encoder\n A....D aac AAC encoder\n A....D libmp3lame MP3 encoder\n' }
    }
    await assertManagedFfmpegCapabilities('/managed/ffmpeg', execute)
    expect(calls).toHaveLength(3)
    expect(calls[2]).toEqual([
      '-hide_banner', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1',
      '-frames:v', '1', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'null', '-'
    ])
  })

  test('a version-compatible FFmpeg without ASS is rejected before encoding', async () => {
    let encoded = false
    const execute: typeof runCapture = async (_binary, args = []) => {
      encoded ||= args.includes('libx264')
      return { exitCode: 0, stderr: '', stdout: ' V....D libx264 CPU encoder\n A....D aac encoder\n A....D libmp3lame encoder\n' }
    }
    await expect(assertManagedFfmpegCapabilities('/managed/ffmpeg', execute)).rejects.toThrow('ass subtitle-rendering filter')
    expect(encoded).toBe(false)
  })

  test('declared encoders do not hide a subprocess encode failure', async () => {
    const execute: typeof runCapture = async (_binary, args = []) => {
      if (args.includes('-filters')) return { exitCode: 0, stdout: ' TSC ass V->V Render ASS subtitles\n', stderr: '' }
      if (args.includes('-encoders')) return { exitCode: 0, stdout: ' V....D libx264 CPU encoder\n A....D aac encoder\n A....D libmp3lame encoder\n', stderr: '' }
      return { exitCode: 1, stdout: '', stderr: 'encoder initialization failed' }
    }
    await expect(assertManagedFfmpegCapabilities('/managed/ffmpeg', execute)).rejects.toThrow('software H.264 encode: encoder initialization failed')
  })

  test('the qpdf wrapper preserves arguments and remains executable after relocating its runtime', async () => {
    await withTempDir('autoshow-qpdf-relocation-', async directory => {
      const original = join(directory, 'before')
      const relocated = join(directory, 'after')
      await mkdir(join(original, 'tools/qpdf/bin'), { recursive: true })
      await mkdir(join(original, 'bin'), { recursive: true })
      const installed = join(original, 'tools/qpdf/bin/qpdf')
      const wrapper = join(original, 'bin/qpdf')
      await Bun.write(installed, '#!/bin/sh\nif [ -n "${DYLD_LIBRARY_PATH+x}${DYLD_FALLBACK_LIBRARY_PATH+x}" ]; then exit 97; fi\nprintf "%s\\n" "$1" "$2"\n')
      await chmod(installed, 0o755)
      const script = buildManagedQpdfWrapperScript(installed)
      await Bun.write(wrapper, script)
      await chmod(wrapper, 0o755)
      await rename(original, relocated)
      const result = await runShellFixture(join(relocated, 'bin/qpdf'), ['argument with spaces', '--version'], {
        DYLD_LIBRARY_PATH: '/external/forbidden-libraries', DYLD_FALLBACK_LIBRARY_PATH: '/external/forbidden-fallback'
      })
      expect(result).toEqual({ stdout: 'argument with spaces\n--version\n', stderr: '', exitCode: 0 })
      expect(await Bun.file(join(relocated, 'bin/qpdf')).text()).toBe(script)
      expect(script).not.toContain(original)
    })
  })

  test('the Tesseract wrapper resolves runtime engine/data paths after relocation without external library overrides', async () => {
    await withTempDir('autoshow-tesseract-relocation-', async directory => {
      const original = join(directory, 'before')
      const relocated = join(directory, 'after')
      await mkdir(join(original, 'tools/tesseract/bin'), { recursive: true })
      await mkdir(join(original, 'tools/tessdata'), { recursive: true })
      await mkdir(join(original, 'bin'), { recursive: true })
      const engine = join(original, 'tools/tesseract/bin/tesseract')
      await Bun.write(engine, '#!/bin/sh\nif [ -n "${DYLD_LIBRARY_PATH+x}${DYLD_FALLBACK_LIBRARY_PATH+x}" ]; then exit 97; fi\nprintf "%s\\n" "$TESSDATA_PREFIX" "$1"\n')
      await chmod(engine, 0o755)
      const script = buildManagedTesseractWrapperScript()
      await Bun.write(join(original, 'bin/tesseract'), script)
      await chmod(join(original, 'bin/tesseract'), 0o755)
      await cp(original, relocated, { recursive: true })
      const result = await runShellFixture(join(relocated, 'bin/tesseract'), ['--list-langs'], {
        DYLD_LIBRARY_PATH: '/external/forbidden-libraries', DYLD_FALLBACK_LIBRARY_PATH: '/external/forbidden-fallback'
      })
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toBe(`${relocated}/tools/tessdata\n--list-langs\n`)
      expect(script).toContain('unset DYLD_LIBRARY_PATH DYLD_FALLBACK_LIBRARY_PATH')
      expect(script).not.toContain('export DYLD_LIBRARY_PATH')
      expect(buildManagedCalibreWrapperScript()).toContain('CALIBRE_CACHE_DIRECTORY="$calibre_runtime_dir/cache/calibre"')
      expect(buildManagedCalibreWrapperScript()).toContain('CALIBRE_CONFIG_DIRECTORY="$calibre_runtime_dir/state/calibre"')
    })
  })
})
