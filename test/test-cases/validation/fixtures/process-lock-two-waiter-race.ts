import { mock } from 'bun:test'
import * as fsPromises from 'node:fs/promises'
import { hostname } from 'node:os'
import { join } from 'node:path'

const lockRoot = process.env['LOCK_ROOT']
if (!lockRoot) {
  throw new Error('missing LOCK_ROOT')
}

const lockName = 'dead-owner-race'
const lockDir = join(lockRoot, lockName)
const actualRename = fsPromises.rename
const actualRm = fsPromises.rm

await fsPromises.mkdir(lockDir, { recursive: true })
await fsPromises.writeFile(join(lockDir, 'owner.json'), JSON.stringify({
  ownerId: 'dead-owner',
  lockName,
  pid: 99_999_999,
  hostname: hostname(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}, null, 2))

const createDeferred = (): {
  promise: Promise<void>
  resolve: () => void
} => {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: () => resolvePromise?.()
  }
}

const staleMutationObserved = createDeferred()
const continueStaleMutation = createDeferred()
let delayedFirstStaleMutation = false

const delayFirstStaleMutation = async (): Promise<void> => {
  if (delayedFirstStaleMutation) {
    return
  }
  delayedFirstStaleMutation = true
  staleMutationObserved.resolve()
  await continueStaleMutation.promise
}

mock.module('node:fs/promises', () => ({
  ...fsPromises,
  rename: async (...args: Parameters<typeof actualRename>): Promise<void> => {
    const [from, to] = args
    if (from === lockDir && typeof to === 'string' && to.startsWith(`${lockDir}.reap-`)) {
      await delayFirstStaleMutation()
    }
    await actualRename(...args)
  },
  rm: async (...args: Parameters<typeof actualRm>): Promise<void> => {
    const [path] = args
    if (path === lockDir) {
      await delayFirstStaleMutation()
    }
    await actualRm(...args)
  }
}))

const { reconfigureLogger } = await import('~/utils/app-logger/app-logger')
const { withProcessLock } = await import('~/utils/process-lock')
reconfigureLogger({ quiet: true })

const holderEntered = createDeferred()
const releaseHolder = createDeferred()
const delayedEntered = createDeferred()
const events: string[] = []
const options = { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 1_000 }

const delayedWaiter = withProcessLock(lockName, async () => {
  events.push('delayed-enter')
  delayedEntered.resolve()
}, options)

await staleMutationObserved.promise

const holder = withProcessLock(lockName, async () => {
  events.push('holder-enter')
  holderEntered.resolve()
  await releaseHolder.promise
  events.push('holder-exit')
}, options)

await holderEntered.promise
continueStaleMutation.resolve()

const overlapped = await Promise.race([
  delayedEntered.promise.then(() => true),
  Bun.sleep(50).then(() => false)
])

releaseHolder.resolve()
await Promise.all([delayedWaiter, holder])

if (overlapped) {
  throw new Error(`dead-owner waiters overlapped: ${JSON.stringify(events)}`)
}

const expectedEvents = ['holder-enter', 'holder-exit', 'delayed-enter']
if (JSON.stringify(events) !== JSON.stringify(expectedEvents)) {
  throw new Error(`unexpected event order: ${JSON.stringify(events)}`)
}

console.log(JSON.stringify(events))
