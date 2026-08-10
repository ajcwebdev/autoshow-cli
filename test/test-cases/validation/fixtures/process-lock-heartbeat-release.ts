import { mock } from 'bun:test'
import * as fsPromises from 'node:fs/promises'
import { join } from 'node:path'

const lockRoot = process.env['LOCK_ROOT']
if (!lockRoot) {
  throw new Error('missing LOCK_ROOT')
}

const lockName = 'heartbeat-release'
const ownerTempPrefix = `${join(lockRoot, lockName, 'owner.json')}.`
const actualWriteFile = fsPromises.writeFile
let ownerTempWriteCount = 0
let resolveHeartbeatStarted: (() => void) | undefined
const heartbeatStarted = new Promise<void>((resolve) => {
  resolveHeartbeatStarted = resolve
})

mock.module('node:fs/promises', () => ({
  ...fsPromises,
  writeFile: async (...args: Parameters<typeof actualWriteFile>): Promise<void> => {
    const [path] = args
    if (typeof path === 'string' && path.startsWith(ownerTempPrefix) && path.endsWith('.tmp')) {
      ownerTempWriteCount += 1
      if (ownerTempWriteCount === 2) {
        resolveHeartbeatStarted?.()
        await Bun.sleep(50)
      }
    }
    await actualWriteFile(...args)
  }
}))

const { withProcessLock } = await import('~/utils/process-lock')

await withProcessLock(lockName, async () => {
  await heartbeatStarted
}, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 1_000 })

await Bun.sleep(80)
console.log('released')
