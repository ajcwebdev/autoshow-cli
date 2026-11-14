import { describe, expect, test } from 'bun:test'
import { copyFile, cp, mkdir, readFile, readdir, rename, stat, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  activateManagedRenderingTools,
  ensureManagedRenderingConfiguration,
  managedRenderingEnvironment,
  validateManagedRenderingConfiguration
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-native-rendering'
import { makeExecutable } from '~/utils/filesystem'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const temporaryDirectories = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-managed-rendering-' })

const writeExecutable = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, content)
  await makeExecutable(path)
}

const writeFontFixtures = async (runtimeRoot: string): Promise<void> => {
  const fonts = join(runtimeRoot, 'tools/native/dejavu-fonts/share/fonts/truetype/dejavu')
  await mkdir(fonts, { recursive: true })
  await Bun.write(join(fonts, 'DejaVuSans.ttf'), 'regular-font-fixture')
  await Bun.write(join(fonts, 'DejaVuSans-Bold.ttf'), 'bold-font-fixture')
}

const writeRenderingExecutables = async (runtimeRoot: string): Promise<void> => {
  const script = '#!/bin/sh\nprintf "%s\\n" "$FONTCONFIG_FILE" "$MAGICK_TEMPORARY_PATH" "$PANGOCAIRO_BACKEND" "$@"\n'
  for (const [dependency, tool] of [
    ['imagemagick', 'magick'],
    ['pango', 'pango-view'],
    ['fontconfig', 'fc-cache'],
    ['fontconfig', 'fc-match']
  ]) {
    await writeExecutable(join(runtimeRoot, 'tools/native', dependency!, 'bin', tool!), script)
  }
}

describe('managed rendering configuration', () => {
  test('keeps font bytes and configuration local, with relocatable font lookup', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeFontFixtures(runtimeRoot)
    await ensureManagedRenderingConfiguration({ runtimeRoot })

    const environment = managedRenderingEnvironment({ runtimeRoot })
    const document = await readFile(environment['FONTCONFIG_FILE']!, 'utf8')
    expect(document).toContain('<dir prefix="relative">../dejavu</dir>')
    expect(document).toContain('<cachedir prefix="xdg">fontconfig</cachedir>')
    expect(document).not.toContain(runtimeRoot)
    expect(document).not.toContain('<include')
    expect(await readFile(join(runtimeRoot, 'fonts/dejavu/DejaVuSans.ttf'), 'utf8')).toBe('regular-font-fixture')
    expect(environment['MAGICK_HOME']).toBe(join(runtimeRoot, 'tools/native/imagemagick'))
    expect(environment['XDG_CACHE_HOME']).toBe(join(runtimeRoot, 'cache'))

    const relocatedRoot = join(directory, 'relocated runtime')
    await rename(runtimeRoot, relocatedRoot)
    await ensureManagedRenderingConfiguration({ runtimeRoot: relocatedRoot })
    expect(await readFile(join(relocatedRoot, 'fonts/fontconfig/fonts.conf'), 'utf8')).toBe(document)
    expect(managedRenderingEnvironment({ runtimeRoot: relocatedRoot })['FONTCONFIG_FILE']).toBe(join(relocatedRoot, 'fonts/fontconfig/fonts.conf'))
  })

  test('rejects incomplete font packages and symlinks escaping the runtime', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    const fonts = join(runtimeRoot, 'tools/native/dejavu-fonts/share/fonts/truetype/dejavu')
    await mkdir(fonts, { recursive: true })
    await Bun.write(join(fonts, 'DejaVuSans.ttf'), 'regular-font-fixture')
    await expect(ensureManagedRenderingConfiguration({ runtimeRoot })).rejects.toThrow('incomplete')

    const externalFont = join(directory, 'external-font.ttf')
    await copyFile(join(fonts, 'DejaVuSans.ttf'), externalFont)
    await symlink(externalFont, join(fonts, 'DejaVuSans-Bold.ttf'))
    await expect(ensureManagedRenderingConfiguration({ runtimeRoot })).rejects.toThrow('escapes runtime')
  })

  test('rejects an external font directory before creating files outside runtime', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    const outside = join(directory, 'outside')
    await writeFontFixtures(runtimeRoot)
    await mkdir(outside)
    await symlink(outside, join(runtimeRoot, 'fonts'))

    await expect(ensureManagedRenderingConfiguration({ runtimeRoot })).rejects.toThrow('escapes runtime')
    expect(await readdir(outside)).toEqual([])
  })

  test('reuses unchanged fonts, configuration, and entrypoints on warm setup', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeFontFixtures(runtimeRoot)
    await writeRenderingExecutables(runtimeRoot)
    await ensureManagedRenderingConfiguration({ runtimeRoot })
    await activateManagedRenderingTools({ runtimeRoot })
    const paths = ['fonts/dejavu/DejaVuSans.ttf', 'fonts/fontconfig/fonts.conf', 'bin/magick']
    const before = await Promise.all(paths.map(path => stat(join(runtimeRoot, path))))

    await ensureManagedRenderingConfiguration({ runtimeRoot })
    await activateManagedRenderingTools({ runtimeRoot })

    const after = await Promise.all(paths.map(path => stat(join(runtimeRoot, path))))
    expect(after.map(info => info.ino)).toEqual(before.map(info => info.ino))
    expect(after.map(info => info.mtimeMs)).toEqual(before.map(info => info.mtimeMs))
  })

  test('read-only validation detects copied-font, configuration, and wrapper corruption', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeFontFixtures(runtimeRoot)
    await writeRenderingExecutables(runtimeRoot)
    await ensureManagedRenderingConfiguration({ runtimeRoot })
    await activateManagedRenderingTools({ runtimeRoot })
    const settings = { runtimeRoot }
    const configPath = join(runtimeRoot, 'fonts/fontconfig/fonts.conf')
    const originalConfig = await readFile(configPath, 'utf8')
    expect(await validateManagedRenderingConfiguration(settings)).toEqual({ healthy: true })

    const fontPath = join(runtimeRoot, 'fonts/dejavu/DejaVuSans.ttf')
    await Bun.write(fontPath, 'corrupt-font')
    expect(await validateManagedRenderingConfiguration(settings)).toMatchObject({ healthy: false, reason: expect.stringContaining('font differs') })
    expect(await readFile(fontPath, 'utf8')).toBe('corrupt-font')
    await ensureManagedRenderingConfiguration(settings)

    await Bun.write(configPath, '<fontconfig><dir>/external/fonts</dir></fontconfig>')
    expect(await validateManagedRenderingConfiguration(settings)).toMatchObject({ healthy: false, reason: expect.stringContaining('configuration') })
    expect(await readFile(configPath, 'utf8')).not.toBe(originalConfig)
    await ensureManagedRenderingConfiguration(settings)

    const wrapperPath = join(runtimeRoot, 'bin/magick')
    await Bun.write(wrapperPath, '#!/bin/sh\nexit 19\n')
    expect(await validateManagedRenderingConfiguration(settings)).toMatchObject({ healthy: false, reason: expect.stringContaining('entrypoint') })
    expect(await readFile(wrapperPath, 'utf8')).toBe('#!/bin/sh\nexit 19\n')
  })

  test('repairs font bytes and removes stale managed fonts as one installation', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeFontFixtures(runtimeRoot)
    await ensureManagedRenderingConfiguration({ runtimeRoot })
    const fontDirectory = join(runtimeRoot, 'fonts/dejavu')
    await Bun.write(join(fontDirectory, 'DejaVuSans.ttf'), 'corrupt-font')
    await Bun.write(join(fontDirectory, 'StaleFont.ttf'), 'old-managed-font')

    await ensureManagedRenderingConfiguration({ runtimeRoot })

    expect(await readFile(join(fontDirectory, 'DejaVuSans.ttf'), 'utf8')).toBe('regular-font-fixture')
    expect((await readdir(fontDirectory)).sort()).toEqual(['DejaVuSans-Bold.ttf', 'DejaVuSans.ttf'])
    expect((await readdir(join(runtimeRoot, 'fonts'))).sort()).toEqual(['dejavu', 'fontconfig'])
  })
})

describe('managed rendering entrypoints', () => {
  test('dispatches through runtime-local tools after relocation and preserves literal arguments', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeRenderingExecutables(runtimeRoot)
    await activateManagedRenderingTools({ runtimeRoot })
    const relocatedRoot = join(directory, 'relocated runtime')
    await cp(runtimeRoot, relocatedRoot, { recursive: true })

    for (const tool of ['magick', 'convert', 'pango-view', 'fc-match', 'fc-cache']) {
      const result = Bun.spawn([join(relocatedRoot, 'bin', tool), 'literal $value', 'two words'], {
        env: { PATH: '/usr/bin:/bin' }, stdout: 'pipe', stderr: 'pipe'
      })
      const output = await new Response(result.stdout).text()
      expect(await result.exited).toBe(0)
      expect(output.trim().split('\n')).toEqual([
        join(relocatedRoot, 'fonts/fontconfig/fonts.conf'),
        join(relocatedRoot, 'tmp'),
        'fontconfig',
        'literal $value',
        'two words'
      ])
      expect(await readFile(join(relocatedRoot, 'bin', tool), 'utf8')).not.toContain(runtimeRoot)
    }
  })

  test('validates all native targets before replacing existing entrypoints', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    await writeExecutable(join(runtimeRoot, 'bin/magick'), '#!/bin/sh\nexit 0\n')
    await writeExecutable(join(runtimeRoot, 'tools/native/imagemagick/bin/magick'), '#!/bin/sh\nexit 0\n')
    const previous = await readFile(join(runtimeRoot, 'bin/magick'), 'utf8')
    await expect(activateManagedRenderingTools({ runtimeRoot })).rejects.toThrow()
    expect(await readFile(join(runtimeRoot, 'bin/magick'), 'utf8')).toBe(previous)
  })

  test('rejects an external entrypoint directory before installing wrappers', async () => {
    const directory = await temporaryDirectories.make()
    const runtimeRoot = join(directory, 'runtime')
    const outside = join(directory, 'outside')
    await writeRenderingExecutables(runtimeRoot)
    await mkdir(outside)
    await symlink(outside, join(runtimeRoot, 'bin'))

    await expect(activateManagedRenderingTools({ runtimeRoot })).rejects.toThrow('escapes runtime')
    expect(await readdir(outside)).toEqual([])
  })
})
