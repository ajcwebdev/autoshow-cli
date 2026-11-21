import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { getBunBinary, resolveRuntimeToolInfo, RUNTIME_DIR } from '../utils/runtime-paths'
import { childEnv } from '../utils/child-env'
import { InfraError } from '../utils/error-handler'
import { hydrateDockerRuntime } from './docker-runtime-seed'

export const dockerInvocationNeedsRuntime = (args: readonly string[]): boolean => {
  const delimiter = args.indexOf('--')
  const flags = delimiter === -1 ? args : args.slice(0, delimiter)
  const enabled = (names: readonly string[]): boolean => flags.some(arg => {
    const [name, value] = arg.split('=', 2)
    return names.includes(name!) && (value === undefined || !['false', '0', 'no', 'off'].includes(value.toLowerCase()))
  })
  if (args.length === 0 || enabled(['--help', '-h', '--version', '-V', '-v']) || flags.some(arg => ['--help-topic', '--help-format'].some(name => arg === name || arg.startsWith(`${name}=`))) || args[0] === 'help' || args[0] === 'config') return false
  if (args[0] === 'setup' && flags.some(arg => arg === '--network-check' || arg.startsWith('--network-check='))) return false
  if (args[0] === 'setup' && enabled(['--doctor', '--dry-run', '--show', '--reset'])) return false
  return true
}

export const dockerRuntimeNeedsHydration = async (
  resolveBun: () => string | undefined = () => resolveRuntimeToolInfo('bun')?.path,
  executable: (path: string) => Promise<void> = async path => { await access(path, constants.X_OK) }
): Promise<boolean> => {
  // Resolution validates physical containment. An escaping user installation
  // must fail visibly rather than be replaced by an image-owned payload.
  const binary = resolveBun()
  if (!binary) return true
  try { await executable(binary); return false } catch { return true }
}

export const dockerCommandUsesBootstrapBun = (args: readonly string[]): boolean =>
  !dockerInvocationNeedsRuntime(args) || args[0] === 'setup'

/** Parse only; the normal CLI remains responsible for diagnostics and handlers. */
export const dockerInvocationCanDispatch = async (args: readonly string[]): Promise<boolean> => {
  const [{ normalizeCliDispatchArgs }, { parseNativeCli }, { COMMAND_DEFINITIONS }, { GLOBAL_FLAG_DEFINITIONS }, { getUnknownFlagSpellings }] = await Promise.all([
    import('../cli/create-cli'),
    import('../cli/native/native-parser'),
    import('../cli/command-definitions'),
    import('../cli/global-flags'),
    import('../cli/native/unknown-flag-spellings')
  ])
  try {
    const parsed = parseNativeCli(normalizeCliDispatchArgs([...args]), COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
    if (parsed.mode !== 'command' || !parsed.command) return false
    return parsed.command.allowUnknownFlags === true || getUnknownFlagSpellings(parsed.rawParsed).length === 0
  } catch {
    return false
  }
}

export const dockerInvocationLaunchPlan = async (args: readonly string[]): Promise<{ needsRuntime: boolean; bootstrap: boolean }> => {
  const { normalizeCliDispatchArgs } = await import('../cli/create-cli')
  const canonical = normalizeCliDispatchArgs(args)
  const needsRuntime = dockerInvocationNeedsRuntime(canonical) && await dockerInvocationCanDispatch(canonical)
  return { needsRuntime, bootstrap: !needsRuntime || dockerCommandUsesBootstrapBun(canonical) }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  const { needsRuntime, bootstrap } = await dockerInvocationLaunchPlan(args)
  if (needsRuntime && await dockerRuntimeNeedsHydration()) await hydrateDockerRuntime('/opt/autoshow-runtime', RUNTIME_DIR)
  const executable = bootstrap ? process.execPath : getBunBinary()
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn([executable, '--no-env-file', '/app/src/cli/bundled-cli.js', ...args], {
      env: { ...process.env, ...childEnv() }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'
    })
  } catch (cause) {
    throw InfraError('Managed runtime launcher could not start. Run setup --step toolchain to repair the runtime.', { stage: 'docker:runtime', cause })
  }
  const stop = () => proc.kill('SIGTERM')
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  try { process.exitCode = await proc.exited }
  finally { process.off('SIGTERM', stop); process.off('SIGINT', stop) }
}
