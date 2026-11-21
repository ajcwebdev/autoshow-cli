import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { SOURCE_ROOT } from '~/utils/project-root'

test('offline warm acceptance proves parent and both child network guards or fails closed without an OS sandbox', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', join(SOURCE_ROOT, 'test/setup-acceptance/managed-offline-setup.ts'), '--self-test'], {
    cwd: SOURCE_ROOT,
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' },
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(stdout).toBe('')
  if (process.platform !== 'darwin') {
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('requires macOS sandbox-exec')
  } else {
    expect(exitCode, stderr).toBe(0)
    expect(JSON.parse(stderr)).toEqual({
      type: 'managed-offline-setup-acceptance', mode: 'controls', parentControlDenials: 3,
      asyncChildControlDenied: true, syncChildControlDenied: true,
      setupNetworkAttempts: 0, rejectedSubprocesses: 0, setupSandboxedChildren: 0, calibreSandboxedChildren: 0, calibreWrapperChildren: 0
    })
  }
})
