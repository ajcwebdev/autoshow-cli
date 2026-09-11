import { withProcessLock } from '~/utils/process-lock'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import type { DoctorCheck, ResolvedDefuddleCli, RunOptions, RunResult } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { getConfiguredBinDir, PROJECT_ROOT, IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'
import { pathExists } from '~/utils/filesystem'
import { childEnv } from '~/utils/child-env'

const DEFUDDLE_CLI_VERSION = '0.19.3'

const frozenFiles = ['package.json', 'bun.lock', 'bunfig.toml'] as const
const frozenDir = join(IMMUTABLE_ASSET_ROOT, 'config/defuddle')
const hasFrozenInstall = async (): Promise<boolean> => {
  for (const name of frozenFiles) {
    const installed = Bun.file(join(defuddleRuntimeDir, name))
    if (!await installed.exists() || await installed.text() !== await Bun.file(join(frozenDir, name)).text()) return false
  }
  const marker = Bun.file(join(defuddleRuntimeDir, '.frozen-install'))
  return await marker.exists() && (await marker.text()).trim() === DEFUDDLE_CLI_VERSION
}

const RUNTIME = join(PROJECT_ROOT, 'runtime')
let defuddleCliSetupPromise: Promise<void> | undefined
const DEFUDDLE_TEST_CHILD_ENV_KEYS = [
  'AUTOSHOW_DEFUDDLE_ARGS_LOG',
  'AUTOSHOW_FAKE_DEFUDDLE_MODE',
  'AUTOSHOW_FAKE_DEFUDDLE_STDERR'
] as const

export const defuddleRuntimeDir = join(RUNTIME, 'defuddle')
const defuddleRuntimeBinaryPath = join(
  defuddleRuntimeDir,
  'node_modules',
  'defuddle',
  'dist',
  'cli.js'
)

const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> =>
  stream ? await new Response(stream).text() : ''

const runCapture = async (
  command: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: childEnv({ allow: DEFUDDLE_TEST_CHILD_ENV_KEYS, set: options.env }),
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
  await runCapture(binaryPath === defuddleRuntimeBinaryPath ? (Bun.isStandaloneExecutable ? 'bun' : process.execPath) : binaryPath,
    binaryPath === defuddleRuntimeBinaryPath ? ['--no-env-file', binaryPath, ...args] : args, options)

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
  verified.ok && verified.detail.trim() === DEFUDDLE_CLI_VERSION

const DEFUDDLE_SETUP_NEXT_STEP = 'bun autoshow setup --step defuddle'

export const readDefuddleCliReadiness = async (): Promise<DoctorCheck> => {
  const resolved = await resolveDefuddleCli()
  if (!resolved) {
    return {
      label: 'defuddle',
      status: 'MISSING',
      detail: 'not found (run bun autoshow setup --step defuddle or pass --bin-dir)',
      severity: 'warn',
      nextStep: DEFUDDLE_SETUP_NEXT_STEP
    }
  }

  const verified = await verifyDefuddleCli(resolved.path)
  if (verified.ok && (resolved.source !== 'runtime' || (isPinnedDefuddleCli(verified) && await hasFrozenInstall()))) {
    return {
      label: 'defuddle',
      status: 'OK',
      detail: `${resolved.path} (${verified.detail})`,
      severity: 'info'
    }
  }

  const detail = verified.ok
    ? `${resolved.path} requires the frozen defuddle@${DEFUDDLE_CLI_VERSION} installation`
    : `${resolved.path} failed --version: ${verified.detail}`
  return {
    label: 'defuddle',
    status: 'WARN',
    detail,
    severity: 'warn',
    nextStep: DEFUDDLE_SETUP_NEXT_STEP
  }
}

const writeRuntimePackageJson = async (): Promise<void> => {
  await mkdir(defuddleRuntimeDir, { recursive: true })
  for (const name of frozenFiles) {
    await Bun.write(join(defuddleRuntimeDir, name), await Bun.file(join(frozenDir, name)).text())
  }
}

const setupDefuddleCliUnlocked = async (): Promise<void> => {
  if (await pathExists(defuddleRuntimeBinaryPath)) {
    const verified = await verifyDefuddleCli(defuddleRuntimeBinaryPath)
    if (isPinnedDefuddleCli(verified) && await hasFrozenInstall()) {
      logSetupToolStatus({
        tool: 'defuddle',
        status: 'ready',
        detail: `${defuddleRuntimeBinaryPath} (${verified.detail})`
      })
      return
    }
  }

  logSetupToolStatus({
    tool: 'defuddle',
    status: 'installing',
    detail: `defuddle@${DEFUDDLE_CLI_VERSION}`
  })

  await rm(join(defuddleRuntimeDir, '.frozen-install'), { force: true })
  await writeRuntimePackageJson()

  const install = await runCapture(Bun.isStandaloneExecutable ? 'bun' : process.execPath, ['--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts'], {
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

  await Bun.write(join(defuddleRuntimeDir, '.frozen-install'), `${DEFUDDLE_CLI_VERSION}\n`)
  logSetupToolStatus({
    tool: 'defuddle',
    status: 'ready',
    detail: `${defuddleRuntimeBinaryPath} (${verified.detail})`
  })
}

export const setupDefuddleCli = async (): Promise<void> => {
  if (!defuddleCliSetupPromise) {
    defuddleCliSetupPromise = withProcessLock('setup-defuddle-runtime', setupDefuddleCliUnlocked).finally(() => {
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

    if (resolved.source === 'runtime' && isPinnedDefuddleCli(verified) && await hasFrozenInstall()) {
      return resolved.path
    }

  }

  await setupDefuddleCli()
  return defuddleRuntimeBinaryPath
}
