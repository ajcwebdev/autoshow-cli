import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import type { CheckResult, ResolvedDefuddleCli, RunOptions, RunResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { getConfiguredBinDir, PROJECT_ROOT } from '~/utils/runtime-paths'
import { pathExists } from '~/utils/filesystem'

const DEFUDDLE_CLI_VERSION = '0.17.0'

const RUNTIME = join(PROJECT_ROOT, 'runtime')
let defuddleCliSetupPromise: Promise<void> | undefined

export const defuddleRuntimeDir = join(RUNTIME, 'defuddle')
const defuddleRuntimeBinaryPath = join(
  defuddleRuntimeDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'defuddle.cmd' : 'defuddle'
)

const mergeEnv = (env?: Record<string, string | undefined>): Record<string, string | undefined> =>
  env ? { ...(process.env as Record<string, string | undefined>), ...env } : process.env as Record<string, string | undefined>

const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> =>
  stream ? await new Response(stream).text() : ''

const runCapture = async (
  command: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: mergeEnv(options.env),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited
  ])
  const result: RunResult = { stdout, stderr, exitCode }
  if (exitCode !== 0 && !options.allowFailure) {
    throw InfraError(`Command failed: ${formatDefuddleCliOutput(result)}`, { stage: 'extract:defuddle' })
  }
  return result
}

const resolveDefuddleCli = async (): Promise<ResolvedDefuddleCli | undefined> => {
  const overrideDir = getConfiguredBinDir()?.trim()
  if (overrideDir) {
    const overrideBin = join(overrideDir, 'defuddle')
    if (await pathExists(overrideBin)) {
      return { path: overrideBin, source: 'path' }
    }
  }

  if (await pathExists(defuddleRuntimeBinaryPath)) {
    return { path: defuddleRuntimeBinaryPath, source: 'runtime' }
  }

  const pathBin = Bun.which('defuddle')
  if (typeof pathBin === 'string' && pathBin.length > 0) {
    return { path: pathBin, source: 'path' }
  }

  return undefined
}

const trimForError = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length <= 2000) {
    return trimmed
  }
  return `${trimmed.slice(0, 2000)}...`
}

export const formatDefuddleCliOutput = (result: RunResult): string => {
  const details = [`exit code ${result.exitCode}`]
  const stdout = trimForError(result.stdout)
  const stderr = trimForError(result.stderr)
  if (stdout.length > 0) {
    details.push(`stdout:\n${stdout}`)
  }
  if (stderr.length > 0) {
    details.push(`stderr:\n${stderr}`)
  }
  return details.join('\n')
}

export const runDefuddleCliCapture = async (
  binaryPath: string,
  args: string[],
  options: RunOptions = {}
): Promise<RunResult> =>
  await runCapture(binaryPath, args, options)

const verifyDefuddleCli = async (binaryPath: string): Promise<{ ok: boolean, detail: string }> => {
  let result: RunResult
  try {
    result = await runDefuddleCliCapture(binaryPath, ['--version'], { allowFailure: true })
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
  const versionText = (result.stdout.trim() || result.stderr.trim()).trim()
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: formatDefuddleCliOutput(result)
    }
  }
  return {
    ok: true,
    detail: versionText.length > 0 ? versionText : binaryPath
  }
}

const isPinnedDefuddleCli = (verified: { ok: boolean, detail: string }): boolean =>
  verified.ok && verified.detail.includes(DEFUDDLE_CLI_VERSION)

export const readDefuddleCliReadiness = async (): Promise<CheckResult> => {
  const resolved = await resolveDefuddleCli()
  if (!resolved) {
    return {
      label: 'defuddle',
      ok: false,
      detail: 'not found (run bun autoshow setup --step defuddle or pass --bin-dir)'
    }
  }

  const verified = await verifyDefuddleCli(resolved.path)
  return {
    label: 'defuddle',
    ok: verified.ok,
    detail: verified.ok
      ? `${resolved.path} (${verified.detail})`
      : `${resolved.path} failed --version: ${verified.detail}`
  }
}

const writeRuntimePackageJson = async (): Promise<void> => {
  await mkdir(defuddleRuntimeDir, { recursive: true })
  await Bun.write(join(defuddleRuntimeDir, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: {
      defuddle: DEFUDDLE_CLI_VERSION
    }
  }, null, 2)}\n`)
}

const setupDefuddleCliUnlocked = async (): Promise<void> => {
  if (await pathExists(defuddleRuntimeBinaryPath)) {
    const verified = await verifyDefuddleCli(defuddleRuntimeBinaryPath)
    if (isPinnedDefuddleCli(verified)) {
      logSetupToolStatus(l, {
        tool: 'defuddle',
        status: 'ready',
        detail: `${defuddleRuntimeBinaryPath} (${verified.detail})`
      })
      return
    }
  }

  logSetupToolStatus(l, {
    tool: 'defuddle',
    status: 'installing',
    detail: `defuddle@${DEFUDDLE_CLI_VERSION}`
  })

  await rm(defuddleRuntimeDir, { recursive: true, force: true })
  await writeRuntimePackageJson()

  const install = await runCapture('bun', ['install'], {
    cwd: defuddleRuntimeDir,
    allowFailure: true
  })
  if (install.exitCode !== 0) {
    throw InfraError(`Failed to install defuddle@${DEFUDDLE_CLI_VERSION}: ${formatDefuddleCliOutput(install)}`, { stage: 'extract:defuddle' })
  }

  const verified = await verifyDefuddleCli(defuddleRuntimeBinaryPath)
  if (!isPinnedDefuddleCli(verified)) {
    throw InfraError(`Installed Defuddle CLI failed verification: ${verified.detail}`, { stage: 'extract:defuddle' })
  }

  logSetupToolStatus(l, {
    tool: 'defuddle',
    status: 'ready',
    detail: `${defuddleRuntimeBinaryPath} (${verified.detail})`
  })
}

export const setupDefuddleCli = async (): Promise<void> => {
  if (!defuddleCliSetupPromise) {
    defuddleCliSetupPromise = setupDefuddleCliUnlocked().finally(() => {
      defuddleCliSetupPromise = undefined
    })
  }
  await defuddleCliSetupPromise
}

export const ensureDefuddleCliSetup = async (): Promise<string> => {
  const resolved = await resolveDefuddleCli()
  if (resolved) {
    const verified = await verifyDefuddleCli(resolved.path)
    if (resolved.source !== 'runtime' && verified.ok) {
      return resolved.path
    }

    if (resolved.source === 'runtime' && isPinnedDefuddleCli(verified)) {
      return resolved.path
    }

  }

  await setupDefuddleCli()
  return defuddleRuntimeBinaryPath
}
