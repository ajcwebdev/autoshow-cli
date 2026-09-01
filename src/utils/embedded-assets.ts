import { embeddedFiles } from 'bun'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { IMMUTABLE_ASSET_ROOT } from './runtime-paths'

const embeddedAssetName = (file: Blob): string | undefined => {
  const name: unknown = Reflect.get(file, 'name')
  return typeof name === 'string' ? name : undefined
}

export const listEmbeddedAssetPaths = (
  directory: string,
  extension?: string
): string[] => {
  if (!Bun.isStandaloneExecutable) return []
  const relativeDirectory = relative(IMMUTABLE_ASSET_ROOT, resolve(directory))
  if (relativeDirectory === '..' || relativeDirectory.startsWith(`..${sep}`) || isAbsolute(relativeDirectory)) return []
  const prefix = relativeDirectory.length === 0
    ? ''
    : `${relativeDirectory.replaceAll(sep, '/')}/`
  return embeddedFiles
    .map(embeddedAssetName)
    .filter((name): name is string => name !== undefined)
    .filter((name) => name.startsWith(prefix) && (extension === undefined || name.endsWith(extension)))
    .map((name) => resolve(IMMUTABLE_ASSET_ROOT, name))
    .sort((left, right) => left.localeCompare(right))
}
