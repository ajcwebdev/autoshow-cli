import { lstat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { PIPELINE_ITEM_STATUSES, PIPELINE_PROVIDER_STATUSES, PROCESS_COMMANDS } from '~/types'
import type { ExtractRoute, InputFamily, ProcessCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'

const PROCESS_COMMAND_SET = new Set<string>(PROCESS_COMMANDS)
export const ITEM_STATUS_SET = new Set<string>(PIPELINE_ITEM_STATUSES)
export const PROVIDER_STATUS_SET = new Set<string>(PIPELINE_PROVIDER_STATUSES)
const INPUT_FAMILY_SET = new Set(['media', 'document', 'html_article', 'x_space', 'unsupported'])
const EXTRACT_ROUTE_SET = new Set(['media', 'document', 'article', 'x-space'])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean => {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

export const isProcessCommand = (value: unknown): value is ProcessCommand =>
  typeof value === 'string' && PROCESS_COMMAND_SET.has(value)

export const isInputFamily = (value: unknown): value is InputFamily =>
  typeof value === 'string' && INPUT_FAMILY_SET.has(value)

export const isExtractRoute = (value: unknown): value is ExtractRoute =>
  typeof value === 'string' && EXTRACT_ROUTE_SET.has(value)

export const isSafeRelativePath = (rootDir: string, value: string): boolean => {
  if (value.length === 0 || isAbsolute(value)) {
    return false
  }
  const root = resolve(rootDir)
  const target = resolve(root, value)
  const fromRoot = relative(root, target)
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot))
}

export const hasPersistedKey = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.propertyIsEnumerable.call(value, key)

export const canonicalManifestJson = (value: unknown): string => {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (isRecord(entry)) {
      return Object.fromEntries(
        Object.keys(entry).sort().flatMap((key) => entry[key] === undefined ? [] : [[key, normalize(entry[key])]])
      )
    }
    return entry
  }
  return JSON.stringify(normalize(value))
}

export const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

export const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && SHA256_PATTERN.test(value)

export const isVoiceContextKey = (value: unknown): value is string =>
  isSha256(value)
  || (typeof value === 'string' && value.startsWith('approved:') && value.length > 'approved:'.length)

export const isStrictArtifactRelativePath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value === '.' || isAbsolute(value) || value.includes('\\')) {
    return false
  }
  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

export const hasContiguousSequence = (entries: unknown[]): boolean =>
  entries.every((entry, index) => isRecord(entry) && entry['sequence'] === index + 1)

export const isAuditActor = (value: unknown): boolean =>
  isRecord(value)
  && hasOnlyKeys(value, ['namespace', 'actorId'])
  && (value['namespace'] === 'local-user' || value['namespace'] === 'project-role' || value['namespace'] === 'automation')
  && typeof value['actorId'] === 'string'
  && value['actorId'].trim().length > 0

export const hasArtifactRef = (
  value: Record<string, unknown>,
  refKey: string,
  shaKey: string
): boolean => isStrictArtifactRelativePath(value[refKey]) && isSha256(value[shaKey])

export const validatesOptionalArtifactRef = (
  value: Record<string, unknown>,
  refKey: string,
  shaKey: string
): boolean => {
  const hasRef = value[refKey] !== undefined
  const hasSha = value[shaKey] !== undefined
  return hasRef === hasSha && (!hasRef || hasArtifactRef(value, refKey, shaKey))
}

export const isAppendOnlyArray = (before: unknown[], after: unknown[]): boolean =>
  before.length <= after.length
  && before.every((entry, index) => canonicalManifestJson(entry) === canonicalManifestJson(after[index]))

export const isOpaqueProtectedAssetRef = (value: unknown): boolean =>
  isRecord(value)
  && typeof value['storeId'] === 'string'
  && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value['storeId'])
  && typeof value['assetId'] === 'string'
  && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value['assetId'])
  && isSha256(value['sha256'])

export const hasNoSymlinkBelowRoot = async (
  rootDir: string,
  candidate: string
): Promise<boolean> => {
  const fromRoot = relative(resolve(rootDir), resolve(candidate))
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return false
  let current = resolve(rootDir)
  for (const segment of fromRoot.split(sep)) {
    current = join(current, segment)
    const entry = await lstat(current)
    if (entry.isSymbolicLink()) return false
  }
  return true
}

export const toManifestRelativePath = (
  rootDir: string,
  value: string
): string => {
  const root = resolve(rootDir)
  const target = isAbsolute(value) ? resolve(value) : resolve(root, value)
  const fromRoot = relative(root, target) || '.'
  if (!isSafeRelativePath(root, fromRoot)) {
    throw CLIUsageError(`Manifest path escapes its run root: ${value}`)
  }
  return fromRoot
}

export const resolveManifestRelativePath = (
  rootDir: string,
  value: string
): string => {
  if (!isSafeRelativePath(rootDir, value)) {
    throw CLIUsageError(`Manifest path escapes its run root: ${value}`)
  }
  return resolve(rootDir, value)
}
