import { withProcessLock } from '~/utils/process-lock'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import type { DoctorCheck, ResolvedDefuddleCli, RunOptions, RunResult } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { assertRuntimeContainedPath, getBunBinary, getConfiguredBinDir, PROJECT_ROOT, IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'
import { pathExists } from '~/utils/filesystem'
import { childEnv } from '~/utils/child-env'
import { ensureManagedBunRuntime, validateManagedJsRuntime, validateManagedPackageManifest, writeManagedPackageManifest } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory, recoverManagedToolDirectory } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { assertManagedRuntimePath } from '~/utils/runtime-containment'
import { ensureRuntimeDirectory } from '~/utils/runtime-state'

const DEFUDDLE_CLI_VERSION = '0.19.3'

const frozenFiles = ['package.json', 'bun.lock', 'bunfig.toml'] as const
const frozenDir = join(IMMUTABLE_ASSET_ROOT, 'config/defuddle')
const hasFrozenInstall = async (root = defuddleRuntimeDir): Promise<boolean> => {
  assertRuntimeContainedPath(root)
  for (const name of frozenFiles) {
    const installed = Bun.file(assertManagedRuntimePath(join(root, name)))
    if (!await installed.exists() || await installed.text() !== await Bun.file(join(frozenDir, name)).text()) return false
  }
  const marker = Bun.file(assertManagedRuntimePath(join(root, '.frozen-install')))
  return await marker.exists() && (await marker.text()).trim() === DEFUDDLE_CLI_VERSION
    && await validateManagedPackageManifest(root, `defuddle@${DEFUDDLE_CLI_VERSION}`)
}

const RUNTIME = join(PROJECT_ROOT, 'runtime')
const defuddleCliSetupPromises = new Map<string, Promise<void>>()
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
  stream ? (await readBoundedTextStream(stream)).text : ''

const runCapture = async (
  command: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: assertManagedRuntimePath(options.cwd) } : {}),
    env: childEnv({ allow: DEFUDDLE_TEST_CHILD_ENV_KEYS, set: options.env }),
    stdout: 'pipe',
    stderr: 'pipe',
    signal: AbortSignal.timeout(args.includes('install') ? 15 * 60_000 : 60_000)
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
      return { path: assertRuntimeContainedPath(overrideBin), source: 'path' }
    }
  }

  if (await pathExists(defuddleRuntimeBinaryPath)) {
    return { path: assertRuntimeContainedPath(defuddleRuntimeBinaryPath), source: 'runtime' }
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
): Promise<RunResult> => {
  assertRuntimeContainedPath(binaryPath)
  const managedSuffix = '/node_modules/defuddle/dist/cli.js'
  const managedPackage = binaryPath.endsWith(managedSuffix)
  if (managedPackage && !await hasFrozenInstall(binaryPath.slice(0, -managedSuffix.length))) throw InfraError('Managed Defuddle package provenance or payload integrity is invalid', { stage: 'extract:defuddle' })
  if (managedPackage && !(await validateManagedJsRuntime('bun')).ok) throw InfraError('Managed Bun provenance or executable integrity is invalid; run bun autoshow setup --step toolchain', { stage: 'extract:defuddle' })
  return await runCapture(managedPackage ? getBunBinary() : binaryPath,
    managedPackage ? ['--no-env-file', binaryPath, ...args] : args, options)
}

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

export const validateManagedDefuddleRuntime = async (): Promise<{ ok: boolean, detail: string }> => {
  try {
    const root = assertRuntimeContainedPath(defuddleRuntimeDir)
    assertRuntimeContainedPath(defuddleRuntimeBinaryPath)
    const valid = await hasFrozenInstall(root)
    return { ok: valid, detail: valid ? `defuddle@${DEFUDDLE_CLI_VERSION}; frozen graph and complete payload verified` : 'Managed Defuddle frozen graph or payload integrity is invalid' }
  } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : String(error) } }
}

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

  const provenanceReady = resolved.source !== 'runtime' || await hasFrozenInstall()
  const verified = provenanceReady ? await verifyDefuddleCli(resolved.path) : { ok: false, detail: 'managed package provenance or payload integrity is invalid' }
  if (verified.ok && (resolved.source !== 'runtime' || isPinnedDefuddleCli(verified))) {
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

const writeRuntimePackageJson = async (root: string): Promise<void> => {
  await ensureRuntimeDirectory(root)
  for (const name of frozenFiles) {
    await Bun.write(assertManagedRuntimePath(join(root, name)), await Bun.file(join(frozenDir, name)).text())
  }
}

const setupDefuddleCliUnlocked = async (options: { forceRedownload?: boolean, directory?: string } = {}): Promise<void> => {
  const destination = assertRuntimeContainedPath(options.directory ?? defuddleRuntimeDir)
  const binaryPath = join(destination, 'node_modules/defuddle/dist/cli.js')
  await ensureRuntimeDirectory(dirname(destination))
  await recoverManagedToolDirectory(destination)
  if (!options.forceRedownload && await pathExists(binaryPath) && await hasFrozenInstall(destination)) {
    const verified = await verifyDefuddleCli(binaryPath)
    if (isPinnedDefuddleCli(verified)) {
      logSetupToolStatus({
        tool: 'defuddle',
        status: 'ready',
        detail: `${binaryPath} (${verified.detail})`
      })
      return
    }
  }

  logSetupToolStatus({
    tool: 'defuddle',
    status: 'installing',
    detail: `defuddle@${DEFUDDLE_CLI_VERSION}`
  })

  await ensureManagedBunRuntime()
  await ensureRuntimeDirectory(RUNTIME)
  const staging = await createManagedToolStagingDirectory(destination)
  let installed = false
  try {
    await writeRuntimePackageJson(staging)
    if (!(await validateManagedJsRuntime('bun')).ok) throw InfraError('Managed Bun integrity changed before Defuddle package installation', { stage: 'extract:defuddle' })
    const install = await runCapture(getBunBinary(), ['--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts'], {
      cwd: staging,
      allowFailure: true
    })
    if (install.exitCode !== 0) {
      throw InfraError(`Failed to install defuddle@${DEFUDDLE_CLI_VERSION}: ${formatDefuddleCliOutput(install)}`, { stage: 'extract:defuddle' })
    }
    await Bun.write(assertManagedRuntimePath(join(staging, '.frozen-install')), `${DEFUDDLE_CLI_VERSION}\n`)
    await writeManagedPackageManifest(staging, `defuddle@${DEFUDDLE_CLI_VERSION}`)
    await promoteManagedToolDirectory({
      stagingDir: staging,
      destinationDir: destination,
      validateStaging: async root => {
        const binary = join(root, 'node_modules/defuddle/dist/cli.js')
        if (!await hasFrozenInstall(root)) throw InfraError('Installed Defuddle package provenance or payload integrity is invalid', { stage: 'extract:defuddle' })
        const verified = await verifyDefuddleCli(binary)
        if (!isPinnedDefuddleCli(verified)) {
          throw InfraError(`Installed Defuddle CLI failed verification: ${verified.detail}`, { stage: 'extract:defuddle' })
        }
      }
    })
    installed = true
  } finally {
    if (installed) await rm(assertManagedRuntimePath(staging), { recursive: true, force: true })
  }
  logSetupToolStatus({
    tool: 'defuddle',
    status: 'ready',
    detail: `${binaryPath} (${DEFUDDLE_CLI_VERSION})`
  })
}

export const setupDefuddleCli = async (options: { forceRedownload?: boolean, directory?: string } = {}): Promise<void> => {
  const destination = assertRuntimeContainedPath(options.directory ?? defuddleRuntimeDir)
  let pending = defuddleCliSetupPromises.get(destination)
  if (!pending) {
    pending = withProcessLock(`setup-defuddle-${destination}`, async () => await setupDefuddleCliUnlocked(options)).finally(() => {
      defuddleCliSetupPromises.delete(destination)
    })
    defuddleCliSetupPromises.set(destination, pending)
  }
  await pending
}

export const ensureDefuddleCliSetup = async (): Promise<string> => {
  const resolved = await resolveDefuddleCli()
  if (resolved) {
    const provenanceReady = resolved.source !== 'runtime' || await hasFrozenInstall()
    const verified = provenanceReady ? await verifyDefuddleCli(resolved.path) : { ok: false, detail: 'invalid managed package' }
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
