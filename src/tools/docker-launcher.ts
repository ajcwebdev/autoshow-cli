import { dockerClientEnvironment } from './docker-process'

const scripts: Record<string, string> = {
  baseline: 'src/tools/docker-bun-baseline.ts',
  compare: 'src/tools/bun-env-compat.ts',
  acceptance: 'test/docker-acceptance/docker-runner.ts'
}

const script = scripts[Bun.argv[2] ?? '']
if (!script) throw new Error('Expected Docker launcher: baseline, compare, or acceptance')
const child = Bun.spawn([process.execPath, '--no-env-file', script, ...Bun.argv.slice(3)], {
  env: dockerClientEnvironment(process.env),
  stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'
})
const interrupt = () => child.kill('SIGTERM')
process.once('SIGINT', interrupt)
process.once('SIGTERM', interrupt)
try { process.exitCode = await child.exited } finally {
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', interrupt)
}
