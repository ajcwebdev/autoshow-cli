import { expect, test } from 'bun:test'
import { networkCheckOptions, serveNetworkFixture, probeNetworkFixture } from '~/cli/commands/setup-and-utilities/setup/network-check'

test('network options defaults and validation', () => {
  expect(networkCheckOptions({ 'network-check': 'serve' })).toMatchObject({ port: 8787, delaySeconds: 150, client: 'rest' })
  for (const flags of [{}, { 'network-check': 'other' }, { 'network-check': 'serve', 'delay-seconds': '0' }, { 'network-check': 'serve', 'delay-seconds': '1.5' }, { 'network-check': 'serve', port: '65536' }, { 'network-check': 'probe', 'probe-url': 'https://api.openai.com' }, { 'network-check': 'probe', 'probe-url': 'http://localhost:8787', 'probe-client': 'other' }]) expect(() => networkCheckOptions(flags)).toThrow()
})
test('fixture readiness, all three clients, deadline failure and explicit cleanup', async () => {
  const server = serveNetworkFixture(0, 0.02)
  const url = new URL(`http://127.0.0.1:${server.port}`)
  try {
    expect((await (await fetch(new URL('/ready', url))).json() as { ready: boolean }).ready).toBe(true)
    expect((await fetch(new URL('/unknown', url))).status).toBe(404)
    for (const client of ['rest', 'fetch', 'fetch-no-keepalive']) {
      const result = await probeNetworkFixture(url, client, 2000)
      expect(result.passed, JSON.stringify(result)).toBe(true)
      expect(result.elapsedSeconds).toBeGreaterThan(0.015)
    }
    expect((await probeNetworkFixture(url, 'rest', 1)).passed).toBe(false)
  } finally { server.stop(true) }
  expect((await probeNetworkFixture(url, 'rest', 100)).passed).toBe(false)
})

test('network CLI keeps JSON output valid and rejects setup conflicts without installation', async () => {
  const server = serveNetworkFixture(0, 0.01)
  const cli = new URL('../../../../src/cli/create-cli.ts', import.meta.url).pathname
  const run = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, '--no-env-file', cli, 'setup', ...args, '--json'], { env: { PATH: process.env['PATH'], AUTOSHOW_SETUP_NO_ORPHANS_CHILD: '1' }, stdout: 'pipe', stderr: 'pipe' })
    const [code, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { code, result: JSON.parse(stdout) }
  }
  try {
    const result = await run(['--network-check', 'probe', '--probe-url', `http://127.0.0.1:${server.port}`])
    expect(result.code).toBe(0)
    expect(JSON.stringify(result.result)).toContain('elapsedSeconds')
    expect((await run(['--network-check', 'serve', '--doctor'])).code).not.toBe(0)
    expect((await run(['--probe-client', 'rest'])).code).not.toBe(0)
  } finally { server.stop(true) }
  const failure = await run(['--network-check', 'probe', '--probe-url', `http://127.0.0.1:${server.port}`])
  expect(failure.code).not.toBe(0)
  expect(JSON.stringify(failure.result)).toContain('elapsedSeconds')
}, 10_000)

test('all probe clients bypass environment proxies without changing caller proxy behavior', async () => {
  let proxyHits = 0
  const proxy = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { proxyHits++; return new Response('Proxy rejected request', { status: 502 }) } })
  const fixture = serveNetworkFixture(0, 0.01)
  const modulePath = new URL('../../../../src/cli/commands/setup-and-utilities/setup/network-check.ts', import.meta.url).pathname
  const script = `
    import { probeNetworkFixture } from ${JSON.stringify(modulePath)};
    const url = new URL(process.env.FIXTURE_URL);
    const environment = () => JSON.stringify(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)));
    const before = environment();
    for (const client of ['rest', 'fetch', 'fetch-no-keepalive']) {
      const pending = probeNetworkFixture(url, client, 2000);
      if (environment() !== before) throw new Error('Proxy environment changed while request pending');
      const result = await pending;
      if (!result.passed) throw new Error(JSON.stringify(result));
      if (environment() !== before) throw new Error('Proxy environment not restored');
    }
    const failed = await probeNetworkFixture(url, 'rest', 1);
    if (failed.passed || environment() !== before) throw new Error('Failure did not restore environment');
    // An ordinary request must still use the configured proxy afterwards.
    if ((await fetch(url)).status !== 502) throw new Error('Ordinary fetch bypassed proxy');
  `
  try {
    const proxyUrl = `http://127.0.0.1:${proxy.port}`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', script], {
      env: { PATH: process.env['PATH'], FIXTURE_URL: `http://127.0.0.1:${fixture.port}`, http_proxy: proxyUrl, HTTP_PROXY: proxyUrl, https_proxy: proxyUrl, HTTPS_PROXY: proxyUrl, all_proxy: proxyUrl, ALL_PROXY: proxyUrl, NO_PROXY: '', no_proxy: '' },
      stdout: 'pipe', stderr: 'pipe'
    })
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    expect(code, stderr).toBe(0)
    expect(proxyHits).toBe(1)
  } finally { fixture.stop(true); proxy.stop(true) }
})

for (const redirectPath of ['/ready', '/responses']) {
  test(`all probe clients reject ${redirectPath} redirects without contacting the target`, async () => {
    let targetHits = 0
    const target = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      targetHits++
      return Response.json(new URL(request.url).pathname === '/ready' ? { ready: true } : { output_text: 'ok' })
    } })
    const fixture = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      const path = new URL(request.url).pathname
      if (path === redirectPath) return Response.redirect(`http://127.0.0.1:${target.port}${path}`, 307)
      return Response.json(path === '/ready' ? { ready: true } : { output_text: 'ok' })
    } })
    try {
      for (const client of ['rest', 'fetch', 'fetch-no-keepalive']) {
        const result = await probeNetworkFixture(new URL(`http://127.0.0.1:${fixture.port}`), client, 3000)
        expect(result.passed, JSON.stringify(result)).toBe(false)
        expect(result.error).toBeString()
        expect(targetHits).toBe(0)
      }
    } finally { fixture.stop(true); target.stop(true) }
  })
}
