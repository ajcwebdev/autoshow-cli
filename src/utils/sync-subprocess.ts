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
  maxBufferExceeded?: boolean
  signalCode?: string
  stdout: string
  stderr: string
}

export class SyncCommandError extends Error {
  readonly command: readonly string[]
  readonly exitCode: number
  readonly maxBufferExceeded: boolean
  readonly signalCode: string | undefined
  readonly stdout: string
  readonly stderr: string

  constructor(command: readonly string[], result: SyncCommandResult) {
    const reason = result.maxBufferExceeded === true
      ? 'output exceeding maxBuffer'
      : result.signalCode
        ? `signal ${result.signalCode}`
        : `exit code ${result.exitCode}`
    super(`Command failed with ${reason}: ${command.join(' ')}`)
    this.name = 'SyncCommandError'
    this.command = command
    this.exitCode = result.exitCode
    this.maxBufferExceeded = result.maxBufferExceeded === true
    this.signalCode = result.signalCode
    this.stdout = result.stdout
    this.stderr = result.stderr
  }
}

const boundedOutput = (
  output: Uint8Array | null | undefined,
  maxBuffer: number | undefined
): { bytes: Uint8Array, exceeded: boolean } => {
  const bytes = output ?? new Uint8Array()
  if (maxBuffer === undefined || bytes.byteLength <= maxBuffer) return { bytes, exceeded: false }
  return { bytes: bytes.subarray(0, maxBuffer), exceeded: true }
}

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
  const stdout = boundedOutput(result.stdout, options.maxBuffer)
  const stderr = boundedOutput(result.stderr, options.maxBuffer)
  const maxBufferExceeded = stdout.exceeded || stderr.exceeded
  return {
    exitCode: result.exitCode ?? -1,
    success: result.success && !maxBufferExceeded,
    ...(maxBufferExceeded ? { maxBufferExceeded: true } : {}),
    ...(result.signalCode === undefined ? {} : { signalCode: result.signalCode }),
    stdout: Buffer.from(stdout.bytes).toString('utf8'),
    stderr: Buffer.from(stderr.bytes).toString('utf8')
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
