import { closeSync, openSync } from 'node:fs'

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
      closeSync(this.fd)
    }
  }
}
