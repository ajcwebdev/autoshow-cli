export type ExecRetryOptions = {
  // Human-readable label used in retry warnings (defaults to the command name).
  operationName?: string
}

export type ExecOptions = {
  env?: Record<string, string | undefined>
  onStderrLine?: (line: string) => void
  maxBufferBytes?: number | undefined
  signal?: AbortSignal | undefined
  // When set, the command is retried on the simple fact that it failed — a
  // non-zero exit code or a thrown spawn error — under the shared
  // `runtime_subprocess_transient` policy. The last result is still returned
  // (not thrown) so callers keep their own exit-code error handling; exhaustion
  // is logged structurally instead.
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
