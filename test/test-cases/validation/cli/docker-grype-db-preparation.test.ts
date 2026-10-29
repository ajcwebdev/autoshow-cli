import { afterAll, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const script = resolve(import.meta.dir, '../../../../.github/actions/prepare-grype-db/prepare-grype-db.sh')
const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
type Mode = 'valid' | 'stale' | 'corrupt' | 'bad-json' | 'wrong-schema' | 'missing-built' | 'missing-file' | 'small-file' | 'update-failure'

async function prepare(update: string, mode: Mode = 'valid') {
  const root = await mkdtemp(join(tmpdir(), 'docker-grype-db-'))
  roots.push(root)
  const bin = join(root, 'bin'), database = join(root, 'database'), evidence = join(root, 'evidence'), log = join(root, 'calls.jsonl')
  await Promise.all([mkdir(bin), mkdir(join(database, '6'), { recursive: true }), mkdir(evidence)])
  if (mode !== 'missing-file') await Bun.write(join(database, '6/vulnerability.db'), new Uint8Array(mode === 'small-file' ? 1 : 1_048_577))
  const fixture = join(root, 'grype-fixture.ts')
  await Bun.write(fixture, `import { appendFile } from 'node:fs/promises';
const args=process.argv.slice(2), mode=process.env['FIXTURE_MODE'];
await appendFile(process.env['FIXTURE_LOG'],JSON.stringify({args,autoUpdate:process.env['GRYPE_DB_AUTO_UPDATE'],validateAge:process.env['GRYPE_DB_VALIDATE_AGE'],validateHash:process.env['GRYPE_DB_VALIDATE_BY_HASH_ON_START'],maxAge:process.env['GRYPE_DB_MAX_ALLOWED_BUILT_AGE'],goDebug:process.env['GODEBUG']})+'\\n');
if(args.join(' ')==='db update'){process.exit(mode==='update-failure'?1:0);}
if(args.join(' ')!=='db status -o json')throw new Error('Unexpected Grype command');
if(mode==='bad-json'){console.log('{bad');process.exit(0);}
const invalid=mode==='stale'||mode==='corrupt';
console.log(JSON.stringify({schemaVersion:mode==='wrong-schema'?'v5.0.0':'v6.1.10',built:mode==='missing-built'?'':new Date().toISOString(),path:process.env['GRYPE_DB_CACHE_DIR']+'/6/vulnerability.db',valid:!invalid,...(invalid?{error:mode==='stale'?'database is too old':'database checksum mismatch'}:{})}));
process.exit(invalid?1:0);
`)
  await Bun.write(join(bin, 'grype'), '#!/bin/sh\nexec "$FIXTURE_BUN" "$FIXTURE_SCRIPT" "$@"\n')
  await chmod(join(bin, 'grype'), 0o755)
  await Bun.write(join(evidence, 'unrelated-sentinel'), 'keep\n')
  const child = Bun.spawn(['bash', script], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: {
    PATH: `${bin}:${process.env['PATH'] ?? ''}`, FIXTURE_BUN: process.execPath, FIXTURE_SCRIPT: fixture, FIXTURE_LOG: log, FIXTURE_MODE: mode,
    GRYPE_DB_CACHE_DIR: database, EVIDENCE_DIR: evidence, GITHUB_OUTPUT: join(root, 'github-output'), DB_UPDATE_REQUIRED: update,
    // A runner-level override must not disable the shared action's validation contract.
    GRYPE_DB_VALIDATE_AGE: 'false', GRYPE_DB_MAX_ALLOWED_BUILT_AGE: '9999h', GRYPE_DB_VALIDATE_BY_HASH_ON_START: 'false', GODEBUG: 'http2client=1,http2server=1'
  } })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text(), new Response(child.stdout).text()])
  const calls = await Bun.file(log).exists() ? (await Bun.file(log).text()).trim().split('\n').map(line => JSON.parse(line) as {
    args: string[], autoUpdate?: string, validateAge: string, validateHash: string, maxAge: string, goDebug: string
  }) : []
  expect((await readdir(evidence)).filter(name => name.startsWith('.grype-db-status-'))).toEqual([])
  expect(await Bun.file(join(evidence, 'unrelated-sentinel')).text()).toBe('keep\n')
  return { code, stderr, calls, status: Bun.file(join(evidence, 'grype-db-status.json')), output: Bun.file(join(root, 'github-output')) }
}

test('database cache misses update once and validate native status before publishing evidence', async () => {
  const result = await prepare('true')
  expect(result.code, result.stderr).toBe(0)
  expect(result.calls.map(call => call.args)).toEqual([['db', 'update'], ['db', 'status', '-o', 'json']])
  for (const call of result.calls) {
    expect(call.validateAge).toBe('true')
    expect(call.validateHash).toBe('true')
    expect(call.maxAge).toBe('120h')
    expect(call.goDebug).toBe('http2client=0,http2server=0')
  }
  expect(result.calls[1]?.autoUpdate).toBe('false')
  expect((await result.status.json()).valid).toBe(true)
  expect(await result.output.text()).toMatch(/^db-built=.+\n$/)
})

test('exact daily cache hits still validate age and checksum without performing a hidden update', async () => {
  const result = await prepare('false')
  expect(result.code, result.stderr).toBe(0)
  expect(result.calls.map(call => call.args)).toEqual([['db', 'status', '-o', 'json']])
  expect(result.calls[0]?.autoUpdate).toBe('false')
  expect(result.calls[0]?.goDebug).toBe('http2client=0,http2server=0')
})

for (const mode of ['stale', 'corrupt', 'bad-json', 'wrong-schema', 'missing-built', 'missing-file', 'small-file'] as const) {
  test(`invalid database evidence (${mode}) cannot publish status or cache-success output`, async () => {
    const result = await prepare('false', mode)
    expect(result.code).not.toBe(0)
    expect(result.status.size).toBe(0)
    expect(await result.status.exists()).toBe(false)
    expect(await result.output.exists()).toBe(false)
    expect(result.calls.map(call => call.args)).toEqual([['db', 'status', '-o', 'json']])
  })
}

test('failed database updates stop before status publication and malformed update controls stop before Grype', async () => {
  const failed = await prepare('true', 'update-failure')
  expect(failed.code).not.toBe(0)
  expect(failed.calls.map(call => call.args)).toEqual([['db', 'update']])
  expect(await failed.status.exists()).toBe(false)
  const invalid = await prepare('yes')
  expect(invalid.code).not.toBe(0)
  expect(invalid.calls).toEqual([])
})
