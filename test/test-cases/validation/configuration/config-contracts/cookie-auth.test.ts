import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyConfiguredYtDlpAuth } from '~/cli/commands/setup-and-utilities/config/config-auth'
import { buildConfigPatchFromFlags, FLAG_TO_CONFIG_PATH } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { configureYtDlpAuth, inspectYtDlpAuthState } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { runCommand } from '../../../../test-utils/test-helpers'
import { writeTempConfig } from './shared'

const tempDirs: string[] = []

afterEach(async () => {
  configureYtDlpAuth({})
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('config cookie auth contracts', () => {
  test('cookie flags persist under auth and are not injected as command defaults', () => {
    expect(FLAG_TO_CONFIG_PATH['cookies']).toEqual(['auth', 'cookies'])
    expect(FLAG_TO_CONFIG_PATH['cookies-from-browser']).toEqual(['auth', 'cookiesFromBrowser'])

    expect(buildConfigPatchFromFlags(
      { cookies: './cookies.txt', 'cookies-from-browser': 'chrome' },
      new Set(['cookies', 'cookies-from-browser'])
    )).toEqual({
      auth: {
        cookies: './cookies.txt',
        cookiesFromBrowser: 'chrome'
      }
    })
  })

  test('config --cookies persists auth.cookies and later yt-dlp auth sees it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-cookie-auth-'))
    tempDirs.push(dir)
    const cookiesPath = join(dir, 'youtube.cookies.txt')
    const configPath = join(dir, 'autoshow.json')
    await writeFile(cookiesPath, '# Netscape HTTP Cookie File\n')

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'config',
      '--cookies',
      cookiesPath,
      '--config-path',
      configPath
    ], { env: { NO_COLOR: '1' } })

    expect(result.exitCode).toBe(0)
    const saved = JSON.parse(await Bun.file(configPath).text()) as { auth?: { cookies?: string } }
    expect(saved.auth?.cookies).toBe(cookiesPath)

    await applyConfiguredYtDlpAuth(configPath)
    const authState = await inspectYtDlpAuthState()
    expect(authState.configuredMode).toBe('cookies-file')
    expect(authState.usableMode).toBe('cookies-file')
    expect(authState.cookiesPath).toBe(cookiesPath)
    expect(authState.cookieArgs).toEqual(['--cookies', cookiesPath])
  })

  test('configured cookies-from-browser is applied after config load', async () => {
    const configPath = await writeTempConfig({
      auth: {
        cookiesFromBrowser: 'firefox'
      }
    })

    await applyConfiguredYtDlpAuth(configPath)
    const authState = await inspectYtDlpAuthState()
    expect(authState.configuredMode).toBe('cookies-from-browser')
    expect(authState.usableMode).toBe('cookies-from-browser')
    expect(authState.cookieArgs).toEqual(['--cookies-from-browser', 'firefox'])
  })
})
