import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface ProcessOutcome { exitCode: number; stdout: string; stderr: string; durationMs: number; timedOut: boolean }
export type ProcessRunner = (argv: string[], timeoutMs: number, logPrefix: string, onTimeout?: () => Promise<void>) => Promise<ProcessOutcome>

// Only Docker client connection settings reach the host child, never provider settings.
export function dockerClientEnvironment(source: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'XDG_RUNTIME_DIR']) {
    if (source[key] !== undefined) env[key] = source[key]
  }
  return env
}

export const createDockerProcessRunner = (executable = 'docker', environment: NodeJS.ProcessEnv = process.env): ProcessRunner => async (argv, timeoutMs, logPrefix, onTimeout) => {
  await mkdir(dirname(logPrefix), { recursive: true })
  const started = performance.now()
  const child = Bun.spawn([executable, ...argv], {
    env: dockerClientEnvironment(environment), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
  })
  let timedOut = false
  let cleanup: Promise<void> | undefined
  const interrupt = (): void => {
    child.kill('SIGKILL')
    cleanup ??= onTimeout?.()
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGKILL')
    cleanup = onTimeout?.()
  }, timeoutMs)
  async function drain(stream: ReadableStream<Uint8Array>, path: string): Promise<string> {
    const writer = Bun.file(path).writer()
    const decoder = new TextDecoder()
    let tail = ''
    try {
      for await (const chunk of stream) {
        writer.write(chunk)
        tail = (tail + decoder.decode(chunk, { stream: true })).slice(-1_048_576)
      }
      return tail + decoder.decode()
    } finally { await writer.end() }
  }
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      drain(child.stdout, `${logPrefix}.stdout.log`), drain(child.stderr, `${logPrefix}.stderr.log`), child.exited
    ])
    await cleanup
    return { stdout, stderr, exitCode, durationMs: Math.round(performance.now() - started), timedOut }
  } finally {
    clearTimeout(timer)
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
  }
}

export const runDockerProcess = createDockerProcessRunner()
