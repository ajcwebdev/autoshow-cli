import { UsageError } from '~/utils/error-handler'
import { dockerClientEnvironment } from './docker-process'

if (Bun.argv[2] !== 'acceptance') throw UsageError('Expected Docker launcher: acceptance')
const child = Bun.spawn([process.execPath, '--no-env-file', 'test/docker-acceptance/docker-runner.ts', ...Bun.argv.slice(3)], {
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
