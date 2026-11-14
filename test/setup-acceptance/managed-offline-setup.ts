import { readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import type { ManagedDynamicLibraryClosureResult } from '~/types'
import { calibreAppPath, calibreToolDir, ebookConvertManagedBinaryPath } from '~/utils/runtime-paths'
import { buildManagedCalibreSandboxArguments, buildManagedCalibreSandboxProfile, buildManagedCalibreWrapperScript } from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'

const NETWORK_DENIAL = '(version 1)\n(allow default)\n(deny network*)'
const BLOCKED_PARENT = 'Offline setup blocked parent network dispatch'
const requireAcceptance = (condition: unknown, message: string): void => { if (!condition) throw new Error(message) }
type SpawnOptions = Record<string, unknown>
type CalibreReceipt = Pick<ManagedDynamicLibraryClosureResult, 'inertRunpaths' | 'unavailableComponents' | 'absentFrameworks'>

/** macOS cannot nest sandboxes: Calibre retains its exact production sandbox. */
export const runManagedOfflineSetup = async (selfTestOnly = false): Promise<void> => {
  requireAcceptance(process.platform === 'darwin', 'Managed offline setup acceptance requires macOS sandbox-exec.')
  const originalSpawn = Bun.spawn.bind(Bun)
  const originalSpawnSync = Bun.spawnSync.bind(Bun)
  const originalFetch = globalThis.fetch
  const restorations: Array<() => void> = []
  const counters = { parentControlDenials: 0, asyncChildControlDenied: false, syncChildControlDenied: false, setupNetworkAttempts: 0, rejectedSubprocesses: 0, setupSandboxedChildren: 0, calibreSandboxedChildren: 0, calibreWrapperChildren: 0 }
  let controls = true
  let requests = 0
  const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests += 1; return new Response('local-control') } })
  const localUrl = `http://127.0.0.1:${listener.port}/offline-control`
  const replace = (target: object, key: string, value: unknown): void => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)
    requireAcceptance(descriptor !== undefined, `Cannot guard missing dispatch API ${key}.`)
    Object.defineProperty(target, key, { ...descriptor, value })
    restorations.push(() => Object.defineProperty(target, key, descriptor!))
  }
  const denyParent = (): never => {
    if (controls) counters.parentControlDenials += 1
    else counters.setupNetworkAttempts += 1
    throw new Error(BLOCKED_PARENT)
  }
  let expectedCalibreArgs: string[] | undefined
  const requireProcessPolicy = (condition: unknown, message: string): void => {
    if (!condition) counters.rejectedSubprocesses += 1
    requireAcceptance(condition, message)
  }
  const calibreReceipt = (): CalibreReceipt => {
    const receipt = JSON.parse(readFileSync(join(calibreToolDir, '.autoshow-managed-artifact.json'), 'utf8')) as CalibreReceipt
    requireAcceptance(Array.isArray(receipt.inertRunpaths) && Array.isArray(receipt.unavailableComponents) && Array.isArray(receipt.absentFrameworks), 'Calibre closure receipt is missing its wrapper policy.')
    requireAcceptance(receipt.unavailableComponents.length === 5, 'Offline acceptance expects all five pinned unavailable Calibre images to remain disabled.')
    return receipt
  }
  const guardedArguments = (first: unknown, second?: unknown): [string[], SpawnOptions] => {
    const options = (Array.isArray(first) ? second ?? {} : first) as SpawnOptions
    const command: unknown = Array.isArray(first) ? first : options?.['cmd']
    requireProcessPolicy(Array.isArray(command) && command.length > 0 && command.every(part => typeof part === 'string'), 'Unexpected subprocess command shape in offline setup.')
    const argv = [...command as string[]]
    const executable = argv[0]!
    if (resolve(executable) === resolve(ebookConvertManagedBinaryPath)) {
      const receipt = calibreReceipt()
      const expected = buildManagedCalibreWrapperScript(receipt.inertRunpaths, receipt.unavailableComponents, receipt.absentFrameworks)
      requireProcessPolicy(readFileSync(executable, 'utf8') === expected, 'Calibre wrapper differs from its exact managed production policy.')
      requireProcessPolicy(expected.includes("/usr/bin/sandbox-exec -p '(version 1)"), 'Calibre wrapper is missing its production sandbox.')
      requireProcessPolicy(expected.includes(`(deny network*)`), 'Calibre wrapper permits network access.')
      requireProcessPolicy(expected.includes(`/usr/bin/sandbox-exec -p '${NETWORK_DENIAL}' /usr/bin/codesign`) && expected.includes(`/usr/bin/sandbox-exec -p '${NETWORK_DENIAL}' /usr/sbin/spctl`), 'Calibre signature checks must deny network access independently.')
      counters.calibreWrapperChildren += 1
      return [argv, options]
    }
    if (executable === '/usr/bin/sandbox-exec') {
      requireProcessPolicy(expectedCalibreArgs !== undefined, 'Unexpected nested or unverified sandbox command in offline setup.')
      const expected = [...expectedCalibreArgs!, join(realpathSync(calibreAppPath), 'Contents/MacOS/ebook-convert')]
      requireProcessPolicy(expected.every((value, index) => argv[index + 1] === value), 'Calibre sandbox profile, image exclusions, or application entrypoint changed.')
      requireProcessPolicy(expectedCalibreArgs![1] === buildManagedCalibreSandboxProfile(5), 'Calibre sandbox does not preserve all five image exclusions and network denial.')
      requireProcessPolicy(argv.length === expected.length + 2 && argv.at(-1) === '--version', 'Unexpected Calibre sandbox invocation during warm setup.')
      counters.calibreSandboxedChildren += 1
      return [argv, options]
    }
    if (!controls) counters.setupSandboxedChildren += 1
    return [['/usr/bin/sandbox-exec', '-p', NETWORK_DENIAL, ...argv], options]
  }
  try {
    requireAcceptance(await (await originalFetch(localUrl)).text() === 'local-control', 'Local network positive control failed before installing guards.')
    replace(globalThis, 'fetch', denyParent)
    for (const [module, keys] of [
      [http, ['request', 'get']], [https, ['request', 'get']], [net, ['connect', 'createConnection']],
      [tls, ['connect']], [dns, ['lookup', 'resolve']], [dns.promises, ['lookup', 'resolve']],
      [net.Socket.prototype, ['connect']],
      [Bun, ['connect', 'listen', 'serve']]
    ] as const) for (const key of keys) replace(module, key, denyParent)
    replace(globalThis, 'WebSocket', class { constructor() { denyParent() } })
    for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) replace(childProcess, key, () => { counters.rejectedSubprocesses += 1; throw new Error(`Unexpected node:child_process.${key} in offline setup; use the guarded Bun process API.`) })
    replace(Bun, 'spawn', ((first: unknown, second?: unknown) => {
      const [argv, options] = guardedArguments(first, second)
      return originalSpawn(argv, options)
    }) as typeof Bun.spawn)
    replace(Bun, 'spawnSync', ((first: unknown, second?: unknown) => {
      const [argv, options] = guardedArguments(first, second)
      return originalSpawnSync(argv, options)
    }) as typeof Bun.spawnSync)
    syncBuiltinESMExports()
    for (const control of [() => globalThis.fetch(localUrl), () => http.get(localUrl), () => net.connect({ host: '127.0.0.1', port: listener.port! })]) {
      try { await control(); throw new Error('Parent network guard allowed a control dispatch.') }
      catch (error) { requireAcceptance(error instanceof Error && error.message === BLOCKED_PARENT, 'Parent network guard did not produce the expected denial.') }
    }
    const healthySandbox = Bun.spawnSync(['/usr/bin/true'], { stdout: 'pipe', stderr: 'pipe' })
    requireAcceptance(healthySandbox.exitCode === 0, `macOS process sandbox is unavailable: ${healthySandbox.stderr.toString()}`)
    const curl = ['/usr/bin/curl', '--noproxy', '*', '--fail', '--silent', '--show-error', '--connect-timeout', '1', '--max-time', '2', localUrl]
    const child = Bun.spawn(curl, { stdout: 'pipe', stderr: 'pipe' })
    const [asyncExit, asyncError] = await Promise.all([child.exited, new Response(child.stderr).text()])
    counters.asyncChildControlDenied = asyncExit !== 0 && requests === 1
    requireAcceptance(counters.asyncChildControlDenied, `Asynchronous child reached the live local listener: ${asyncError}`)
    const synchronous = Bun.spawnSync(curl, { stdout: 'pipe', stderr: 'pipe' })
    counters.syncChildControlDenied = synchronous.exitCode !== 0 && requests === 1
    requireAcceptance(counters.syncChildControlDenied, `Synchronous child reached the live local listener: ${synchronous.stderr.toString()}`)
    listener.stop(true)
    if (!selfTestOnly) {
      const receipt = calibreReceipt()
      expectedCalibreArgs = await buildManagedCalibreSandboxArguments(calibreAppPath, receipt.unavailableComponents)
      controls = false
      const { runCliInProcess } = await import('../../src/cli/create-cli')
      const exitCode = await runCliInProcess(['setup', '--json'])
      requireAcceptance(exitCode === 0, `Offline warm setup failed with exit ${exitCode}.`)
      requireAcceptance(counters.setupNetworkAttempts === 0, 'Warm setup attempted a parent network request or download.')
      requireAcceptance(counters.rejectedSubprocesses === 0, 'Warm setup attempted an unexpected subprocess, even if its failure was caught.')
      requireAcceptance(counters.setupSandboxedChildren > 0 && counters.calibreSandboxedChildren > 0 && counters.calibreWrapperChildren > 0, 'Warm setup did not exercise the guarded native and Calibre process paths.')
    }
    process.stderr.write(`${JSON.stringify({ type: 'managed-offline-setup-acceptance', mode: selfTestOnly ? 'controls' : 'warm-setup', ...counters })}\n`)
  } finally {
    listener.stop(true)
    for (const restore of restorations.reverse()) restore()
    syncBuiltinESMExports()
  }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  requireAcceptance(args.length === 0 || (args.length === 1 && args[0] === '--self-test'), 'Expected managed-offline-setup.ts [--self-test].')
  await runManagedOfflineSetup(args[0] === '--self-test')
}
