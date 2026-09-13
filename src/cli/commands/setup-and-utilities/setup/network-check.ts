import { childEnv } from '~/utils/child-env'
import { existsSync } from 'node:fs'
import { UsageError, InfraError } from '~/utils/error-handler'
import { createOpenAIResponse } from '~/utils/openai/openai-client'
import * as l from '~/utils/app-logger/app-logger'

export function networkCheckOptions(flags: Record<string, unknown>) {
  const mode = flags['network-check']
  if (mode !== 'serve' && mode !== 'probe') throw UsageError('--network-check must be serve or probe')
  const delaySeconds = Number(flags['delay-seconds'] ?? 150)
  const port = Number(flags['port'] ?? 8787)
  const client = flags['probe-client'] ?? 'rest'
  if (!Number.isInteger(delaySeconds) || delaySeconds < 1 || delaySeconds > 600) throw UsageError('--delay-seconds must be an integer between 1 and 600')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw UsageError('--port must be an integer between 1 and 65535')
  if (!['rest', 'fetch', 'fetch-no-keepalive'].includes(String(client))) throw UsageError('--probe-client must be rest, fetch, or fetch-no-keepalive')
  let url: URL | undefined
  if (mode === 'probe') {
    try { url = new URL(String(flags['probe-url'])) } catch { throw UsageError('--probe-url requires a local fixture URL') }
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw UsageError('--probe-url must be an HTTP origin on localhost or host.docker.internal')
  } else if (flags['probe-url'] !== undefined || flags['probe-client'] !== undefined) throw UsageError('Probe options require --network-check probe')
  return { mode, delaySeconds, port, client, url }
}

export function serveNetworkFixture(port: number, delaySeconds: number) {
  return Bun.serve({ hostname: '0.0.0.0', port, idleTimeout: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/ready') return Response.json({ ready: true, delaySeconds })
      if (path !== '/responses') return new Response(null, { status: 404 })
      await request.arrayBuffer()
      await Bun.sleep(delaySeconds * 1000)
      return Response.json({ output_text: 'ok' })
    }
  })
}

async function performNetworkProbe(url: URL, client: unknown, timeoutMs: number) {
  const start = performance.now()
  try {
    const signal = AbortSignal.timeout(timeoutMs)
    const readiness = await fetch(new URL('/ready', url), { signal, timeout: false, keepalive: false, redirect: 'error' })
    if (!readiness.ok || (await readiness.json() as { ready?: boolean }).ready !== true) throw InfraError('Fixture is not ready', { stage: 'setup:network-check' })
    let body: { output_text?: unknown }
    if (client === 'rest') {
      body = await createOpenAIResponse({ apiKey: 'local-test-only', baseURL: url.origin, redirect: 'error' }, { model: 'local-fixture', input: 'local-only probe' }, { signal })
    } else {
      const response = await fetch(new URL('/responses', url), { signal, timeout: false, redirect: 'error', ...(client === 'fetch-no-keepalive' ? { keepalive: false } : {}) })
      if (!response.ok) throw InfraError(`Fixture HTTP ${response.status}`, { stage: 'setup:network-check' })
      body = await response.json() as { output_text?: unknown }
    }
    if (body.output_text !== 'ok') throw InfraError('Unexpected fixture response', { stage: 'setup:network-check' })
    return { client, passed: true, elapsedSeconds: (performance.now() - start) / 1000 }
  } catch (error) {
    return { client, passed: false, elapsedSeconds: (performance.now() - start) / 1000, error: error instanceof Error ? error.message : String(error) }
  }
}

export const buildNetworkProbeChildEnv = (timeoutMs: number): Record<string, string> => childEnv({
  allow: ['AUTOSHOW_DISABLE_HTTP_KEEPALIVE'],
  set: { AUTOSHOW_SETUP_NO_ORPHANS_CHILD: '1', AUTOSHOW_NETWORK_CHECK_CHILD_TIMEOUT_MS: String(timeoutMs) }
})

export async function probeNetworkFixture(url: URL, client: unknown, timeoutMs: number): Promise<Awaited<ReturnType<typeof performNetworkProbe>>> {
  // Bun's proxy cache is shared with workers. A fresh process is required to
  // keep this diagnostic direct without changing the caller's proxy behavior.
  const start = performance.now()
  const sourceEntrypoint = new URL('../../../create-cli.ts', import.meta.url).pathname
  const entrypoint = existsSync(sourceEntrypoint) ? sourceEntrypoint : Bun.main
  return await new Promise(resolve => {
    let result: Awaited<ReturnType<typeof performNetworkProbe>> | undefined
    const child = Bun.spawn([
      process.execPath,
      ...(Bun.isStandaloneExecutable ? [] : ['--no-env-file', entrypoint]),
      'setup', '--network-check', 'probe', '--probe-url', url.href, '--probe-client', String(client)
    ], {
      env: buildNetworkProbeChildEnv(timeoutMs),
      stdout: 'ignore', stderr: 'ignore',
      ipc(message) { result = message }
    })
    const deadline = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    void child.exited.then(() => {
      clearTimeout(deadline)
      resolve(result ?? { client, passed: false, elapsedSeconds: (performance.now() - start) / 1000, error: 'Network probe process exited before reporting a result or exceeded its deadline' })
    })
  })
}

export async function runNetworkCheck(flags: Record<string, unknown>): Promise<void> {
  const options = networkCheckOptions(flags)
  if (options.mode === 'serve') {
    const server = serveNetworkFixture(options.port, options.delaySeconds)
    console.log(JSON.stringify({ ready: true, port: server.port, delaySeconds: options.delaySeconds }))
    await new Promise<void>(resolve => {
      const stop = () => { server.stop(true); process.off('SIGTERM', stop); process.off('SIGINT', stop); resolve() }
      process.on('SIGTERM', stop)
      process.on('SIGINT', stop)
    })
    return
  }
  const childTimeout = process.env['AUTOSHOW_NETWORK_CHECK_CHILD_TIMEOUT_MS']
  if (childTimeout !== undefined && process.send) {
    const timeoutMs = Number(childTimeout)
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 630_000) throw UsageError('Invalid network probe deadline')
    process.send(await performNetworkProbe(options.url!, options.client, timeoutMs))
    process.disconnect?.()
    return
  }
  const result = await probeNetworkFixture(options.url!, options.client, (options.delaySeconds + 30) * 1000)
  l.report.result(result, 'Network probe')
  if (!l.isJsonResultActive()) console.log(JSON.stringify(result))
  if (!result.passed) throw InfraError('Network probe failed', { stage: 'setup:network-check', metadata: result })
}
