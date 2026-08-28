import { realpath } from 'node:fs/promises'
import type { DialogueNormalization, GenericTtsDialoguePlan, GenericTtsSourceBytes, GenericTtsSourceIdentity, TtsOptions } from '~/types'
import { toPosixPath, toProjectDisplayPath } from '~/utils/runtime-paths'
import { normalizeDialogueFromOptions } from '../dialogue-normalizer'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'

const canonicalSourcePath = async (inputPath: string): Promise<string> =>
  toPosixPath(toProjectDisplayPath(await realpath(inputPath)))

const withIdentity = <T extends Record<string, unknown>, K extends string>(
  value: T,
  identityField: K
): T & Record<K, string> => ({ ...value, [identityField]: hashCanonicalTtsValue(value) }) as T & Record<K, string>

export const createFileTtsSourceIdentity = async (
  inputPath: string,
  content: GenericTtsSourceBytes
): Promise<GenericTtsSourceIdentity> => {
  const canonicalPath = await canonicalSourcePath(inputPath)
  return withIdentity({
    schemaVersion: 1 as const,
    sourceKind: 'file' as const,
    sourceLocator: { kind: 'file' as const, canonicalPath },
    contentSha256: sha256Bytes(content)
  }, 'identityHash')
}

export const createInlineTtsSourceIdentity = (
  content: string
): GenericTtsSourceIdentity => withIdentity({
  schemaVersion: 1 as const,
  sourceKind: 'inline' as const,
  sourceLocator: { kind: 'inline' as const, label: 'inline' as const },
  contentSha256: sha256Bytes(content)
}, 'identityHash')

export const createBatchItemTtsSourceIdentity = async (
  batchPath: string,
  itemIndex: number,
  content: GenericTtsSourceBytes
): Promise<GenericTtsSourceIdentity> => {
  const canonicalBatchPath = await canonicalSourcePath(batchPath)
  return withIdentity({
    schemaVersion: 1 as const,
    sourceKind: 'batch-item' as const,
    sourceLocator: { kind: 'batch-item' as const, canonicalBatchPath, itemIndex },
    contentSha256: sha256Bytes(content)
  }, 'identityHash')
}

const buildDialoguePlan = (
  sourceIdentity: GenericTtsSourceIdentity,
  dialogue: DialogueNormalization,
  createdAt: string
): GenericTtsDialoguePlan => withIdentity({
  schemaVersion: 1 as const,
  sourceIdentity,
  normalizationVersion: 'generic-tts-dialogue-v1',
  createdAt,
  nodes: dialogue.turns.map((turn, index) => ({
    kind: 'turn' as const,
    turn: {
      turnId: `dialogue-turn-${String(index + 1).padStart(3, '0')}`,
      sourceSegmentId: `generic-tts:${index}`,
      subjectKey: turn.speaker,
      originalSpeakerLabel: turn.speaker,
      canonicalText: turn.text,
      ...(turn.delivery
        ? {
            delivery: {
              kind: 'source' as const,
              description: turn.delivery.sourceText
            }
          }
        : {})
    }
  }))
}, 'dialoguePlanId')

export const createGenericTtsDialoguePlan = (
  sourceIdentity: GenericTtsSourceIdentity,
  text: string,
  options: TtsOptions,
  createdAt = new Date().toISOString()
): GenericTtsDialoguePlan => buildDialoguePlan(
  sourceIdentity,
  normalizeDialogueFromOptions(text, options),
  createdAt
)

export const createSingleTurnTtsDialoguePlan = (
  sourceIdentity: GenericTtsSourceIdentity,
  text: string,
  createdAt = new Date().toISOString()
): GenericTtsDialoguePlan => buildDialoguePlan(sourceIdentity, {
  turns: [{ speaker: 'NARRATOR', text }],
  normalizedText: `NARRATOR: ${text}`,
  spokenCharacterCount: text.length
}, createdAt)
