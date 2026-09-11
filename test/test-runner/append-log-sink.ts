import { closeSync, openSync } from 'node:fs'

// The descriptor owns O_APPEND; opening a writer by pathname would truncate it.
// Each owner writes complete records and flushes before exposing them to readers.
export class AppendLogSink {
  readonly writer: Bun.FileSink
  private readonly fd: number
  private closed = false

  constructor(path: string) {
    this.fd = openSync(path, 'a')
    try {
      this.writer = Bun.file(this.fd).writer()
    } catch (error) {
      closeSync(this.fd)
      throw error
    }
  }

  async append(text: string): Promise<void> {
    if (this.closed) throw new Error('Cannot append to a closed log sink')
    this.writer.write(text)
    await this.writer.flush()
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    try {
      await this.writer.end()
    } finally {
      // FileSink does not close descriptors supplied by its caller.
      closeSync(this.fd)
    }
  }
}
