import { afterEach, expect, test } from 'bun:test'
import { chmod, lstat, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig, loadConfigWithDefaults, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config-command/config-writer'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'

const temporary = createTempDirTracker('autoshow-runtime-config-')
const originalWorkingDirectory = process.cwd()
const originalProjectRoot = process.env['AUTOSHOW_PROJECT_ROOT']

afterEach(async () => {
  process.chdir(originalWorkingDirectory)
  if (originalProjectRoot === undefined) delete process.env['AUTOSHOW_PROJECT_ROOT']
  else process.env['AUTOSHOW_PROJECT_ROOT'] = originalProjectRoot
  await temporary.cleanup()
})

const fixture = async (): Promise<string> => {
  const root = await temporary.make()
  await writeFile(join(root, 'package.json'), '{}\n')
  return root
}

test('default configuration resolves beneath the nearest project runtime without writing directories', async () => {
  const root = await fixture()
  const nested = join(root, 'nested/work')
  await mkdir(nested, { recursive: true })
  delete process.env['AUTOSHOW_PROJECT_ROOT']
  process.chdir(nested)
  expect(await resolveConfigPath()).toBe(join(root, 'runtime/autoshow.json'))
  expect(await Bun.file(join(root, 'runtime')).exists()).toBe(false)
  expect(await loadConfigWithDefaults()).toEqual({})
  expect((await readdir(root)).sort()).toEqual(['nested', 'package.json'])
})

test('project root override controls the default while explicit configuration paths stay exact', async () => {
  const root = await fixture()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  expect(await resolveConfigPath()).toBe(join(root, 'runtime/autoshow.json'))
  expect(await resolveConfigPath('chosen-settings.json')).toBe('chosen-settings.json')
})

test('legacy configuration is read without mutation and subsequent writes migrate into runtime', async () => {
  const root = await fixture()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  const legacy = join(root, 'config/autoshow.json')
  await mkdir(join(root, 'config'))
  const original = '{\n  "pricing": { "maxCents": 25 },\n  "auth": { "cookies": "input/private-cookies.txt" }\n}\n'
  await writeFile(legacy, original)
  const runtimePath = await resolveConfigPath()
  const loaded = await loadConfigWithDefaults()
  expect(loaded).toEqual({ pricing: { maxCents: 25 }, auth: { cookies: 'input/private-cookies.txt' } })
  expect(await readFile(legacy, 'utf8')).toBe(original)
  expect((await readdir(root)).sort()).toEqual(['config', 'package.json'])
  await writeConfig(runtimePath, { ...loaded, pricing: { maxCents: 40 } }, { managedDefault: true })
  expect(await loadConfigWithDefaults()).toMatchObject({ pricing: { maxCents: 40 }, auth: loaded.auth })
  expect(await readFile(legacy, 'utf8')).toBe(original)
})

test('explicit missing configuration never borrows an adjacent legacy default', async () => {
  const root = await fixture()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  await mkdir(join(root, 'config'))
  await writeFile(join(root, 'config/autoshow.json'), '{"pricing":{"maxCents":25}}\n')
  const explicit = join(root, 'runtime/autoshow.json')
  expect(await loadConfigWithDefaults(explicit)).toEqual({})
  expect(await loadConfig(explicit)).toEqual({})
  expect(await loadConfig(explicit, { allowLegacyFallback: true })).toEqual({ pricing: { maxCents: 25 } })
})

test('an invalid runtime configuration fails instead of falling back to valid legacy settings', async () => {
  const root = await fixture()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  await mkdir(join(root, 'config'))
  await writeFile(join(root, 'config/autoshow.json'), '{"pricing":{"maxCents":25}}\n')
  await mkdir(join(root, 'runtime'))
  const runtimePath = join(root, 'runtime/autoshow.json')
  await writeFile(runtimePath, 'invalid JSON\n')
  await expect(loadConfigWithDefaults()).rejects.toThrow(`Invalid JSON in autoshow config at ${runtimePath}`)
})

test('atomic configuration writes follow existing and dangling aliases without replacing their symlinks', async () => {
  const root = await fixture()
  await mkdir(join(root, 'config'))
  await symlink('../runtime/autoshow.json', join(root, 'config/autoshow.json'))
  const alias = join(root, 'config/autoshow.json')
  await writeConfig(alias, { pricing: { maxCents: 15 } })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await loadConfig(join(root, 'runtime/autoshow.json'))).toEqual({ pricing: { maxCents: 15 } })
  await writeConfig(alias, { pricing: { maxCents: 30 } })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await loadConfig(alias)).toEqual({ pricing: { maxCents: 30 } })
  expect(await readdir(join(root, 'runtime'))).toEqual(['autoshow.json'])
})

test('failed serialization and failed activation preserve existing configuration and remove staging files', async () => {
  const root = await fixture()
  const path = join(root, 'runtime/autoshow.json')
  await writeConfig(path, { pricing: { maxCents: 15 } })
  const original = await readFile(path, 'utf8')
  await expect(writeConfig(path, { invalid: 1n })).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe(original)
  const directory = join(root, 'runtime/settings-directory')
  await mkdir(directory)
  await writeFile(join(directory, 'preserved.txt'), 'preserve me\n')
  await expect(writeConfig(directory, {})).rejects.toThrow()
  expect(await readFile(join(directory, 'preserved.txt'), 'utf8')).toBe('preserve me\n')
  expect((await readdir(join(root, 'runtime'))).sort()).toEqual(['autoshow.json', 'settings-directory'])
})

test('atomic replacement retains existing config permissions', async () => {
  const root = await fixture()
  const path = join(root, 'runtime/autoshow.json')
  await writeConfig(path, { pricing: { maxCents: 15 } })
  await chmod(path, 0o660)
  await writeConfig(path, { pricing: { maxCents: 30 } })
  expect((await stat(path)).mode & 0o777).toBe(0o660)
  expect(await loadConfig(path)).toEqual({ pricing: { maxCents: 30 } })
})

test('default config rejects file and parent links escaping runtime before reads or directory creation', async () => {
  for (const linkKind of ['file', 'parent'] as const) {
    for (const dangling of [false, true]) {
      const root = await fixture()
      const outside = await temporary.make()
      process.env['AUTOSHOW_PROJECT_ROOT'] = root
      const sentinelPath = join(outside, 'sentinel.json')
      const sentinel = '{"pricing":{"maxCents":31}}\n'
      await writeFile(sentinelPath, sentinel)
      const outsideTarget = dangling ? join(outside, 'uncreated/autoshow.json') : sentinelPath
      const configPath = join(root, 'runtime/autoshow.json')
      if (linkKind === 'file') {
        await mkdir(join(root, 'runtime'))
        await symlink(outsideTarget, configPath)
      } else {
        await symlink(dangling ? join(outside, 'uncreated') : outside, join(root, 'runtime'))
      }
      await expect(resolveConfigPath()).rejects.toThrow('inside the project runtime directory')
      await expect(loadConfig(configPath, { allowLegacyFallback: true })).rejects.toThrow('inside the project runtime directory')
      await expect(writeConfig(configPath, { pricing: { maxCents: 99 } }, { managedDefault: true })).rejects.toThrow('inside the project runtime directory')
      expect(await readFile(sentinelPath, 'utf8')).toBe(sentinel)
      expect(await readdir(outside)).toEqual(['sentinel.json'])
      expect((await lstat(linkKind === 'file' ? configPath : join(root, 'runtime'))).isSymbolicLink()).toBe(true)
    }
  }
})

test('default config follows contained aliases while explicit paths retain external symlink semantics', async () => {
  const root = await fixture()
  const outside = await temporary.make()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  await mkdir(join(root, 'runtime'))
  const contained = join(root, 'runtime/settings.json')
  const defaultPath = join(root, 'runtime/autoshow.json')
  await symlink('settings.json', defaultPath)
  await writeConfig(defaultPath, { pricing: { maxCents: 32 } }, { managedDefault: true })
  expect(await loadConfigWithDefaults()).toEqual({ pricing: { maxCents: 32 } })
  expect(await loadConfig(contained)).toEqual({ pricing: { maxCents: 32 } })
  const explicitPath = join(outside, 'settings.json')
  const alias = join(outside, 'explicit.json')
  await writeFile(explicitPath, '{"pricing":{"maxCents":41}}\n')
  await symlink('settings.json', alias)
  expect(await loadConfigWithDefaults(alias)).toEqual({ pricing: { maxCents: 41 } })
  await writeConfig(alias, { pricing: { maxCents: 42 } })
  expect(await loadConfig(explicitPath)).toEqual({ pricing: { maxCents: 42 } })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
})

test('default legacy migration rejects an external legacy source while explicit reads remain available', async () => {
  const root = await fixture()
  const outside = await temporary.make()
  process.env['AUTOSHOW_PROJECT_ROOT'] = root
  await mkdir(join(root, 'config'))
  const sentinel = '{"pricing":{"maxCents":43}}\n'
  const source = join(outside, 'settings.json')
  await writeFile(source, sentinel)
  const legacy = join(root, 'config/autoshow.json')
  await symlink(source, legacy)
  await expect(loadConfigWithDefaults()).rejects.toThrow('Legacy default configuration must resolve inside the project directory')
  expect(await loadConfigWithDefaults(legacy)).toEqual({ pricing: { maxCents: 43 } })
  expect(await readFile(source, 'utf8')).toBe(sentinel)
  expect((await readdir(root)).sort()).toEqual(['config', 'package.json'])
})
