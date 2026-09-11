import { mock } from 'bun:test'
import * as fileIO from '~/utils/bun-file-io'
import { join } from 'node:path'

const lockRoot = process.env['LOCK_ROOT']
if (!lockRoot) {
  throw new Error('missing LOCK_ROOT')
}

const lockName = 'heartbeat-release'
const ownerTempPrefix = `${join(lockRoot, lockName, 'owner.json')}.`
const actualWriteFile = fileIO.writeFileExact
let ownerTempWriteCount = 0
let resolveHeartbeatStarted: (() => void) | undefined
const heartbeatStarted = new Promise<void>((resolve) => {
  resolveHeartbeatStarted = resolve
})

mock.module('~/utils/bun-file-io', () => ({
  ...fileIO,
  writeFileExact: async (...args: Parameters<typeof actualWriteFile>): Promise<void> => {
    const [path] = args
    if (typeof path === 'string' && path.startsWith(ownerTempPrefix) && path.endsWith('.tmp')) {
      ownerTempWriteCount += 1
      if (ownerTempWriteCount === 2) {
        resolveHeartbeatStarted?.()
        await Bun.sleep(25)
      }
    }
    await actualWriteFile(...args)
  }
}))

const { withProcessLock } = await import('~/utils/process-lock')

await withProcessLock(lockName, async () => {
  await heartbeatStarted
}, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 1_000 })

await Bun.sleep(40)
console.log('released')
