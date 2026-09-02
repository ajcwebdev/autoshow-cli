type ExecRetryOptions = {
  operationName?: string
  shouldRetry: (result: CommandResultBase) => boolean
}

export type ExecOptions = {
  env?: Record<string, string | undefined>
  onStderrLine?: (line: string) => void
  maxBufferBytes?: number | undefined
  signal?: AbortSignal | undefined
  retry?: ExecRetryOptions
}

export type CommandResultBase = {
  stdout: string
  stderr: string
  exitCode: number
}

export type ExecResult = CommandResultBase & {
  stdoutBytes: number
  stderrBytes: number
  stdoutTruncated: boolean
  stderrTruncated: boolean
}
