import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createManagedSourceArtifactManifest,
  createManagedToolStagingDirectory,
  managedArtifactManifestPath,
  parseManagedSourceArtifactManifest,
  promoteManagedToolDirectory,
  validateManagedSourceArtifact
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-managed-artifact-test-'
})

const writeQpdfArtifact = async (
  toolDir: string,
  options: { architecture?: string, deploymentTarget?: string, payload?: string } = {}
): Promise<void> => {
  await mkdir(join(toolDir, 'bin'), { recursive: true })
  await Bun.write(join(toolDir, 'bin/qpdf'), options.payload ?? 'qpdf fixture\n')
  const manifest = await createManagedSourceArtifactManifest({
    tool: 'qpdf',
    toolDir,
    deploymentTarget: options.deploymentTarget ?? '15.0',
    platform: 'darwin',
    architecture: options.architecture ?? 'arm64'
  })
  await Bun.write(managedArtifactManifestPath(toolDir), `${JSON.stringify(manifest, null, 2)}\n`)
}

describe('managed source artifact manifest', () => {
  test('accepts the closed version 1 source schema and rejects unknown fields', async () => {
    const toolDir = await tempDirs.make()
    await writeQpdfArtifact(toolDir)
    const value = JSON.parse(await Bun.file(managedArtifactManifestPath(toolDir)).text()) as Record<string, unknown>

    expect(parseManagedSourceArtifactManifest(value)).toMatchObject({
      schemaVersion: 1,
      tool: 'qpdf',
      distribution: 'source'
    })
    expect(() => parseManagedSourceArtifactManifest({ ...value, unreviewed: true })).toThrow()
    expect(() => parseManagedSourceArtifactManifest({ ...value, schemaVersion: 2 })).toThrow()
  })

  test('validates exact source pins, recipe flags, platform, architecture, target, and payload hash', async () => {
    const toolDir = await tempDirs.make()
    await writeQpdfArtifact(toolDir)

    await expect(validateManagedSourceArtifact('qpdf', {
      toolDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).resolves.toMatchObject({
      healthy: true,
      distribution: 'source',
      version: '12.3.2',
      platform: 'darwin',
      architecture: 'arm64'
    })
  })

  test('creates and validates the MuPDF source manifest with its exact release recipe', async () => {
    const toolDir = await tempDirs.make()
    await mkdir(join(toolDir, 'bin'), { recursive: true })
    await Bun.write(join(toolDir, 'bin/mutool'), 'mutool fixture\n')
    const manifest = await createManagedSourceArtifactManifest({
      tool: 'mupdf',
      toolDir,
      deploymentTarget: '14.0',
      platform: 'darwin',
      architecture: 'x64'
    })
    await Bun.write(managedArtifactManifestPath(toolDir), `${JSON.stringify(manifest, null, 2)}\n`)

    expect(manifest).toMatchObject({
      tool: 'mupdf',
      version: '1.27.2',
      sources: [{ name: 'mupdf', version: '1.27.2' }],
      buildFlags: ['build=release', 'HAVE_X11=no', 'HAVE_GLUT=no', 'HAVE_OBJCOPY=no', 'HAVE_LIBCRYPTO=no'],
      payload: [{ path: 'bin/mutool' }]
    })
    expect(await validateManagedSourceArtifact('mupdf', {
      toolDir,
      platform: 'darwin',
      architecture: 'x64',
      macosVersion: '14.7'
    })).toMatchObject({ healthy: true, version: '1.27.2' })
  })

  test('rejects provenance-free, corrupt, incompatible, and wrong-architecture installs', async () => {
    const provenanceFreeDir = await tempDirs.make()
    await mkdir(join(provenanceFreeDir, 'bin'), { recursive: true })
    await Bun.write(join(provenanceFreeDir, 'bin/qpdf'), 'launchable but unrecorded\n')
    expect(await validateManagedSourceArtifact('qpdf', {
      toolDir: provenanceFreeDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).toMatchObject({ healthy: false })

    const corruptDir = await tempDirs.make()
    await writeQpdfArtifact(corruptDir)
    await Bun.write(join(corruptDir, 'bin/qpdf'), 'modified after manifest\n')
    expect(await validateManagedSourceArtifact('qpdf', {
      toolDir: corruptDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).toMatchObject({ healthy: false, reason: 'payload hash mismatch for bin/qpdf' })

    const incompatibleDir = await tempDirs.make()
    await writeQpdfArtifact(incompatibleDir, { architecture: 'x64', deploymentTarget: '16.0' })
    expect(await validateManagedSourceArtifact('qpdf', {
      toolDir: incompatibleDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).toMatchObject({ healthy: false, reason: 'manifest architecture is x64, current architecture is arm64' })
    expect(await validateManagedSourceArtifact('qpdf', {
      toolDir: incompatibleDir,
      platform: 'darwin',
      architecture: 'x64',
      macosVersion: '15.4'
    })).toMatchObject({ healthy: false, reason: 'manifest deployment target 16.0 exceeds host macOS 15.4' })
  })

  test('ignores an interrupted sibling staging tree when validating the promoted install', async () => {
    const parent = await tempDirs.make()
    const toolDir = join(parent, 'qpdf')
    await writeQpdfArtifact(toolDir)
    await mkdir(join(parent, '.qpdf.staging-interrupted/bin'), { recursive: true })
    await Bun.write(join(parent, '.qpdf.staging-interrupted/bin/qpdf'), 'partial\n')

    expect(await validateManagedSourceArtifact('qpdf', {
      toolDir,
      platform: 'darwin',
      architecture: 'arm64',
      macosVersion: '15.4'
    })).toMatchObject({ healthy: true })
  })
})

describe('managed tool atomic promotion', () => {
  test('atomically replaces a validated directory and removes its staging tree', async () => {
    const parent = await tempDirs.make()
    const destinationDir = join(parent, 'qpdf')
    await mkdir(destinationDir)
    await Bun.write(join(destinationDir, 'payload'), 'old\n')
    const stagingDir = await createManagedToolStagingDirectory(destinationDir)
    await Bun.write(join(stagingDir, 'payload'), 'new\n')

    await promoteManagedToolDirectory({
      stagingDir,
      destinationDir,
      validateStaging: async (path) => {
        if (await Bun.file(join(path, 'payload')).text() !== 'new\n') throw new Error('invalid staged payload')
      }
    })

    expect(await Bun.file(join(destinationDir, 'payload')).text()).toBe('new\n')
    expect(await Bun.file(stagingDir).exists()).toBe(false)
  })

  test('preserves a healthy prior install when staging validation fails', async () => {
    const parent = await tempDirs.make()
    const destinationDir = join(parent, 'mupdf')
    await mkdir(destinationDir)
    await Bun.write(join(destinationDir, 'payload'), 'healthy prior\n')
    const stagingDir = await createManagedToolStagingDirectory(destinationDir)
    await Bun.write(join(stagingDir, 'payload'), 'interrupted\n')

    await expect(promoteManagedToolDirectory({
      stagingDir,
      destinationDir,
      validateStaging: async () => { throw new Error('staging validation failed') }
    })).rejects.toThrow('staging validation failed')

    expect(await Bun.file(join(destinationDir, 'payload')).text()).toBe('healthy prior\n')
    expect(await Bun.file(stagingDir).exists()).toBe(false)
  })

  test('rolls back to the healthy prior install when activation fails after replacement', async () => {
    const parent = await tempDirs.make()
    const destinationDir = join(parent, 'qpdf')
    await mkdir(destinationDir)
    await Bun.write(join(destinationDir, 'payload'), 'healthy prior\n')
    const stagingDir = await createManagedToolStagingDirectory(destinationDir)
    await Bun.write(join(stagingDir, 'payload'), 'candidate\n')

    await expect(promoteManagedToolDirectory({
      stagingDir,
      destinationDir,
      validateStaging: async () => undefined,
      activate: async () => { throw new Error('activation interrupted') }
    })).rejects.toThrow('activation interrupted')

    expect(await Bun.file(join(destinationDir, 'payload')).text()).toBe('healthy prior\n')
  })

  test('rolls back when validation fails from the promoted stable path', async () => {
    const parent = await tempDirs.make()
    const destinationDir = join(parent, 'mupdf')
    await mkdir(destinationDir)
    await Bun.write(join(destinationDir, 'payload'), 'healthy prior\n')
    const stagingDir = await createManagedToolStagingDirectory(destinationDir)
    await Bun.write(join(stagingDir, 'payload'), 'candidate\n')
    let validations = 0

    await expect(promoteManagedToolDirectory({
      stagingDir,
      destinationDir,
      validateStaging: async () => {
        validations += 1
        if (validations === 2) throw new Error('stable-path validation failed')
      }
    })).rejects.toThrow('stable-path validation failed')

    expect(validations).toBe(2)
    expect(await Bun.file(join(destinationDir, 'payload')).text()).toBe('healthy prior\n')
  })
})
