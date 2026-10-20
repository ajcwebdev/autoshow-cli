import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const installer = resolve(import.meta.dir, '../../../../.github/actions/scan-image/install-scan-tools.sh')
const versions = { syft: 'v1.51.1', grype: 'v0.118.0' }
const curl = Bun.which('curl')!
type FixtureOptions = {
  arch?: 'x86_64' | 'arm64'
  installSyft?: boolean
  checksum?: 'missing' | 'duplicate' | 'malformed' | 'mismatch'
  archive?: 'corrupt' | 'missing-binary' | 'empty-binary' | 'symlink'
  httpStatus?: number
  transientFailures?: number
}

async function install(options: FixtureOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'docker-scanner-install-'))
  roots.push(root)
  const bin = join(root, 'bin'), temp = join(root, 'temp'), fixtures = join(root, 'fixtures')
  await Promise.all([mkdir(bin), mkdir(temp), mkdir(fixtures)])
  const arch = options.arch === 'arm64' ? 'arm64' : 'amd64'
  const files = new Map<string, Uint8Array | string>()
  for (const name of ['syft', 'grype'] as const) {
    const dir = join(fixtures, name)
    await mkdir(dir)
    const binary = join(dir, name)
    const entry = options.archive === 'missing-binary' ? 'other' : name
    if (options.archive === 'symlink') {
      await Bun.write(join(root, 'untouched'), 'keep this file\n')
      await symlink(join(root, 'untouched'), binary)
    } else await Bun.write(join(dir, entry), options.archive === 'empty-binary' ? '' : `#!/bin/sh\nprintf '%s\\n' '${name} fixture ${versions[name]}'\n`)
    const archiveName = `${name}_${versions[name].slice(1)}_linux_${arch}.tar.gz`
    const archive = join(fixtures, archiveName)
    const packed = Bun.spawnSync(['tar', '-czf', archive, '-C', dir, entry], { stdout: 'pipe', stderr: 'pipe' })
    expect(packed.exitCode, packed.stderr.toString()).toBe(0)
    const bytes = options.archive === 'corrupt' ? new TextEncoder().encode('not a gzip archive') : await Bun.file(archive).bytes()
    const hash = options.checksum === 'mismatch' ? '0'.repeat(64) : new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
    const line = `${hash}  ${archiveName}\n`
    files.set(archiveName, bytes)
    files.set(`${name}_${versions[name].slice(1)}_checksums.txt`, options.checksum === 'missing' ? '' : options.checksum === 'malformed' ? `wrong  ${archiveName}\n` : options.checksum === 'duplicate' ? line + line : line)
  }
  const requests: string[] = []
  const counts = new Map<string, number>()
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const file = basename(new URL(request.url).pathname)
    requests.push(file)
    const count = (counts.get(file) ?? 0) + 1
    counts.set(file, count)
    if (options.httpStatus) return new Response('injected HTTP error', { status: options.httpStatus })
    if (file.endsWith('.tar.gz') && count <= (options.transientFailures ?? 0)) return new Response('transient HTTP error', { status: 503 })
    const body = files.get(file)
    return body === undefined ? new Response('unexpected fixture URL', { status: 404 }) : new Response(body)
  } })
  const shim = join(root, 'curl.ts'), log = join(root, 'curl-arguments.jsonl')
  await Bun.write(shim, `import { appendFile } from 'node:fs/promises';
const args = process.argv.slice(2);
await appendFile(process.env['SCANNER_TEST_LOG'], JSON.stringify(args)+'\\n');
const url = new URL(args.at(-1));
if (url.hostname !== 'github.com') throw new Error('Unexpected remote host');
args[args.length-1] = process.env['SCANNER_TEST_ORIGIN'] + url.pathname;
const child = Bun.spawn([process.env['SCANNER_TEST_CURL'], ...args], {stdin:'ignore',stdout:'inherit',stderr:'inherit'});
process.exitCode = await child.exited;
`)
  await Bun.write(join(bin, 'curl'), '#!/bin/sh\nexec "$SCANNER_TEST_BUN" "$SCANNER_TEST_SHIM" "$@"\n')
  await Bun.write(join(bin, 'uname'), '#!/bin/sh\nprintf "%s\\n" "$SCANNER_TEST_ARCH"\n')
  await Promise.all([chmod(join(bin, 'curl'), 0o755), chmod(join(bin, 'uname'), 0o755)])
  try {
    const child = Bun.spawn(['bash', installer], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: {
      PATH: `${bin}:${process.env['PATH'] ?? ''}`, RUNNER_TEMP: temp, GITHUB_PATH: join(root, 'github-path'),
      GRYPE_VERSION: versions.grype, ...(options.installSyft === false ? {} : { SYFT_VERSION: versions.syft }), INSTALL_SYFT: String(options.installSyft !== false),
      SCANNER_TEST_BUN: process.execPath, SCANNER_TEST_CURL: curl, SCANNER_TEST_SHIM: shim, SCANNER_TEST_LOG: log,
      SCANNER_TEST_ARCH: options.arch ?? 'x86_64', SCANNER_TEST_ORIGIN: `http://127.0.0.1:${server.port}`
    } })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const invocations = await Bun.file(log).exists() ? (await Bun.file(log).text()).trim().split('\n').map(line => JSON.parse(line) as string[]) : []
    return { root, code, stdout, stderr, requests, invocations, temp, githubPath: await Bun.file(join(root, 'github-path')).exists() }
  } finally { await server.stop(true) }
}

test('scanner installation selects both image tools and native release artifacts, preserving verified executable bytes', async () => {
  for (const arch of ['x86_64', 'arm64'] as const) {
    const result = await install({ arch })
    expect(result.code, result.stderr).toBe(0)
    expect(result.requests).toHaveLength(4)
    for (const name of ['syft', 'grype']) expect(await Bun.file(join(result.temp, 'scan-image-bin', name)).text()).toContain(`${name} fixture`)
    expect(result.githubPath).toBe(true)
    for (const args of result.invocations) {
      expect(args[args.indexOf('--retry') + 1]).toBe('3')
      expect(args[args.indexOf('--retry-max-time') + 1]).toBe('120')
      expect(args[args.indexOf('--max-time') + 1]).toBe('60')
      expect(args).not.toContain('--retry-all-errors')
    }
  }
})

test('existing-SBOM mode installs only Grype and does not require a Syft version', async () => {
  const result = await install({ installSyft: false })
  expect(result.code, result.stderr).toBe(0)
  expect(result.requests).toHaveLength(2)
  expect(result.requests.every(path => path.startsWith('grype_'))).toBe(true)
  expect(await Bun.file(join(result.temp, 'scan-image-bin/syft')).exists()).toBe(false)
  const action = Bun.YAML.parse(await Bun.file(resolve(installer, '../action.yml')).text()) as { runs: { steps: Array<{ name?: string; env?: Record<string, string> }> } }
  expect(action.runs.steps.find(step => step.name === 'Install required scanners')?.env?.['INSTALL_SYFT']).toBe("${{ inputs.image != '' }}")
})

test('real curl recovers from transient HTTP errors with the bounded retry policy', async () => {
  const result = await install({ installSyft: false, transientFailures: 2 })
  expect(result.code, result.stderr).toBe(0)
  expect(result.requests.filter(path => path.endsWith('.tar.gz'))).toHaveLength(3)
  expect(result.invocations).toHaveLength(2)
}, 15_000)

test('real curl stops after four transient attempts and never retries terminal HTTP errors', async () => {
  for (const [httpStatus, attempts] of [[503, 4], [404, 1]] as const) {
    const result = await install({ installSyft: false, httpStatus })
    expect(result.code).not.toBe(0)
    expect(result.requests).toHaveLength(attempts)
    expect(result.invocations).toHaveLength(1)
    expect(result.githubPath).toBe(false)
  }
}, 15_000)

test('missing, duplicate, malformed, and mismatched checksums stop without redispatch or publishing tools', async () => {
  for (const checksum of ['missing', 'duplicate', 'malformed', 'mismatch'] as const) {
    const result = await install({ installSyft: false, checksum })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('checksum')
    expect(result.requests).toHaveLength(checksum === 'mismatch' ? 2 : 1)
    expect(result.githubPath).toBe(false)
    expect(await Bun.file(join(result.temp, 'scan-image-bin/grype')).exists()).toBe(false)
  }
})

test('checksum-valid corrupt archives and missing, empty, or linked executables fail before tool publication', async () => {
  for (const archive of ['corrupt', 'missing-binary', 'empty-binary', 'symlink'] as const) {
    const result = await install({ installSyft: false, archive })
    expect(result.code).not.toBe(0)
    expect(result.requests).toHaveLength(2)
    expect(result.githubPath).toBe(false)
    expect(await Bun.file(join(result.temp, 'scan-image-bin/grype')).exists()).toBe(false)
    if (archive === 'symlink') expect(await Bun.file(join(result.root, 'untouched')).text()).toBe('keep this file\n')
  }
})
