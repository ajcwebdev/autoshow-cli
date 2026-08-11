import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { withProcessLock } from '~/utils/process-lock'

const tempDirs: string[] = []
const heartbeatReleaseFixturePath = new URL('../fixtures/process-lock-heartbeat-release.ts', import.meta.url).pathname
const twoWaiterRaceFixturePath = new URL('../fixtures/process-lock-two-waiter-race.ts', import.meta.url).pathname

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

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
    resolve: () => {
      resolvePromise?.()
    }
  }
}

const makeTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-process-lock-'))
  tempDirs.push(root)
  return root
}

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | number | undefined | null
): Promise<string> =>
  stream && typeof stream !== 'number' ? await new Response(stream).text() : ''

const childEnvWithLockRoot = (lockRoot: string): Record<string, string> => {
  const env = Object.entries(process.env).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value
    }
    return acc
  }, {})
  env['LOCK_ROOT'] = lockRoot
  return env
}

const spawnLockChild = (
  label: string,
  holdMs: number,
  lockRoot: string,
  options: {
    blockHeartbeat?: boolean
    staleMs?: number
  } = {}
): ReturnType<typeof Bun.spawn> => {
  const hold = options.blockHeartbeat
    ? `Bun.sleepSync(${holdMs})`
    : `await Bun.sleep(${holdMs})`
  const staleMs = options.staleMs ?? 1000
  const code = `
    import { withProcessLock } from './src/utils/process-lock.ts'
    const lockRoot = process.env.LOCK_ROOT
    if (!lockRoot) throw new Error('missing LOCK_ROOT')
    await withProcessLock('cross-process-lock', async () => {
      console.log('${label}:enter:' + Date.now())
      ${hold}
      console.log('${label}:exit:' + Date.now())
    }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: ${staleMs} })
  `

  return Bun.spawn([process.execPath, '--eval', code], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: childEnvWithLockRoot(lockRoot)
  })
}

const collectChild = async (
  proc: ReturnType<typeof Bun.spawn>
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited
  ])

  return { stdout, stderr, exitCode }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('process lock serializes concurrent contenders', async () => {
  const lockRoot = await makeTempRoot()
  const firstEntered = createDeferred()
  const releaseFirst = createDeferred()
  const events: string[] = []

  const first = withProcessLock('serial-lock', async () => {
    events.push('first-enter')
    firstEntered.resolve()
    await releaseFirst.promise
    events.push('first-exit')
  }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 1000 })

  await firstEntered.promise

  const second = withProcessLock('serial-lock', async () => {
    events.push('second-enter')
  }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 1000 })

  await Bun.sleep(30)
  expect(events).toEqual(['first-enter'])

  releaseFirst.resolve()
  await Promise.all([first, second])

  expect(events).toEqual(['first-enter', 'first-exit', 'second-enter'])
})

test('process lock serializes separate processes', async () => {
  const lockRoot = await makeTempRoot()
  const first = spawnLockChild('first', 120, lockRoot)
  const lockOwnerPath = join(lockRoot, 'cross-process-lock', 'owner.json')

  for (let attempt = 0; attempt < 400 && !await exists(lockOwnerPath); attempt += 1) {
    await Bun.sleep(5)
  }
  expect(await exists(lockOwnerPath)).toBe(true)

  const second = spawnLockChild('second', 0, lockRoot)
  const [firstResult, secondResult] = await Promise.all([
    collectChild(first),
    collectChild(second)
  ])

  expect(firstResult.exitCode).toBe(0)
  expect(secondResult.exitCode).toBe(0)
  expect(firstResult.stderr).toBe('')
  expect(secondResult.stderr).toBe('')

  const lines = `${firstResult.stdout}\n${secondResult.stdout}`.trim().split('\n')
  const firstExit = Number(lines.find((line) => line.startsWith('first:exit:'))?.split(':')[2] ?? '0')
  const secondEnter = Number(lines.find((line) => line.startsWith('second:enter:'))?.split(':')[2] ?? '0')

  expect(firstExit).toBeGreaterThan(0)
  expect(secondEnter).toBeGreaterThanOrEqual(firstExit)
})

test('process lock keeps a live same-host owner when its heartbeat is late', async () => {
  const lockRoot = await makeTempRoot()
  const options = { blockHeartbeat: true, staleMs: 50 }
  const first = spawnLockChild('first', 300, lockRoot, options)
  const lockOwnerPath = join(lockRoot, 'cross-process-lock', 'owner.json')

  for (let attempt = 0; attempt < 400 && !await exists(lockOwnerPath); attempt += 1) {
    await Bun.sleep(5)
  }
  expect(await exists(lockOwnerPath)).toBe(true)

  const second = spawnLockChild('second', 0, lockRoot, options)
  const [firstResult, secondResult] = await Promise.all([
    collectChild(first),
    collectChild(second)
  ])

  expect(firstResult.exitCode).toBe(0)
  expect(secondResult.exitCode).toBe(0)
  expect(firstResult.stderr).toBe('')
  expect(secondResult.stderr).toBe('')

  const lines = `${firstResult.stdout}\n${secondResult.stdout}`.trim().split('\n')
  const firstExit = Number(lines.find((line) => line.startsWith('first:exit:'))?.split(':')[2] ?? '0')
  const secondEnter = Number(lines.find((line) => line.startsWith('second:enter:'))?.split(':')[2] ?? '0')

  expect(firstExit).toBeGreaterThan(0)
  expect(secondEnter).toBeGreaterThanOrEqual(firstExit)
})

test('process lock finishes an in-flight heartbeat before release', async () => {
  const lockRoot = await makeTempRoot()
  const child = Bun.spawn([process.execPath, heartbeatReleaseFixturePath], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: childEnvWithLockRoot(lockRoot)
  })

  const result = await collectChild(child)
  expect(result).toEqual({
    stdout: 'released\n',
    stderr: '',
    exitCode: 0
  })
  expect(await readdir(lockRoot)).toEqual([])
})

test('process lock serializes two waiters that race to reap a dead owner', async () => {
  const lockRoot = await makeTempRoot()
  const child = Bun.spawn([process.execPath, twoWaiterRaceFixturePath], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: childEnvWithLockRoot(lockRoot)
  })

  const result = await collectChild(child)
  expect(result).toEqual({
    stdout: '["holder-enter","holder-exit","delayed-enter"]\n',
    stderr: '',
    exitCode: 0
  })
  expect(await readdir(lockRoot)).toEqual([])
})

test('process lock releases after success and failure', async () => {
  const lockRoot = await makeTempRoot()

  await expect(withProcessLock('release-success', async () => 'ok', {
    lockRoot,
    waitMs: 5,
    heartbeatMs: 10,
    staleMs: 1000
  })).resolves.toBe('ok')

  expect(await readdir(lockRoot)).toEqual([])

  await expect(withProcessLock('release-failure', async () => {
    throw new Error('expected failure')
  }, {
    lockRoot,
    waitMs: 5,
    heartbeatMs: 10,
    staleMs: 1000
  })).rejects.toThrow('expected failure')

  expect(await readdir(lockRoot)).toEqual([])

  await expect(withProcessLock('release-failure', async () => 'reacquired', {
    lockRoot,
    waitMs: 5,
    heartbeatMs: 10,
    staleMs: 1000
  })).resolves.toBe('reacquired')
})

test('process lock recovers stale and dead-owner locks', async () => {
  const lockRoot = await makeTempRoot()
  const staleLockDir = join(lockRoot, 'stale-lock')
  const deadOwnerLockDir = join(lockRoot, 'dead-owner-lock')
  const corruptOwnerLockDir = join(lockRoot, 'corrupt-owner-lock')
  await mkdir(staleLockDir, { recursive: true })
  await mkdir(deadOwnerLockDir, { recursive: true })
  await mkdir(corruptOwnerLockDir, { recursive: true })

  const staleTime = new Date(Date.now() - 60_000)
  await utimes(staleLockDir, staleTime, staleTime)

  await writeFile(join(deadOwnerLockDir, 'owner.json'), JSON.stringify({
    ownerId: 'dead-owner',
    lockName: 'dead-owner-lock',
    pid: 99999999,
    hostname: hostname(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, null, 2))
  await writeFile(join(corruptOwnerLockDir, 'owner.json'), '{not-json')
  await utimes(corruptOwnerLockDir, staleTime, staleTime)

  await withProcessLock('stale-lock', async () => {
    expect(await exists(join(staleLockDir, 'owner.json'))).toBe(true)
  }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 100 })

  await withProcessLock('dead-owner-lock', async () => {
    expect(await exists(join(deadOwnerLockDir, 'owner.json'))).toBe(true)
  }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 60_000 })

  await withProcessLock('corrupt-owner-lock', async () => {
    expect(await exists(join(corruptOwnerLockDir, 'owner.json'))).toBe(true)
  }, { lockRoot, waitMs: 5, heartbeatMs: 10, staleMs: 100 })

  expect(await exists(staleLockDir)).toBe(false)
  expect(await exists(deadOwnerLockDir)).toBe(false)
  expect(await exists(corruptOwnerLockDir)).toBe(false)
})
