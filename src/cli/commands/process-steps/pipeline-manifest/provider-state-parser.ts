import type { PipelineProviderState } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { isRecord } from '~/utils/rest-client'
import { parseAudioProjectionStatus } from './audio-projection-structure'
import { canonicalManifestJson, hasOnlyKeys, hasPersistedKey, isSafeRelativePath, PROVIDER_STATUS_SET } from './guards'

type ProviderStateBase = {
  raw: Record<string, unknown>
  service: string
  model?: string | null | undefined
  local?: boolean | undefined
  artifactDir: string
  status: PipelineProviderState['status']
  attempts: number
  options: Record<string, unknown>
  metadata: Record<string, unknown>
  result?: Record<string, unknown> | undefined
  error?: Record<string, unknown> | undefined
}

type PersistedAudioIdentity =
  | { kind: 'legacy-absent' }
  | { kind: 'canonical', operation: string, targetKey: string, transport: string }

const parseProviderStateBase = (rootDir: string, value: unknown): ProviderStateBase | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['service', 'model', 'local', 'operation', 'targetKey', 'transport', 'artifactDir', 'status', 'attempts', 'options', 'metadata', 'result', 'error'])
    || typeof value['service'] !== 'string'
    || (value['model'] !== undefined && value['model'] !== null && typeof value['model'] !== 'string')
    || typeof value['artifactDir'] !== 'string'
    || !isSafeRelativePath(rootDir, value['artifactDir'])
    || typeof value['status'] !== 'string'
    || !PROVIDER_STATUS_SET.has(value['status'])
    || typeof value['attempts'] !== 'number'
    || !Number.isInteger(value['attempts'])
    || value['attempts'] < 0
    || !isRecord(value['options'])
    || !isRecord(value['metadata'])
    || (value['result'] !== undefined && !isRecord(value['result']))
    || (value['error'] !== undefined && !isRecord(value['error']))
    || (value['local'] !== undefined && typeof value['local'] !== 'boolean')
  ) return undefined
  return {
    raw: value,
    service: value['service'],
    ...(value['model'] === null || typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    ...(typeof value['local'] === 'boolean' ? { local: value['local'] } : {}),
    artifactDir: value['artifactDir'],
    status: value['status'] as PipelineProviderState['status'],
    attempts: value['attempts'],
    options: value['options'],
    metadata: value['metadata'],
    ...(isRecord(value['result']) ? { result: value['result'] } : {}),
    ...(isRecord(value['error']) ? { error: value['error'] } : {}),
  }
}

const parsePersistedAudioIdentity = (base: ProviderStateBase): PersistedAudioIdentity | undefined => {
  const keys = ['operation', 'targetKey', 'transport'].filter(key => hasPersistedKey(base.raw, key))
  if (keys.length === 0) return { kind: 'legacy-absent' }
  if (keys.length !== 3) return undefined
  const operation = base.raw['operation']
  const targetKey = base.raw['targetKey']
  const transport = base.raw['transport']
  if (
    typeof operation !== 'string'
    || operation.trim().length === 0
    || typeof targetKey !== 'string'
    || targetKey.trim().length === 0
    || typeof transport !== 'string'
    || transport.trim().length === 0
    || typeof base.model !== 'string'
    || targetKey !== canonicalTargetKey(operation, base.service, base.model, transport)
  ) return undefined
  return { kind: 'canonical', operation, targetKey, transport }
}

const validatesAudioNamespace = (base: ProviderStateBase, identity: PersistedAudioIdentity): boolean => {
  if (identity.kind !== 'canonical' || (identity.operation !== 'tts-synthesis' && identity.operation !== 'comic-audio')) {
    return !(
      (base.result && (base.result['ttsAudio'] !== undefined || base.result['comicAudio'] !== undefined))
      || base.metadata['ttsAudio'] !== undefined
      || base.metadata['comicAudio'] !== undefined
    )
  }
  const operation = identity.operation
  const expectedNamespace = operation === 'tts-synthesis' ? 'ttsAudio' : 'comicAudio'
  const forbiddenNamespace = operation === 'tts-synthesis' ? 'comicAudio' : 'ttsAudio'
  if (
    !base.result
    || !hasOnlyKeys(base.result, [expectedNamespace])
    || !isRecord(base.result[expectedNamespace])
    || base.result[forbiddenNamespace] !== undefined
    || !isRecord(base.metadata[expectedNamespace])
    || canonicalManifestJson(base.result[expectedNamespace]) !== canonicalManifestJson(base.metadata[expectedNamespace])
    || base.metadata[forbiddenNamespace] !== undefined
  ) return false
  const projected = parseAudioProjectionStatus(base.result[expectedNamespace], identity.targetKey)
  return projected?.status === base.status && projected.attempts === base.attempts
}

export const parseProviderState = (
  rootDir: string,
  value: unknown
): PipelineProviderState | undefined => {
  const base = parseProviderStateBase(rootDir, value)
  if (!base) return undefined
  const identity = parsePersistedAudioIdentity(base)
  if (!identity || !validatesAudioNamespace(base, identity)) return undefined
  return {
    service: base.service,
    ...(base.model !== undefined ? { model: base.model } : {}),
    ...(base.local !== undefined ? { local: base.local } : {}),
    ...(identity.kind === 'canonical' ? { operation: identity.operation, targetKey: identity.targetKey, transport: identity.transport } : {}),
    artifactDir: base.artifactDir,
    status: base.status,
    attempts: base.attempts,
    options: base.options,
    metadata: base.metadata,
    ...(base.result ? { result: base.result } : {}),
    ...(base.error ? { error: base.error } : {}),
  }
}
