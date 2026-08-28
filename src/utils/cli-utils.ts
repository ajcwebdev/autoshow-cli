import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import type { ExecOptions, ExecResult } from '~/types'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { extractErrorMetadata, hasErrorCode, InfraError } from '~/utils/error-handler'
import { withRetry } from '~/utils/retries'
import * as l from './app-logger/app-logger'
import { childEnv } from './child-env'

const DEFAULT_LINE_BUFFER_CHARS = 64 * 1024

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

const execOnce = async (
  command: string,
  args: string[],
  opts?: ExecOptions
): Promise<ExecResult> => {
  opts?.signal?.throwIfAborted()
  const proc = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: childEnv({ set: opts?.env })
  })
  const onAbort = (): void => {
    try {
      proc.kill()
    } catch {
    }
  }
  opts?.signal?.addEventListener('abort', onAbort, { once: true })
  if (opts?.signal?.aborted) {
    onAbort()
  }

  let stdout: Awaited<ReturnType<typeof readStreamText>>
  let stderr: Awaited<ReturnType<typeof readStreamText>>
  let exitCode: number
  try {
    [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout, undefined, opts?.maxBufferBytes),
      readStreamText(proc.stderr, opts?.onStderrLine, opts?.maxBufferBytes),
      proc.exited
    ])
  } finally {
    opts?.signal?.removeEventListener('abort', onAbort)
  }
  opts?.signal?.throwIfAborted()
  return {
    stdout: stdout.text,
    stderr: stderr.text,
    exitCode,
    stdoutBytes: stdout.totalBytes,
    stderrBytes: stderr.totalBytes,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated
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

  const operationName = retry.operationName ?? command
  let lastResult: ExecResult | undefined

  try {
    return await withRetry(
      {
        retryClass: 'runtime_subprocess_transient',
        operationName,
        ...(opts?.signal ? { abortSignal: opts.signal } : {})
      },
      async () => {
        const result = await execOnce(command, args, opts)
        if (result.exitCode === 0) {
          return result
        }
        lastResult = result
        throw InfraError(`${operationName} failed (exit code ${result.exitCode})`, {
          stage: 'exec',
          metadata: { command, exitCode: result.exitCode }
        })
      }
    )
  } catch (error) {
    opts?.signal?.throwIfAborted()
    if (!lastResult) {
      throw error
    }

    const metadata = extractErrorMetadata(error)
    l.write('warn', 'Exec Retry Exhausted', {
      category: 'pipeline',
      metadata: {
        operation: operationName,
        command,
        exitCode: lastResult.exitCode,
        attemptsMade: metadata['attemptsMade'],
        maxAttempts: metadata['maxAttempts'],
        elapsedMs: metadata['elapsedMs'],
        stopReason: metadata['stopReason'],
        retryClass: 'runtime_subprocess_transient'
      }
    })
    return lastResult
  }
}

export const commandExists = (command: string): boolean => {
  return Bun.which(command) !== null
}

export const pick = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result
}

export const ensureDirectory = async (dirPath: string): Promise<void> => {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    l.error(`Failed to create directory: ${dirPath}`, { category: 'artifact', error, metadata: { dirPath } })
    throw error
  }
}

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await Bun.write(filePath, content)
  } catch (error) {
    l.error(`Failed to write file: ${filePath}`, { category: 'artifact', error, metadata: { filePath } })
    throw error
  }
}

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ENAMETOOLONG'].some((code) => hasErrorCode(error, code))) {
      return false
    }
    throw error
  }
}
