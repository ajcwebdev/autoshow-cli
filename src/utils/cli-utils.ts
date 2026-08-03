import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import type { ExecOptions, ExecResult } from '~/types'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import * as l from './app-logger/app-logger'

let envFileLoaded = false
const DEFAULT_EXEC_HEARTBEAT_MS = 60_000
const DEFAULT_LINE_BUFFER_CHARS = 64 * 1024

const resolveHeartbeatMs = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : DEFAULT_EXEC_HEARTBEAT_MS

const formatElapsedSeconds = (elapsedMs: number): string =>
  `${Math.max(1, Math.ceil(elapsedMs / 1000))}s`

const startExecHeartbeat = (
  command: string,
  opts: ExecOptions | undefined
): ReturnType<typeof setInterval> | undefined => {
  if (!opts?.progressLabel && !opts?.onHeartbeat) {
    return undefined
  }

  const label = opts.progressLabel ?? command
  const startedAt = Date.now()
  const heartbeat = setInterval(() => {
    const elapsedMs = Date.now() - startedAt
    const message = `${label} still running after ${formatElapsedSeconds(elapsedMs)}`
    if (opts.onHeartbeat) {
      opts.onHeartbeat(elapsedMs, message)
      return
    }
    l.write('info', message)
  }, resolveHeartbeatMs(opts.heartbeatMs))

  ;(heartbeat as { unref?: () => void }).unref?.()
  return heartbeat
}

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | null,
  onLine?: (line: string) => void,
  maxBufferBytes?: number | undefined
): Promise<{ text: string, totalBytes: number, truncated: boolean }> => {
  if (!stream) {
    return { text: '', totalBytes: 0, truncated: false }
  }

  let pending = ''

  const flushLines = (chunk: string, allowPartial: boolean): void => {
    if (!onLine || chunk.length === 0) {
      return
    }

    pending += chunk
    if (pending.length > DEFAULT_LINE_BUFFER_CHARS) {
      onLine(`${pending.slice(0, DEFAULT_LINE_BUFFER_CHARS)}... [line truncated]`)
      pending = pending.slice(-DEFAULT_LINE_BUFFER_CHARS)
    }

    while (true) {
      const lineBreakIndex = pending.search(/[\r\n]/)
      if (lineBreakIndex < 0) {
        break
      }

      const line = pending.slice(0, lineBreakIndex)
      let nextIndex = lineBreakIndex + 1
      if (pending[lineBreakIndex] === '\r' && pending[nextIndex] === '\n') {
        nextIndex++
      }
      pending = pending.slice(nextIndex)
      onLine(line)
    }

    if (allowPartial && pending.length > 0) {
      onLine(pending)
      pending = ''
    }
  }

  const captured = await readBoundedTextStream(
    stream,
    { maxBytes: maxBufferBytes },
    undefined,
    (chunk) => flushLines(chunk, false)
  )
  flushLines('', true)

  return {
    text: captured.text,
    totalBytes: captured.totalBytes,
    truncated: captured.truncated
  }
}

const DEFAULT_EXEC_RETRY_ATTEMPTS = 2
const DEFAULT_EXEC_RETRY_BASE_DELAY_MS = 1_000
const DEFAULT_EXEC_RETRY_MAX_DELAY_MS = 8_000

const computeExecRetryDelay = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number => {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1)
  const jittered = exponential * (0.5 + Math.random() * 0.5)
  return Math.round(Math.min(jittered, maxDelayMs))
}

const execOnce = async (
  command: string,
  args: string[],
  opts?: ExecOptions
): Promise<ExecResult> => {
  const env = opts?.env ? { ...process.env, ...opts.env } : undefined
  const proc = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(env ? { env: env as Record<string, string | undefined> } : {})
  })
  const heartbeat = startExecHeartbeat(command, opts)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout, opts?.onStdoutLine, opts?.maxBufferBytes),
      readStreamText(proc.stderr, opts?.onStderrLine, opts?.maxBufferBytes),
      proc.exited
    ])
    return {
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode,
      stdoutBytes: stdout.totalBytes,
      stderrBytes: stderr.totalBytes,
      stdoutTruncated: stdout.truncated,
      stderrTruncated: stderr.truncated
    }
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat)
    }
  }
}

export const exec = async (
  command: string,
  args: string[] = [],
  opts?: ExecOptions
): Promise<ExecResult> => {
  const retry = opts?.retry
  if (!retry) {
    return await execOnce(command, args, opts)
  }

  const maxAttempts = Math.max(1, Math.floor(retry.maxAttempts ?? DEFAULT_EXEC_RETRY_ATTEMPTS))
  const baseDelayMs = retry.baseDelayMs ?? DEFAULT_EXEC_RETRY_BASE_DELAY_MS
  const maxDelayMs = retry.maxDelayMs ?? DEFAULT_EXEC_RETRY_MAX_DELAY_MS
  const label = retry.operationName ?? command

  let lastResult: ExecResult | undefined
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let result: ExecResult | undefined
    let failureReason: string | undefined

    try {
      result = await execOnce(command, args, opts)
      if (result.exitCode === 0) {
        return result
      }
      lastResult = result
      failureReason = `exit code ${result.exitCode}`
    } catch (error) {
      lastError = error
      failureReason = error instanceof Error ? error.message : String(error)
    }

    if (attempt >= maxAttempts) {
      break
    }

    const delayMs = computeExecRetryDelay(attempt, baseDelayMs, maxDelayMs)
    l.write('warn', `${label} failed (${failureReason}); retrying (${attempt}/${maxAttempts}) in ${delayMs}ms`, {
      category: 'pipeline',
      metadata: { command, attempt, maxAttempts, failureReason, delayMs }
    })
    if (retry.onBeforeRetry) {
      await retry.onBeforeRetry()
    }
    await Bun.sleep(delayMs)
  }

  if (lastResult) {
    return lastResult
  }
  throw lastError ?? new Error(`${label} failed`)
}

export const commandExists = (command: string): boolean => {
  return Bun.which(command) !== null
}

export const loadEnvFile = async (): Promise<void> => {
  try {
    if (envFileLoaded) {
      return
    }
    const envPath = '.env'
    const exists = await fileExists(envPath)
    if (!exists) {
      return
    }
    const content = await Bun.file(envPath).text()
    const lines = content.split('\n')
    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (!key || valueParts.length === 0) {
          l.warn(`Skipping malformed .env line: ${trimmedLine.slice(0, 40)}${trimmedLine.length > 40 ? '...' : ''}`)
          return
        }
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        process.env[key.trim()] = value.trim()
      }
    })
    envFileLoaded = true
  } catch (error) {
    l.error(`Failed to load .env file`, error)
  }
}

export const ensureDirectory = async (dirPath: string): Promise<void> => {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    l.error(`Failed to create directory: ${dirPath}`, error)
    throw error
  }
}

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await Bun.write(filePath, content)
  } catch (error) {
    l.error(`Failed to write file: ${filePath}`, error)
    throw error
  }
}

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as NodeJS.ErrnoException).code
      : undefined
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ENAMETOOLONG') {
      return false
    }
    throw error
  }
}
