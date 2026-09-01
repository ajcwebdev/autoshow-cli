import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

describe('dependency hygiene contracts', () => {
  test('superseded development tools are absent from the declared graph and lockfile', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declared = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    }
    expect(declared['repomix']).toBeUndefined()
    expect(declared['tiktoken']).toBeUndefined()

    const lockfile = await readFile('bun.lock', 'utf8')
    expect(lockfile).not.toMatch(/["/]repomix(?:@|["/])/)
    expect(lockfile).not.toMatch(/["/]tiktoken(?:@|["/])/)
  })

  test('dependency review requires dry-run audit fixes, package diffs, and full lockfile review', async () => {
    const guide = await readFile('docs/commands/testing.md', 'utf8')
    expect(guide).toContain('bun pm diff <package>')
    expect(guide).toContain('Inspect the complete `bun.lock` diff')
    expect(guide).toContain('bun audit fix --dry-run')
    expect(guide).toContain('Never auto-apply audit fixes')
    expect(guide).toContain('bun prune --dry-run')
    expect(guide).toContain('Docker therefore keeps the frozen production install without an additional prune layer')
  })
})
