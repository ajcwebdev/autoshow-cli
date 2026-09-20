import { isAbsolute } from 'node:path'
import type { JsonObject, ProviderSettingsRecord } from '~/types'
import { sanitizeArtifactMetadata } from '~/utils/app-logger/redaction'
import { toProjectRelativePath } from '~/utils/project-root'
import { isRecord } from '~/utils/rest-client'

export const PROVIDER_SETTINGS_SCHEMA_VERSION = 1

export type ProviderSettingsInput = {
  service: string
  operation: string
  request: Record<string, unknown>
  local?: Record<string, unknown> | undefined
  ignored?: readonly string[] | undefined
}

const compactSettingsValue = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    if (value.length === 0) return undefined
    return isAbsolute(value) ? toProjectRelativePath(value) : value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    const entries = value.map(compactSettingsValue).filter(entry => entry !== undefined)
    return entries.length > 0 ? entries : undefined
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, compactSettingsValue(entry)] as const)
      .filter(([, entry]) => entry !== undefined)
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }
  return undefined
}

const compactSettingsObject = (value: Record<string, unknown> | undefined): JsonObject | undefined => {
  if (!value) return undefined
  const compacted = compactSettingsValue(value)
  if (!isRecord(compacted)) return undefined
  const sanitized = sanitizeArtifactMetadata(compacted)
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export const providerSettingsSchema = (service: string, operation: string): string =>
  `${service}.${operation}.v${PROVIDER_SETTINGS_SCHEMA_VERSION}`

export const createProviderSettingsRecord = (input: ProviderSettingsInput): ProviderSettingsRecord => {
  const local = compactSettingsObject(input.local)
  const ignored = [...new Set(input.ignored ?? [])].filter(entry => entry.length > 0).sort()
  return {
    schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
    settingsSchema: providerSettingsSchema(input.service, input.operation),
    request: compactSettingsObject(input.request) ?? {},
    ...(local ? { local } : {}),
    ...(ignored.length > 0 ? { ignored } : {})
  }
}

// Content files that shape output (lexicons, lyrics, prompt files, cover art, reference media) are recorded by project-relative path plus content hash.
export const describeSettingsFile = async (path: string | undefined): Promise<JsonObject | undefined> => {
  if (!path) return undefined
  const file = Bun.file(path)
  if (!(await file.exists())) return { path: toProjectRelativePath(path) }
  const sha256 = new Bun.CryptoHasher('sha256').update(await file.arrayBuffer()).digest('hex')
  return { path: toProjectRelativePath(path), sha256 }
}

export const parseProviderSettingsRecord = (value: unknown): ProviderSettingsRecord | undefined => {
  if (
    !isRecord(value)
    || Object.keys(value).some(key => !['schemaVersion', 'settingsSchema', 'request', 'local', 'ignored'].includes(key))
    || value['schemaVersion'] !== PROVIDER_SETTINGS_SCHEMA_VERSION
    || typeof value['settingsSchema'] !== 'string'
    || value['settingsSchema'].trim().length === 0
    || !isRecord(value['request'])
    || (value['local'] !== undefined && !isRecord(value['local']))
    || (value['ignored'] !== undefined && (!Array.isArray(value['ignored']) || value['ignored'].some(entry => typeof entry !== 'string')))
  ) return undefined
  return {
    schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
    settingsSchema: value['settingsSchema'],
    request: value['request'],
    ...(isRecord(value['local']) ? { local: value['local'] } : {}),
    ...(Array.isArray(value['ignored']) ? { ignored: value['ignored'] as string[] } : {})
  }
}
