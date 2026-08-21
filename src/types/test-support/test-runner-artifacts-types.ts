type RunnerLogWriter = ReturnType<ReturnType<typeof Bun.file>['writer']>

export type RunnerLogHandle = {
  writer: RunnerLogWriter
  pendingBytes: number
  closed: boolean
  flushTimer: ReturnType<typeof setInterval>
}
