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
    expect(manifest.devDependencies?.['@typescript/native-preview']).toBe('7.0.0-dev.20260707.2')
    expect(lockfile.lockfileVersion).toBe(2)
    expect(lockfile.workspaces?.['']?.devDependencies?.['@types/bun']).toBe(SUPPORTED_BUN_VERSION)
    expect(Object.keys(lockfile.packages ?? {})).toContain('@types/bun')
    expect(Object.keys(lockfile.packages ?? {})).toContain('bun-types')
    expect((lockfile.packages?.['@types/bun'] as unknown[] | undefined)?.[0]).toBe(`@types/bun@${SUPPORTED_BUN_VERSION}`)
    expect((lockfile.packages?.['bun-types'] as unknown[] | undefined)?.[0]).toBe(`bun-types@${SUPPORTED_BUN_VERSION}`)
    expect(dockerfile).toContain(`oven/bun:${SUPPORTED_BUN_VERSION}-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61`)

    const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/docker-publish.yml').text()) as {
      jobs?: Record<string, { steps?: Array<{ uses?: string, run?: string, with?: Record<string, unknown> }> }>
    }
    const setupSteps = Object.entries(workflow.jobs ?? {}).flatMap(([job, config]) =>
      (config.steps ?? []).filter(step => step.uses?.startsWith('oven-sh/setup-bun@')).map(step => ({ job, step })))
    expect(setupSteps.map(({ job }) => job).sort()).toEqual([
      'acceptance', 'package-hygiene', 'promote-latest', 'publish-manifest', 'verify',
    ])
    for (const { step } of setupSteps) expect(step.with?.['bun-version']).toBe(SUPPORTED_BUN_VERSION)

    const runtimePins = Object.entries(workflow.jobs ?? {}).flatMap(([job, config]) =>
      (config.steps ?? []).flatMap(step =>
        [...(step.run ?? '').matchAll(/--version\)" = "([^"]+)"/g)].map(([, version]) => ({ job, version }))))
    expect(runtimePins).toEqual([{ job: 'verify', version: SUPPORTED_BUN_VERSION }])
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
