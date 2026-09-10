import { isAbsolute } from 'node:path'
import type { ComicRecoveryState } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { hasOnlyKeys, isSha256, isStrictArtifactRelativePath } from './guards'

export const isComicRecoveryState = (value: unknown): value is ComicRecoveryState => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['image', 'audio', 'presentation'])) return false
  return Object.values(value).every(intent => isRecord(intent)
    && hasOnlyKeys(intent, ['schemaVersion', 'flags', 'inputs', 'charactersRoot', 'planHash', 'completed', 'afterAudio', 'imageRunId'])
    && intent['schemaVersion'] === 1
    && typeof intent['completed'] === 'boolean'
    && typeof intent['charactersRoot'] === 'string' && isAbsolute(intent['charactersRoot'])
    && isSha256(intent['planHash'])
    && (intent['afterAudio'] === undefined || isSha256(intent['afterAudio']))
    && (intent['imageRunId'] === undefined || (typeof intent['imageRunId'] === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(intent['imageRunId'])))
    && isRecord(intent['flags'])
    && Object.values(intent['flags']).every(flag => typeof flag === 'string' || typeof flag === 'boolean' || (Array.isArray(flag) && flag.every(part => typeof part === 'string')))
    && Array.isArray(intent['inputs'])
    && intent['inputs'].every(ref => isRecord(ref) && hasOnlyKeys(ref, ['path', 'sha256']) && typeof ref['path'] === 'string'
      && (isAbsolute(ref['path']) || isStrictArtifactRelativePath(ref['path'])) && isSha256(ref['sha256'])))
}
