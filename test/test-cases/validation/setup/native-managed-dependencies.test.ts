import { describe, expect, test } from 'bun:test'
import { chmod, mkdir, readlink, rename, stat, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  assertNativeArchivePaths,
  extractManagedNativeSource,
  MANAGED_NATIVE_CMAKE_POLICY_FLAGS,
  managedNativeBuildEnv,
  managedNativeRecipeBuildEnv,
  nativeDependencyOrder,
  nativeDependencyPrefix,
  normalizeManagedNativeMetadata
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-native-dependencies'
import type { NativeDependencyName } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-native-dependencies'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const directories = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'native-source-contract-' })

const tar = async (args: string[]): Promise<void> => {
  const proc = Bun.spawn(['/usr/bin/tar', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(code, `${stdout}\n${stderr}`).toBe(0)
}

describe('managed native dependency boundaries', () => {
  test('orders codecs and text libraries before their consuming native packages', () => {
    const order = nativeDependencyOrder(['libtiff', 'libass'])
    for (const [dependency, consumer] of [
      ['zlib', 'libpng'], ['libpng', 'freetype'], ['freetype', 'fontconfig'],
      ['gperf', 'fontconfig'], ['harfbuzz', 'libass'], ['fribidi', 'libass'],
      ['libjpeg-turbo', 'libtiff']
    ] as const) {
      expect(order.indexOf(dependency)).toBeGreaterThanOrEqual(0)
      expect(order.indexOf(dependency)).toBeLessThan(order.indexOf(consumer))
    }
    expect(new Set(order).size).toBe(order.length)
    expect(() => nativeDependencyOrder(['missing-component' as NativeDependencyName])).toThrow('Unknown managed native dependency')
  })

  test('limits source dependency discovery to managed prefixes and includes native helpers', () => {
    const environment = managedNativeBuildEnv(['fontconfig'])
    expect(environment['PATH']?.split(':')).toContain(join(nativeDependencyPrefix('gperf'), 'bin'))
    expect(environment['PKG_CONFIG_LIBDIR']?.split(':')).toContain(join(nativeDependencyPrefix('freetype'), 'lib/pkgconfig'))
    expect(environment['PKG_CONFIG_PATH']).toBeUndefined()
    expect(environment['PKG_CONFIG']).toEndWith('/runtime/bin/pkgconf --static')
    expect(environment['CPATH']).toBeUndefined()
    expect(environment['C_INCLUDE_PATH']).toBeUndefined()
    expect(environment['CPLUS_INCLUDE_PATH']).toBeUndefined()
    expect(MANAGED_NATIVE_CMAKE_POLICY_FLAGS).toContain('-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF')
    expect(MANAGED_NATIVE_CMAKE_POLICY_FLAGS).toContain('-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF')
    expect(MANAGED_NATIVE_CMAKE_POLICY_FLAGS).toContain('-DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=ONLY')
  })

  test('passes the current GLib recipe iconv link control to compiler probes and downstream consumers', () => {
    const current = managedNativeRecipeBuildEnv('glib')
    expect(current['LDFLAGS']?.split(' ')).toContain(`-L${join(nativeDependencyPrefix('libiconv'), 'lib')}`)
    expect(current['LDFLAGS']?.split(' ')).toContain('-liconv')
    expect(current['LDFLAGS']?.split(' ')).toContain('-lintl')
    expect(managedNativeRecipeBuildEnv('pango')['LDFLAGS']?.split(' ')).toContain('-liconv')
    expect(managedNativeRecipeBuildEnv('zlib')['LDFLAGS']?.split(' ')).not.toContain('-liconv')
  })

  test('rejects a nested native download-cache escape before any bootstrap network request', async () => {
    const directory = await directories.make()
    const project = join(directory, 'project')
    const outside = join(directory, 'outside')
    await mkdir(join(project, 'runtime/cache'), { recursive: true })
    await mkdir(outside)
    await Bun.write(join(outside, 'sentinel'), 'unchanged')
    await symlink(outside, join(project, 'runtime/cache/downloads'))
    const modulePath = resolve('src/cli/commands/setup-and-utilities/setup/setup-download/managed-native-dependencies.ts')
    const program = `let networkCalls=0; globalThis.fetch=async()=>{networkCalls++; throw new Error("unexpected network");}; try { const module=await import(${JSON.stringify(modulePath)}); await module.ensureManagedNativeDependency("zlib"); console.log(JSON.stringify({healthy:true,networkCalls})); } catch(error) { console.log(JSON.stringify({healthy:false,networkCalls,message:String(error.message)})); }`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', program], {
      env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '', AUTOSHOW_PROJECT_ROOT: project },
      stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, stderr).toBe(0)
    expect(JSON.parse(stdout)).toMatchObject({ healthy: false, networkCalls: 0, message: 'Managed runtime paths must resolve inside the project runtime directory.' })
    expect(await Bun.file(join(outside, 'sentinel')).text()).toBe('unchanged')
  })

  test('rejects absolute, traversal and foreign-separator source members before conversion', () => {
    for (const listing of ['/escape', '../escape', 'root/../escape', 'root\\escape', 'C:/escape']) {
      expect(() => assertNativeArchivePaths(listing)).toThrow('Unsafe native source archive member')
    }
    expect(() => assertNativeArchivePaths('root/\nroot/include/header.h\n')).not.toThrow()
  })

  test('makes pkgconf references portable and removes obsolete absolute libtool dependency lists', async () => {
    const directory = await directories.make()
    const runtime = join(directory, 'runtime')
    const prefix = join(runtime, 'tools/native/example')
    const stage = join(directory, 'stage')
    await mkdir(join(stage, 'lib/pkgconfig'), { recursive: true })
    await Bun.write(join(stage, 'lib/pkgconfig/example.pc'), `prefix=${prefix}\nlibdir=\${prefix}/lib\nName: example\nDescription: portable test package\nVersion: 1\nLibs: -L\${libdir} -lexample\nLibs.private: -L${runtime}/tools/native/codec/lib -lcodec\n`)
    await Bun.write(join(stage, 'lib/libexample.la'), `dependency_libs=' -L${runtime}/tools/native/codec/lib -lcodec'\n`)
    await mkdir(join(stage, 'lib/cmake/example'), { recursive: true })
    await Bun.write(join(stage, 'lib/cmake/example/exampleConfig.cmake'), `set(EXAMPLE_LIBRARY "${prefix}/lib/libexample.a")\n`)
    await normalizeManagedNativeMetadata(stage, prefix, runtime)
    const metadata = await Bun.file(join(stage, 'lib/pkgconfig/example.pc')).text()
    expect(metadata).not.toContain(runtime)
    expect(metadata).toContain('runtime_root=${pcfiledir}/../../../../..')
    expect(metadata).toContain('prefix=${runtime_root}/tools/native/example')
    expect(metadata).toContain('Libs.private: -L${runtime_root}/tools/native/codec/lib -lcodec')
    expect(await Bun.file(join(stage, 'lib/libexample.la')).exists()).toBe(false)
    const cmake = await Bun.file(join(stage, 'lib/cmake/example/exampleConfig.cmake')).text()
    expect(cmake).not.toContain(runtime)
    expect(cmake).toContain('get_filename_component(_autoshow_runtime_root "${CMAKE_CURRENT_LIST_DIR}/../../../../../.." ABSOLUTE)')
    expect(cmake).toContain('set(EXAMPLE_LIBRARY "${_autoshow_runtime_root}/tools/native/example/lib/libexample.a")')
    await mkdir(join(runtime, 'tools/native'), { recursive: true })
    await rename(stage, prefix)
    const relocated = join(directory, 'relocated-runtime')
    await rename(runtime, relocated)
    expect(await Bun.file(join(relocated, 'tools/native/example/lib/pkgconfig/example.pc')).text()).toBe(metadata)
  })

  test('relocates native shell configuration helpers with quoted paths and managed pkgconf dispatch', async () => {
    const directory = await directories.make()
    const runtime = join(directory, 'original runtime')
    const prefix = join(runtime, 'tools/native/example')
    const stage = join(directory, 'stage')
    await mkdir(join(stage, 'bin'), { recursive: true })
    await mkdir(join(runtime, 'bin'), { recursive: true })
    await Bun.write(join(runtime, 'bin/pkgconf'), '#!/bin/sh\nprintf "%s\\n" "$0" "$@"\n')
    await chmod(join(runtime, 'bin/pkgconf'), 0o755)
    const source = `#!/bin/sh\nplain=${runtime}/tools/native/example\ndouble="${runtime}/tools/native/example"\nsingle='${runtime}/tools/native/example'\ncase "$1" in\n--paths) printf '%s\\n' "$plain" "$double" "$single";;\n--pkg) ${runtime}/bin/pkgconf --static marker "$2";;\nesac\n`
    const helper = join(stage, 'bin/example-config')
    await Bun.write(helper, source)
    await chmod(helper, 0o755)
    await normalizeManagedNativeMetadata(stage, prefix, runtime)
    const normalized = await Bun.file(helper).text()
    await normalizeManagedNativeMetadata(stage, prefix, runtime)
    expect(await Bun.file(helper).text()).toBe(normalized)
    await mkdir(join(runtime, 'tools/native'), { recursive: true })
    await rename(stage, prefix)
    const relocated = join(directory, 'relocated runtime with spaces')
    await rename(runtime, relocated)
    const binary = join(relocated, 'tools/native/example/bin/example-config')
    const run = async (args: string[]) => {
      const child = Bun.spawn([binary, ...args], { stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code, stderr).toBe(0)
      return stdout.trim().split('\n')
    }
    const expectedPrefix = join(relocated, 'tools/native/example')
    expect(await run(['--paths'])).toEqual([expectedPrefix, expectedPrefix, expectedPrefix])
    expect(await run(['--pkg', 'literal $(do-not-execute)'])).toEqual([join(relocated, 'bin/pkgconf'), '--static', 'marker', 'literal $(do-not-execute)'])
  })

  for (const compression of ['xz', 'bz2'] as const) {
    test(`admits ${compression} source bytes, executable modes and contained relative symlinks through the secure tar parser`, async () => {
      const root = await directories.make()
      const input = join(root, 'package')
      const archive = join(root, `source.tar.${compression}`)
      const destination = join(root, 'installed')
      await mkdir(join(input, 'bin'), { recursive: true })
      await Bun.write(join(input, 'bin/tool'), '#!/bin/sh\nprintf source-tool\n')
      await chmod(join(input, 'bin/tool'), 0o751)
      await symlink('tool', join(input, 'bin/alias'))
      await tar([compression === 'xz' ? '-cJf' : '-cjf', archive, '-C', root, 'package'])
      await extractManagedNativeSource(archive, destination)
      expect(await Bun.file(join(destination, 'bin/tool')).text()).toBe('#!/bin/sh\nprintf source-tool\n')
      expect((await stat(join(destination, 'bin/tool'))).mode & 0o777).toBe(0o751)
      expect(await readlink(join(destination, 'bin/alias'))).toBe('tool')
      expect(await Bun.file(join(destination, 'bin/alias')).text()).toBe(await Bun.file(join(destination, 'bin/tool')).text())
    })

    test(`rejects an escaping ${compression} symlink without publishing a partial source tree`, async () => {
      const root = await directories.make()
      const input = join(root, 'package')
      const archive = join(root, `unsafe.tar.${compression}`)
      const destination = join(root, 'installed')
      await mkdir(input)
      await symlink('../../outside', join(input, 'escape'))
      await tar([compression === 'xz' ? '-cJf' : '-cjf', archive, '-C', root, 'package'])
      await expect(extractManagedNativeSource(archive, destination)).rejects.toThrow()
      expect(await Bun.file(join(root, 'outside')).exists()).toBe(false)
      await expect(stat(destination)).rejects.toThrow()
    })
  }
})
