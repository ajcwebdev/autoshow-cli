import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readDependencyUrlAndSha256, readDependencyVersion } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { MUPDF_SOURCE_BUILD_FLAGS } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import { LIBJPEG_TURBO_SOURCE_BUILD_FLAGS, QPDF_SOURCE_BUILD_FLAGS } from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import type {
  ManagedArtifactSource,
  ManagedArtifactToolId,
  ManagedSourceArtifactManifest,
  ManagedSourceRecipe
} from '~/types'
import { InfraError, InternalError, UsageError } from '~/utils/error-handler'
import { mupdfToolDir, qpdfToolDir } from '~/utils/runtime-paths'
import { sha256Bytes } from '~/utils/value-helpers'
import { MANAGED_ARTIFACT_SCHEMA_VERSION, managedArtifactManifestPath } from './managed-artifact-schema'

const SOURCE_RECIPES: Record<ManagedArtifactToolId, ManagedSourceRecipe> = {
  mupdf: {
    binaryRelativePath: 'bin/mutool',
    sourceNames: ['mupdf'],
    buildFlags: MUPDF_SOURCE_BUILD_FLAGS
  },
  qpdf: {
    binaryRelativePath: 'bin/qpdf',
    sourceNames: ['qpdf', 'libjpeg-turbo'],
    buildFlags: [...LIBJPEG_TURBO_SOURCE_BUILD_FLAGS, ...QPDF_SOURCE_BUILD_FLAGS]
  }
}

export const MANAGED_TOOL_DIRS: Record<ManagedArtifactToolId, string> = {
  mupdf: mupdfToolDir,
  qpdf: qpdfToolDir
}

export const sha256File = async (path: string): Promise<string> =>
  sha256Bytes(await readFile(path))

const normalizeMacosVersion = (value: string): string | undefined => {
  const match = value.trim().match(/^(\d+)\.(\d+)(?:\.\d+)?$/)
  return match ? `${Number(match[1])}.${Number(match[2])}` : undefined
}

export const compareMacosVersions = (left: string, right: string): number => {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export const resolveHostMacosVersion = async (): Promise<string> => {
  const result = await runCapture('sw_vers', ['-productVersion'], { allowFailure: true })
  const version = result.exitCode === 0 ? normalizeMacosVersion(result.stdout) : undefined
  if (!version) throw InfraError('could not determine the host macOS version with sw_vers', { stage: 'setup:managed-artifact' })
  return version
}

export const resolveSourceDeploymentTarget = async (): Promise<string> => {
  const configured = process.env['MACOSX_DEPLOYMENT_TARGET']
  if (configured) {
    const version = normalizeMacosVersion(configured)
    if (!version) {
      throw UsageError(`Invalid MACOSX_DEPLOYMENT_TARGET: ${configured}`, { hints: ['Use a MAJOR.MINOR macOS version, for example 15.0.'] })
    }
    return version
  }
  const hostVersion = await resolveHostMacosVersion()
  return `${hostVersion.split('.')[0]}.0`
}

export const managedArtifactBinaryRelativePath = (tool: ManagedArtifactToolId): string =>
  SOURCE_RECIPES[tool].binaryRelativePath

export const managedArtifactBuildFlags = (tool: ManagedArtifactToolId): string[] =>
  [...SOURCE_RECIPES[tool].buildFlags]

export const readExpectedManagedArtifactSources = async (tool: ManagedArtifactToolId): Promise<ManagedArtifactSource[]> =>
  await Promise.all(SOURCE_RECIPES[tool].sourceNames.map(async (name) => {
    const version = await readDependencyVersion(name)
    if (!version) {
      throw InternalError(`Missing version for managed source dependency ${name}`, { stage: 'setup:managed-artifact', retryable: false })
    }
    const { url, sha256 } = await readDependencyUrlAndSha256(name)
    return { name, version, url, sha256 }
  }))

export const createManagedSourceArtifactManifest = async (options: {
  tool: ManagedArtifactToolId
  toolDir: string
  deploymentTarget: string
  platform?: NodeJS.Platform
  architecture?: string
}): Promise<ManagedSourceArtifactManifest> => {
  const recipe = SOURCE_RECIPES[options.tool]
  const platform = options.platform ?? process.platform
  if (platform !== 'darwin') {
    throw InfraError(`Managed source artifacts require darwin, received ${platform}`, { stage: 'setup:managed-artifact', retryable: false })
  }
  const binaryPath = join(options.toolDir, recipe.binaryRelativePath)
  return {
    schemaVersion: MANAGED_ARTIFACT_SCHEMA_VERSION,
    tool: options.tool,
    version: (await readDependencyVersion(options.tool)) ?? 'unknown',
    distribution: 'source',
    platform,
    architecture: options.architecture ?? process.arch,
    macosDeploymentTarget: options.deploymentTarget,
    sources: await readExpectedManagedArtifactSources(options.tool),
    buildFlags: managedArtifactBuildFlags(options.tool),
    payload: [{ path: recipe.binaryRelativePath, sha256: await sha256File(binaryPath) }]
  }
}

export const writeManagedSourceArtifactManifest = async (options: {
  tool: ManagedArtifactToolId
  toolDir: string
  deploymentTarget: string
}): Promise<ManagedSourceArtifactManifest> => {
  const manifest = await createManagedSourceArtifactManifest(options)
  await Bun.write(managedArtifactManifestPath(options.toolDir), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
