/** Targeted native Docker state/restriction checks. No providers, downloads or full acceptance suite. */
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DockerEngine } from './docker-engine'
import { acquireAcceptanceCacheLease, releaseAcceptanceCacheLease } from './docker-cache-lease'
import { parseDockerOptions } from './docker-options'
import { discoverOutputDir } from './docker-runner'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const jsonLine = (stdout: string): Record<string, unknown> => {
  const lines = stdout.trim().split('\n')
  return JSON.parse(lines.at(-1)!) as Record<string, unknown>
}

export async function runDockerRuntimeStateAcceptance(image: string, output: string) {
  await mkdir(resolve(output, '..'), { recursive: true })
  await mkdir(output)
  const hostUid = process.getuid?.(), hostGid = process.getgid?.()
  assert(hostUid !== undefined && hostUid > 0 && hostGid !== undefined, 'The state gate requires a non-root numeric host identity')
  const users = [{ name: 'image', user: undefined }, { name: 'host', user: `${hostUid}:${hostGid}` }]
  const results: Array<Record<string, unknown>> = []
  const errors: string[] = []
  let immutableImage: string | undefined
  for (const selected of users) {
    const options = parseDockerOptions(['--image', immutableImage ?? image, '--pull', 'never', '--restricted',
      '--output', join(output, selected.name), '--cache', join(output, 'authored-cache', selected.name),
      ...(selected.user ? ['--user', selected.user] : [])])
    await mkdir(options.output)
    const engine = new DockerEngine(options)
    let lease: Awaited<ReturnType<typeof acquireAcceptanceCacheLease>> | undefined
    const checks: string[] = []
    let identity: Awaited<ReturnType<typeof engine.resolveImage>> | undefined
    try {
      identity = await engine.resolveImage()
      immutableImage ??= identity.reference
      assert(identity.reference === immutableImage, 'Runtime identities must inspect the same immutable image')
      lease = await acquireAcceptanceCacheLease(join(options.cache, identity.platform.replace('/', '-')),
        { runId: engine.runId, pid: process.pid, output: options.output, startedAt: new Date().toISOString() })
      await engine.prepareMounts()
      await engine.verifyStateAccess()
      await Bun.write(join(options.output, 'fixtures', 'empty-config.json'), '{}\n')
      const run = async (script: string) => engine.requireSuccess(await engine.container(['--no-env-file', '-e', script], 'none', 30_000, 'bun'), 'Runtime state probe')
      const nonce = `authored-${crypto.randomUUID()}`
      const initialized = jsonLine((await run(`import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {writeConfig}=await import('/app/src/cli/commands/setup-and-utilities/config-command/config-writer.ts');
const {loadConfig}=await import('/app/src/cli/commands/setup-and-utilities/config-command/config-loader.ts');
const nonce=${JSON.stringify(nonce)};
const status=await readFile('/proc/self/status','utf8');
if(!/^CapEff:\\s+0+$/m.test(status)||!/^NoNewPrivs:\\s+1$/m.test(status))throw new Error('Runtime restrictions are not effective');
if(!process.getuid())throw new Error('Runtime user is root');
if(Object.keys(await loadConfig('/app/config/autoshow.json')).length)throw new Error('Fresh state was not empty');
await writeConfig('/app/config/autoshow.json',{pricing:{maxCents:25}});
await mkdir('/app/runtime/authored-state',{recursive:true});await mkdir('/home/bun/.cache/authored-state',{recursive:true});
await writeFile('/app/runtime/authored-state/sentinel',nonce);await writeFile('/home/bun/.cache/authored-state/sentinel',nonce);
console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),capabilitiesDropped:true,noNewPrivileges:true}));`)).stdout)
      checks.push('fresh non-root state, config write and effective kernel restrictions')
      for (const suffix of ['reuse-one', 'reuse-two']) await run(`import {readFile,writeFile} from 'node:fs/promises';
const {loadConfig}=await import('/app/src/cli/commands/setup-and-utilities/config-command/config-loader.ts');
if((await loadConfig('/app/config/autoshow.json')).pricing?.maxCents!==25)throw new Error('Configuration did not persist');
for(const root of ['/app/runtime/authored-state','/home/bun/.cache/authored-state']){
 if(await readFile(root+'/sentinel','utf8')!==${JSON.stringify(nonce)})throw new Error('Cached asset changed');
 await writeFile(root+${JSON.stringify(`/${suffix}`)},'retained');
}console.log(JSON.stringify({reused:true}));`)
      checks.push('configuration and authored asset caches survive disposable containers')
      const runtimeMount = engine.mounts.find(mount => mount.container === '/app/runtime')!
      runtimeMount.readonly = true
      let unwritableStateRejected = false
      try { await engine.verifyStateAccess() }
      catch (error) { unwritableStateRejected = String(error).includes('acceptance never repairs existing ownership or modes') }
      finally { runtimeMount.readonly = false }
      assert(unwritableStateRejected, 'Read-only restored state was not rejected before CLI execution')
      checks.push('unwritable restored state rejected without ownership or permission repair')
      let contended = false
      try { await acquireAcceptanceCacheLease(join(options.cache, identity.platform.replace('/', '-')),
        { runId: 'another-run', pid: process.pid, output: options.output, startedAt: new Date().toISOString() }) }
      catch (error) { contended = String(error).includes('Cache already in use') }
      assert(contended, 'Concurrent cache owner was not rejected')
      checks.push('concurrent acceptance owner rejected without changing cached state')
      await run(`import {writeFile} from 'node:fs/promises';
for(const directory of ['/fixtures','/app/src']){let denied=false;try{await writeFile(directory+'/.${nonce}','not allowed')}catch(error){denied=['EACCES','EROFS'].includes(error.code)}if(!denied)throw new Error('Protected path was writable: '+directory)}
console.log(JSON.stringify({protectedWritesRejected:true}));`)
      checks.push('read-only input and immutable source writes rejected')
      engine.requireSuccess(await engine.container(['-size', '800x120', 'canvas:white', '-font', 'DejaVu-Sans', '-pointsize', '36',
        '-fill', 'black', '-annotate', '+20+75', 'State cache persists.', '/fixtures/state.png'], 'none', 30_000, 'convert', true), 'Render authored OCR fixture')
      const decoded = engine.requireSuccess(await engine.container(['-format', '%w %h', '/fixtures/state.png'], 'none', 30_000, 'identify'), 'Decode authored PNG')
      assert(decoded.stdout.trim() === '800 120', 'Authored PNG dimensions differ')
      const args = ['extract', '/fixtures/state.png', '--provider', 'tesseract', '--json']
      engine.authorize(args, 'none')
      engine.requireSuccess(await engine.cli(args, 'local-ocr', 'none', 60_000), 'Restricted local Tesseract extraction')
      const extracted = await discoverOutputDir(join(options.output, 'outputs', 'local-ocr'))
      assert(extracted, 'OCR did not produce a manifest directory')
      const text = await readFile(join(extracted, 'extraction.txt'), 'utf8')
      assert(text.toLowerCase().includes('state cache persists'), 'Authored OCR sentence was not recognized')
      checks.push('decoded PNG integrity and expected local OCR text under restricted runtime')
      await Bun.write(join(options.output, 'fixtures', 'invalid.png'), 'authored invalid PNG')
      const invalidArgs = ['extract', '/fixtures/invalid.png', '--provider', 'tesseract', '--json']
      engine.authorize(invalidArgs, 'none')
      const invalid = await engine.cli(invalidArgs, 'invalid-image', 'none', 30_000)
      assert(invalid.exitCode !== 0 && !invalid.timedOut, 'Invalid PNG did not fail cleanly')
      checks.push('invalid image fails without changing cached state')
      const timeout = await engine.container(['--no-env-file', '-e', 'await Bun.sleep(60000)'], 'none', 1000, 'bun')
      assert(timeout.timedOut && engine.owned.size === 0, 'Timed-out container was not removed by its owner')
      checks.push('deadline removes only the owned container and retains state')
      await run(`import {readFile} from 'node:fs/promises';
for(const root of ['/app/runtime/authored-state','/home/bun/.cache/authored-state'])if(await readFile(root+'/sentinel','utf8')!==${JSON.stringify(nonce)})throw new Error('State was lost after failure/timeout');
console.log(JSON.stringify({cachedStatePreserved:true}));`)
      checks.push('authored protected assets remain intact after invalid input and timeout')
      results.push({ userMode: selected.name, ...initialized, image: identity,
        checks, status: 'passed', semantics: 'Local runtime and recognition checks on an authored sentence; not current-source release proof or general OCR quality.' })
    } catch (error) {
      errors.push(`${selected.name}: ${String(error)}`)
      results.push({ userMode: selected.name, status: 'failed', image: identity, checks, error: String(error) })
    } finally {
      try { await engine.cleanup() } catch (error) { errors.push(`cleanup: ${String(error)}`) }
      if (lease && engine.owned.size === 0) {
        try { await releaseAcceptanceCacheLease(lease) } catch (error) { errors.push(`cache lease: ${String(error)}`) }
      }
    }
  }
  const report = { schemaVersion: 1, kind: 'docker-native-runtime-state-acceptance', checkedAt: new Date().toISOString(),
    passed: results.length === users.length && errors.length === 0 && results.every(row => row['status'] === 'passed'),
    platformScope: 'Docker daemon native architecture only; Docker Desktop bind mounts do not establish Linux-host ownership parity.',
    paidProviderCalls: 0, downloads: 0, existingCachesMounted: false, results, errors }
  writePortableFileSync(join(output, 'runtime-state.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--image' || args[2] !== '--output') throw new Error('Usage: bun test/docker-acceptance/docker-runtime-state-acceptance.ts --image LOCAL_IMAGE --output NEW_EVIDENCE_DIRECTORY')
  const report = await runDockerRuntimeStateAcceptance(args[1]!, resolve(args[3]!))
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.passed ? 0 : 1
}
