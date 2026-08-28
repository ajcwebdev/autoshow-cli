export type SyncCommandStdio = 'pipe' | 'inherit' | 'ignore'

export type SyncCommandOptions = {
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: SyncCommandStdio
  stdout?: SyncCommandStdio
  stderr?: SyncCommandStdio
  stdio?: SyncCommandStdio
  timeout?: number
  maxBuffer?: number
}

export type SyncCommandResult = {
  exitCode: number
  success: boolean
  signalCode?: string
  stdout: string
  stderr: string
}

export class SyncCommandError extends Error {
  readonly command: readonly string[]
  readonly exitCode: number
  readonly signalCode: string | undefined
  readonly stdout: string
  readonly stderr: string

  constructor(command: readonly string[], result: SyncCommandResult) {
    const reason = result.signalCode
      ? `signal ${result.signalCode}`
      : `exit code ${result.exitCode}`
    super(`Command failed with ${reason}: ${command.join(' ')}`)
    this.name = 'SyncCommandError'
    this.command = command
    this.exitCode = result.exitCode
    this.signalCode = result.signalCode
    this.stdout = result.stdout
    this.stderr = result.stderr
  }
}

const decodeOutput = (output: Uint8Array | null | undefined): string =>
  output === null || output === undefined ? '' : Buffer.from(output).toString('utf8')

export const runSyncCommand = (
  command: string,
  args: readonly string[] = [],
  options: SyncCommandOptions = {}
): SyncCommandResult => {
  const stdio = options.stdio
  const result = Bun.spawnSync([command, ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    stdin: options.stdin ?? stdio ?? 'ignore',
    stdout: options.stdout ?? stdio ?? 'pipe',
    stderr: options.stderr ?? stdio ?? 'pipe',
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    ...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer })
  })
  return {
    exitCode: result.exitCode,
    success: result.success,
    ...(result.signalCode === undefined ? {} : { signalCode: result.signalCode }),
    stdout: decodeOutput(result.stdout),
    stderr: decodeOutput(result.stderr)
  }
}

export const runSyncCommandOrThrow = (
  command: string,
  args: readonly string[] = [],
  options: SyncCommandOptions = {}
): string => {
  const result = runSyncCommand(command, args, options)
  if (!result.success) throw new SyncCommandError([command, ...args], result)
  return result.stdout
}
