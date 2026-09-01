import { describe, expect, test } from 'bun:test'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'

type PackageManifest = {
  packageManager?: string
  devDependencies?: Record<string, string>
}

type BunLockfile = {
  lockfileVersion?: number
  packages?: Record<string, unknown>
  workspaces?: Record<string, { devDependencies?: Record<string, string> }>
}

describe('Bun version alignment contracts', () => {
  test('runtime, package metadata, types, lockfile, and Docker use the same exact Bun release', async () => {
    const manifest = await Bun.file('package.json').json() as PackageManifest
    const lockfile = Bun.JSONC.parse(await Bun.file('bun.lock').text()) as BunLockfile
    const dockerfile = await Bun.file('Dockerfile').text()

    expect(Bun.version).toBe(SUPPORTED_BUN_VERSION)
    expect(manifest.packageManager).toBe(`bun@${SUPPORTED_BUN_VERSION}`)
    expect(manifest.devDependencies?.['@types/bun']).toBe(SUPPORTED_BUN_VERSION)
    expect(manifest.devDependencies?.['typescript']).toBe('6.0.3')
    expect(lockfile.lockfileVersion).toBe(2)
    expect(lockfile.workspaces?.['']?.devDependencies?.['@types/bun']).toBe(SUPPORTED_BUN_VERSION)
    expect(Object.keys(lockfile.packages ?? {})).toContain('@types/bun')
    expect(Object.keys(lockfile.packages ?? {})).toContain('bun-types')
    expect((lockfile.packages?.['@types/bun'] as unknown[] | undefined)?.[0]).toBe(`@types/bun@${SUPPORTED_BUN_VERSION}`)
    expect((lockfile.packages?.['bun-types'] as unknown[] | undefined)?.[0]).toBe(`bun-types@${SUPPORTED_BUN_VERSION}`)
    expect(dockerfile).toContain(`oven/bun:${SUPPORTED_BUN_VERSION}-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6`)
  })

  test('exact-version, age-gate, and isolated-linker install policies remain enabled', async () => {
    const bunfig = Bun.TOML.parse(await Bun.file('bunfig.toml').text()) as {
      install?: { exact?: boolean, linker?: string, minimumReleaseAge?: number }
    }

    expect(bunfig.install).toMatchObject({
      exact: true,
      linker: 'isolated',
      minimumReleaseAge: 43_200
    })
  })
})
