import { mkdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { pathExists } from '~/utils/filesystem'

export const createManagedToolStagingDirectory = async (toolDir: string): Promise<string> => {
  const stagingDir = join(dirname(toolDir), `.${basename(toolDir)}.staging-${crypto.randomUUID()}`)
  await mkdir(stagingDir, { recursive: false })
  return stagingDir
}

export const promoteManagedToolDirectory = async (options: {
  stagingDir: string
  destinationDir: string
  validateStaging: (path: string) => Promise<void>
  activate?: () => Promise<void>
  rollbackActivation?: (hadPreviousInstall: boolean) => Promise<void>
}): Promise<void> => {
  const backupDir = `${options.destinationDir}.backup-${crypto.randomUUID()}`
  const hadPreviousInstall = await pathExists(options.destinationDir)
  let previousMoved = false
  let stagingPromoted = false

  try {
    await options.validateStaging(options.stagingDir)
    if (hadPreviousInstall) {
      await rename(options.destinationDir, backupDir)
      previousMoved = true
    }
    await rename(options.stagingDir, options.destinationDir)
    stagingPromoted = true
    await options.activate?.()
    await options.validateStaging(options.destinationDir)
  } catch (error) {
    if (stagingPromoted) await rm(options.destinationDir, { recursive: true, force: true })
    if (previousMoved) await rename(backupDir, options.destinationDir)
    await options.rollbackActivation?.(hadPreviousInstall)
    throw error
  } finally {
    await rm(options.stagingDir, { recursive: true, force: true })
  }

  if (previousMoved) await rm(backupDir, { recursive: true, force: true })
}

export { managedArtifactManifestPath, parseManagedSourceArtifactManifest } from './managed-artifact-schema'

export { createManagedSourceArtifactManifest, resolveSourceDeploymentTarget, writeManagedSourceArtifactManifest } from './managed-source-artifact'

export { validateManagedArtifact, validateManagedSourceArtifact } from './managed-artifact-validation'
