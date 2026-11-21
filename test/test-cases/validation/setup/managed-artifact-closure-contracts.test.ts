import { describe, expect, test } from 'bun:test'
import { chmod, mkdir, symlink } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import {
  assertManagedDynamicLibraryClosure,
  MANAGED_SIGNED_CALIBRE_INERT_RPATHS,
  MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS,
  MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS,
  canonicalManagedCalibreInertRunpath,
  collectManagedSourcePayload,
  createManagedSourceArtifactManifest,
  managedArtifactManifestPath,
  validateManagedSourceArtifact
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'

const temporary = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'managed-native-closure-' })
const recipe = { binaryRelativePath: 'lib/libfixture.1.dylib', sourceNames: ['fixture'], buildFlags: ['--enable-runtime-fonts'], requiredPaths: ['share/fonts/example.ttf'] }
const sources = [{ name: 'fixture', version: '1.2.3', url: 'https://example.invalid/fixture-1.2.3.tar.gz', sha256: 'a'.repeat(64) }]
const dependencies = [{ name: 'codec', version: '2.0', manifestSha256: 'b'.repeat(64) }]

const writeLibraryArtifact = async () => {
  const toolDir = await temporary.make()
  await mkdir(join(toolDir, 'lib'), { recursive: true })
  await mkdir(join(toolDir, 'share/fonts'), { recursive: true })
  await Bun.write(join(toolDir, recipe.binaryRelativePath), 'synthetic library bytes')
  await Bun.write(join(toolDir, 'share/fonts/example.ttf'), 'synthetic font bytes')
  await chmod(join(toolDir, recipe.binaryRelativePath), 0o755)
  await symlink('libfixture.1.dylib', join(toolDir, 'lib/libfixture.dylib'))
  const manifest = await createManagedSourceArtifactManifest({ tool: 'fixture-library', toolDir, deploymentTarget: '15.0', platform: 'darwin', architecture: 'arm64', recipe, version: '1.2.3', sources, dependencies, recipeRevision: 'r2' })
  await Bun.write(managedArtifactManifestPath(toolDir), JSON.stringify(manifest))
  const validate = () => validateManagedSourceArtifact('fixture-library', { toolDir, platform: 'darwin', architecture: 'arm64', macosVersion: '15.4', recipe, expectedVersion: '1.2.3', expectedSources: sources, expectedDependencies: dependencies, expectedRecipeRevision: 'r2' })
  return { toolDir, manifest, validate }
}

describe('complete source payload identity', () => {
  test('excludes only exact managed receipts while retaining nested files and rejecting broad exclusions', async () => {
    const root = await temporary.make()
    const receipt = '.autoshow-build-tool.json'
    await mkdir(join(root, 'share'))
    await Bun.write(join(root, receipt), 'receipt metadata')
    await Bun.write(join(root, 'share', receipt), 'nested resource')
    await Bun.write(join(root, 'tool'), 'tool bytes')
    const payload = await collectManagedSourcePayload(root, { excludePaths: [receipt] })
    expect(payload.some(entry => entry.path === receipt)).toBe(false)
    expect(payload.some(entry => entry.path === `share/${receipt}`)).toBe(true)
    expect(payload.some(entry => entry.path === 'tool')).toBe(true)
    for (const path of ['../outside', 'tool', 'share/*.json', '/absolute/metadata.json']) {
      await expect(collectManagedSourcePayload(root, { excludePaths: [path] })).rejects.toThrow('Only exact root-level managed receipt filenames')
    }
  })

  test('records library bytes, modes, resources, relative symlinks, and dependency identity', async () => {
    const { manifest, validate } = await writeLibraryArtifact()
    expect(manifest.payload.find(entry => entry.path === 'lib/libfixture.1.dylib')).toMatchObject({ kind: 'file', mode: 0o755, size: 23 })
    expect(manifest.payload.find(entry => entry.path === 'lib/libfixture.dylib')).toMatchObject({ kind: 'symlink', target: 'libfixture.1.dylib' })
    expect(manifest.payload.some(entry => entry.path === 'share/fonts/example.ttf')).toBe(true)
    expect(await validate()).toMatchObject({ healthy: true, version: '1.2.3' })
  })

  test('rejects modified resources, permissions, extra files, and dependency receipts', async () => {
    const resource = await writeLibraryArtifact()
    await Bun.write(join(resource.toolDir, 'share/fonts/example.ttf'), 'changed font')
    expect(await resource.validate()).toMatchObject({ healthy: false, reason: 'payload hash mismatch for share/fonts/example.ttf' })
    const permissions = await writeLibraryArtifact()
    await chmod(join(permissions.toolDir, recipe.binaryRelativePath), 0o644)
    expect(await permissions.validate()).toMatchObject({ healthy: false, reason: `payload metadata mismatch for ${recipe.binaryRelativePath}` })
    const extra = await writeLibraryArtifact()
    await Bun.write(join(extra.toolDir, 'unexpected.bin'), 'unrecorded bytes')
    expect(await extra.validate()).toMatchObject({ healthy: false, reason: 'installed source payload inventory does not match the manifest' })
    const dependency = await writeLibraryArtifact()
    dependency.manifest.dependencies![0]!.manifestSha256 = 'c'.repeat(64)
    await Bun.write(managedArtifactManifestPath(dependency.toolDir), JSON.stringify(dependency.manifest))
    expect(await dependency.validate()).toMatchObject({ healthy: false, reason: 'manifest dependency identities do not match the source recipe' })
  })

  test('rejects a payload symlink that escapes the package even when bytes are readable', async () => {
    const root = await temporary.make()
    const toolDir = join(root, 'package')
    await mkdir(join(toolDir, 'bin'), { recursive: true })
    await Bun.write(join(root, 'outside'), 'readable external bytes')
    await symlink('../../outside', join(toolDir, 'bin/tool'))
    await expect(createManagedSourceArtifactManifest({ tool: 'fixture', toolDir, deploymentTarget: '15.0', recipe: { ...recipe, binaryRelativePath: 'bin/tool', requiredPaths: [] }, version: '1.2.3', sources })).rejects.toThrow('payload symlink escapes')
  })
})

const imageLine = (path: string): string => `\t${path} (compatibility version 1.0.0, current version 1.0.0)`
const runpath = (path: string): string => `Load command 0\n          cmd LC_RPATH\n      cmdsize 48\n         path ${path} (offset 12)`
const dylibIdentity = (path: string): string => `Load command 0\n          cmd LC_ID_DYLIB\n      cmdsize 64\n         name ${path} (offset 24)\n   time stamp 1 Thu Jan  1 00:00:01 1970\n      current version 1.0.0\ncompatibility version 1.0.0`

describe('recursive native library closure', () => {
  const makeImages = async () => {
    const root = join(await temporary.make(), 'runtime with spaces')
    await mkdir(root)
    await mkdir(join(root, 'bin'))
    await mkdir(join(root, 'lib'))
    const app = join(root, 'bin/app'), middle = join(root, 'lib/libmiddle.dylib'), deep = join(root, 'lib/libdeep.dylib')
    await Promise.all([app, middle, deep].map(path => Bun.write(path, 'synthetic image')))
    return { root, app, middle, deep }
  }

  test('resolves loader paths and inherited runpaths through every native dependency', async () => {
    const { root, app, middle, deep } = await makeImages()
    const inspected: string[] = []
    await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect: async (path, kind) => {
      inspected.push(`${kind}:${path}`)
      if (kind === 'load-commands') return path === app ? runpath('@loader_path/../lib') : ''
      if (path === app) return imageLine('@rpath/libmiddle.dylib')
      if (path === middle) return imageLine(deep)
      return imageLine('/usr/lib/libSystem.B.dylib')
    } })
    expect(inspected).toContain(`libraries:${deep}`)
    expect(inspected).toHaveLength(6)
  })

  test('treats LC_ID_DYLIB as image identity without requiring the loader runpath on a standalone root', async () => {
    const { root, middle } = await makeImages()
    const ownName = '@rpath/libmiddle.dylib'
    const inspected: string[] = []
    await assertManagedDynamicLibraryClosure([middle], { runtimeRoot: root, inspect: async (path, kind) => {
      inspected.push(`${kind}:${path}`)
      return kind === 'load-commands' ? dylibIdentity(ownName) : [imageLine(ownName), imageLine('/usr/lib/libSystem.B.dylib')].join('\n')
    } })
    expect(inspected).toHaveLength(2)
  })

  test('still rejects a missing actual dependency after excluding a standalone dylib identity', async () => {
    const { root, middle } = await makeImages()
    const ownName = '@rpath/libmiddle.dylib'
    await expect(assertManagedDynamicLibraryClosure([middle], { runtimeRoot: root, inspect: async (_path, kind) => {
      return kind === 'load-commands' ? dylibIdentity(ownName) : [imageLine(ownName), imageLine('@rpath/libmissing.dylib')].join('\n')
    } })).rejects.toThrow('could not be resolved: @rpath/libmissing.dylib')
  })

  test('rejects an external transitive dependency and unresolved or external runpaths', async () => {
    const { root, app, middle } = await makeImages()
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect: async (path, kind) => {
      if (kind === 'load-commands') return path === app ? runpath('@loader_path/../lib') : ''
      return path === app ? imageLine('@rpath/libmiddle.dylib') : imageLine('/external/lib/libescape.dylib')
    } })).rejects.toThrow('could not be resolved')
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect: async (_path, kind) => kind === 'libraries' ? imageLine('@rpath/libmissing.dylib') : '' })).rejects.toThrow('could not be resolved')
    await expect(assertManagedDynamicLibraryClosure([middle], { runtimeRoot: root, inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath('/external/lib') })).rejects.toThrow('external or unresolved runpath')
  })

  test('keeps strict rejection of producer runpaths without a verified signed-Calibre context', async () => {
    const { root, app } = await makeImages()
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect: async (_path, kind) => kind === 'libraries' ? imageLine('/usr/lib/libSystem.B.dylib') : runpath(MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]) })).rejects.toThrow('external or unresolved runpath')
  })

  test('records only absent reviewed runpaths after pinned signed-package verification', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const trace: string[] = []
    const report = await assertManagedDynamicLibraryClosure([app], {
      runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => { trace.push('verified-signature') }, probeExternalPath: async () => 'missing' },
      inspect: async (_path, kind) => { trace.push(kind); return kind === 'libraries' ? imageLine('/usr/lib/libSystem.B.dylib') : runpath(MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]) }
    })
    expect(trace[0]).toBe('verified-signature')
    expect(report).toEqual({ inertRunpaths: [MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]], unavailableComponents: [], absentFrameworks: [] })
  })

  test('rejects a wrong archive pin or failed signature before inspecting or dispatching an application', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    let inspected = false
    let dispatched = false
    const inspect = async () => { inspected = true; return '' }
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect, signedCalibre: { packageRoot: root, pinnedArchiveSha256: '0'.repeat(64), verifySignature: async () => undefined } })).rejects.toThrow('pinned upstream archive')
    try {
      await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root, inspect, signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => { throw new Error('signature rejected') } } })
      dispatched = true
    } catch (error) { expect((error as Error).message).toBe('signature rejected') }
    expect(inspected).toBe(false)
    expect(dispatched).toBe(false)
  })

  test('blocks existing producer directories and dangling search-path links before application dispatch', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const reviewed = MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]
    for (const state of ['directory', 'symlink'] as const) {
      let dispatched = false
      try {
        await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
          signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, probeExternalPath: async path => path === reviewed ? state : 'directory' },
          inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath(reviewed) })
        dispatched = true
      } catch (error) { expect((error as Error).message).toContain('no longer inert') }
      expect(dispatched).toBe(false)
    }
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, probeExternalPath: async path => path === '/Users/Shared/calibre-build' ? 'symlink' : 'missing' },
      inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath(reviewed) })).rejects.toThrow('no longer inert')
  })

  test('never admits actual foreign library edges under the signed-package runpath policy', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const foreign = join(root, '..', 'foreign.dylib')
    await Bun.write(foreign, 'synthetic external dependency')
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, probeExternalPath: async () => 'missing' },
      inspect: async (_path, kind) => kind === 'libraries' ? imageLine(foreign) : runpath(MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]) })).rejects.toThrow('escapes runtime')
  })

  test('rechecks producer-path absence after the full dependency scan before allowing dispatch', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const reviewed = MANAGED_SIGNED_CALIBRE_INERT_RPATHS[0]
    let observations = 0
    let dispatched = false
    try {
      await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
        signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, probeExternalPath: async path => path === reviewed && ++observations > 1 ? 'directory' : 'missing' },
        inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath(reviewed) })
      dispatched = true
    } catch (error) { expect((error as Error).message).toContain('no longer inert') }
    expect(observations).toBe(2)
    expect(dispatched).toBe(false)
  })

  test('validates dynamically loaded signed-package images using the verified executable loader context', async () => {
    const { root, app, middle, deep } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const inspected: string[] = []
    await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, additionalImages: [middle], probeExternalPath: async () => 'missing' },
      inspect: async (path, kind) => {
        inspected.push(`${kind}:${path}`)
        if (kind === 'load-commands') return path === app ? runpath('@executable_path/../lib') : ''
        if (path === middle) return imageLine('@rpath/libdeep.dylib')
        return imageLine('/usr/lib/libSystem.B.dylib')
      } })
    expect(inspected).toContain(`libraries:${middle}`)
    expect(inspected).toContain(`libraries:${deep}`)
  })

  test('admits only the six reviewed declarations and records canonical guarded system-alias paths', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const probed: string[] = []
    const report = await assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined,
        probeExternalPath: async path => { probed.push(path); return 'missing' }, resolveSystemAlias: async () => '/private/var' },
      inspect: async (_path, kind) => kind === 'libraries' ? '' : MANAGED_SIGNED_CALIBRE_INERT_RPATHS.map(runpath).join('\n') })
    expect(report.inertRunpaths).toEqual(MANAGED_SIGNED_CALIBRE_INERT_RPATHS.map(canonicalManagedCalibreInertRunpath).sort())
    expect(probed.some(path => path.startsWith('/var/'))).toBe(false)
    expect(probed.some(path => path.startsWith('/private/var/'))).toBe(true)
  })

  test('rejects a changed system alias or any other symlink beneath its reviewed canonical path', async () => {
    const { root, app } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const declared = MANAGED_SIGNED_CALIBRE_INERT_RPATHS[2]
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined,
        probeExternalPath: async () => 'missing', resolveSystemAlias: async () => '/external/replaced-var' },
      inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath(declared) })).rejects.toThrow('standard protected /var system alias')
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined,
        probeExternalPath: async path => path === '/private/var/folders' ? 'symlink' : 'missing', resolveSystemAlias: async () => '/private/var' },
      inspect: async (_path, kind) => kind === 'libraries' ? '' : runpath(declared) })).rejects.toThrow('no longer inert')
  })

  test('rejects dynamically loaded images outside the signed package and unresolved plugin dependencies', async () => {
    const { root, app, middle } = await makeImages()
    const source = await readDependencyUrlAndSha256('calibre')
    const foreign = join(root, '..', 'foreign-plugin.dylib')
    await Bun.write(foreign, 'foreign plugin')
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, additionalImages: [foreign], probeExternalPath: async () => 'missing' },
      inspect: async () => '' })).rejects.toThrow('escapes runtime')
    await expect(assertManagedDynamicLibraryClosure([app], { runtimeRoot: root,
      signedCalibre: { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined, additionalImages: [middle], probeExternalPath: async () => 'missing' },
      inspect: async (path, kind) => kind === 'libraries' && path === middle ? imageLine('@rpath/libmissing-plugin-dependency.dylib') : '' })).rejects.toThrow('could not be resolved: @rpath/libmissing-plugin-dependency.dylib')
  })
})

describe('pinned signed Calibre unavailable GUI component policy', () => {
  const makeSignedCliFixture = async () => {
    const root = join(await temporary.make(), 'calibre.app')
    const main = join(root, 'Contents/MacOS/ebook-convert')
    await mkdir(dirname(main), { recursive: true })
    await mkdir(join(root, 'Contents/Frameworks'), { recursive: true })
    await Bun.write(main, 'synthetic CLI image')
    const additionalImages: string[] = []
    for (const component of MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS) {
      const path = join(root, component.image)
      await mkdir(dirname(path), { recursive: true })
      await Bun.write(path, 'synthetic unavailable GUI image')
      additionalImages.push(path)
    }
    const source = await readDependencyUrlAndSha256('calibre')
    const context = { packageRoot: root, pinnedArchiveSha256: source.sha256, verifySignature: async () => undefined,
      additionalImages, unavailableComponentPolicy: 'calibre-cli-sandbox-v1' as const }
    const inspect = async (path: string, kind: 'libraries' | 'load-commands') => {
      if (kind === 'load-commands') return ''
      const component = MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS.find(entry => entry.image === relative(root, path))
      return component ? component.missingDependencies.map(imageLine).join('\n') : imageLine('/usr/lib/libSystem.B.dylib')
    }
    return { root, main, context, inspect }
  }

  test('reports exactly five unavailable components, six missing edges, and four absent frameworks', async () => {
    const fixture = await makeSignedCliFixture()
    const result = await assertManagedDynamicLibraryClosure([fixture.main], { runtimeRoot: fixture.root, signedCalibre: fixture.context, inspect: fixture.inspect })
    expect(result.inertRunpaths).toEqual([])
    expect(result.unavailableComponents).toHaveLength(5)
    expect(result.unavailableComponents.reduce((count, component) => count + component.missingDependencies.length, 0)).toBe(6)
    expect(result.absentFrameworks).toEqual([...MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS].sort())
    expect(result.unavailableComponents).toEqual(MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS.map(component => ({ image: component.image, missingDependencies: [...component.missingDependencies].sort() })).sort((left, right) => left.image.localeCompare(right.image)))
  })

  test('keeps signed-package missing dependencies strict without the exact sandbox policy opt-in', async () => {
    const fixture = await makeSignedCliFixture()
    const { unavailableComponentPolicy: _policy, ...strictContext } = fixture.context
    await expect(assertManagedDynamicLibraryClosure([fixture.main], { runtimeRoot: fixture.root, signedCalibre: strictContext, inspect: fixture.inspect })).rejects.toThrow('could not be resolved')
  })

  test('rejects unreviewed missing edges and incomplete unavailable-component scans', async () => {
    const fixture = await makeSignedCliFixture()
    await expect(assertManagedDynamicLibraryClosure([fixture.main], { runtimeRoot: fixture.root, signedCalibre: fixture.context, inspect: async (path, kind) => {
      const output = await fixture.inspect(path, kind)
      return kind === 'libraries' && path.endsWith('PyQt6.QtPdf.so') ? `${output}\n${imageLine('@executable_path/../Frameworks/Unreviewed.framework/Versions/A/Unreviewed')}` : output
    } })).rejects.toThrow('could not be resolved')
    await expect(assertManagedDynamicLibraryClosure([fixture.main], { runtimeRoot: fixture.root, signedCalibre: { ...fixture.context, additionalImages: fixture.context.additionalImages.slice(0, 1) }, inspect: fixture.inspect })).rejects.toThrow('inventory does not match the reviewed CLI sandbox policy')
  })

  test('blocks a present or dangling reviewed framework instead of claiming its component unavailable', async () => {
    const present = await makeSignedCliFixture()
    await mkdir(join(present.root, MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS[0]))
    await expect(assertManagedDynamicLibraryClosure([present.main], { runtimeRoot: present.root, signedCalibre: present.context, inspect: present.inspect })).rejects.toThrow('framework is present or linked')
    const dangling = await makeSignedCliFixture()
    await symlink('missing-framework', join(dangling.root, MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS[0]))
    await expect(assertManagedDynamicLibraryClosure([dangling.main], { runtimeRoot: dangling.root, signedCalibre: dangling.context, inspect: dangling.inspect })).rejects.toThrow('framework is present or linked')
  })
})
