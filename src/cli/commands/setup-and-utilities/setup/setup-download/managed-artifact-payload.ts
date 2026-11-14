import { lstat, readdir, readlink, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { ManagedSourcePayloadFile } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { readFileBytes } from '~/utils/bun-file-io'
import { isIgnoredManagedArtifactPath, MANAGED_ARTIFACT_MANIFEST_NAME } from './managed-artifact-schema'

const invalidPayload = (message: string): never => {
  throw ValidationError(message, { stage: 'setup:managed-artifact', retryable: false })
}

export const isContainedManagedPath = (root: string, candidate: string): boolean => {
  const path = relative(resolve(root), resolve(candidate))
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('../'))
}

export const collectManagedSourcePayload = async (
  toolDir: string,
  options: { excludePaths?: readonly string[] } = {}
): Promise<ManagedSourcePayloadFile[]> => {
  const excludedPaths = new Set([MANAGED_ARTIFACT_MANIFEST_NAME])
  for (const path of options.excludePaths ?? []) {
    if (!/^\.autoshow-[A-Za-z0-9._-]+\.json$/.test(path) || path.includes('/') || path.includes('\\')) invalidPayload('Only exact root-level managed receipt filenames may be excluded from a source payload')
    excludedPaths.add(path)
  }
  const root = await realpath(toolDir)
  const payload: ManagedSourcePayloadFile[] = []
  const visit = async (relativeDir: string): Promise<void> => {
    const entries = await readdir(join(root, relativeDir), { withFileTypes: true })
    for (const entry of entries.filter(entry => !isIgnoredManagedArtifactPath(entry.name)).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
      if (excludedPaths.has(path)) continue
      const absolutePath = join(root, path)
      const metadata = await lstat(absolutePath)
      const mode = metadata.mode & 0o7777
      if (metadata.isSymbolicLink()) {
        const target = await readlink(absolutePath)
        if (isAbsolute(target) || target.includes('\\')) invalidPayload(`payload symlink must have a relative target: ${path}`)
        const destination = await realpath(absolutePath)
        if (!isContainedManagedPath(root, destination)) invalidPayload(`payload symlink escapes its managed package: ${path}`)
        payload.push({ path, kind: 'symlink', target, sha256: sha256Bytes(target), mode })
      } else if (metadata.isDirectory()) {
        payload.push({ path, kind: 'directory', sha256: sha256Bytes('directory'), mode })
        await visit(path)
      } else if (metadata.isFile()) {
        payload.push({ path, kind: 'file', sha256: sha256Bytes(await readFileBytes(absolutePath)), mode, size: metadata.size })
      } else invalidPayload(`payload contains unsupported file type: ${path}`)
    }
  }
  await visit('')
  return payload.sort((left, right) => left.path.localeCompare(right.path))
}

export const managedSourcePayloadIssue = (
  recorded: ManagedSourcePayloadFile[],
  actual: ManagedSourcePayloadFile[]
): string | undefined => {
  const admittedRecorded = recorded.filter(entry => !isIgnoredManagedArtifactPath(entry.path))
  const admittedActual = actual.filter(entry => !isIgnoredManagedArtifactPath(entry.path))
  const paths = admittedRecorded.map(entry => entry.path)
  if (new Set(paths).size !== paths.length) return 'manifest payload contains duplicate paths'
  if (JSON.stringify(paths.slice().sort()) !== JSON.stringify(admittedActual.map(entry => entry.path).sort())) return 'installed source payload inventory does not match the manifest'
  const actualByPath = new Map(admittedActual.map(entry => [entry.path, entry]))
  for (const entry of admittedRecorded) {
    const current = actualByPath.get(entry.path)!
    if (entry.sha256 !== current.sha256) return `payload hash mismatch for ${entry.path}`
    if (entry.kind !== current.kind || entry.mode !== current.mode || entry.size !== current.size || entry.target !== current.target) return `payload metadata mismatch for ${entry.path}`
  }
  return undefined
}
