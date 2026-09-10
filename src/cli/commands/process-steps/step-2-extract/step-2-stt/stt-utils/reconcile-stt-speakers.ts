import type { TranscriptionEvidence, TranscriptionResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'

export const reconcileSttSpeakers = (result: TranscriptionResult, mapping: unknown): TranscriptionResult => {
  if (!isRecord(mapping) || Object.entries(mapping).some(([from, to]) => !from.trim() || typeof to !== 'string' || !to.trim())) throw ValidationError('Speaker map must be an object mapping existing speaker labels to nonempty canonical labels.')
  const labels = new Set([...result.segments, ...(result.evidence?.segments ?? []), ...(result.evidence?.words ?? [])].flatMap(entry => entry.speaker ? [entry.speaker] : []))
  for (const key of Object.keys(mapping)) if (!labels.has(key)) throw ValidationError(`Speaker map contains unknown label ${key}. Use the exact saved label, including its chunk or channel prefix.`)
  const replace = <T extends { speaker?: string | undefined }>(entry: T): T => ({ ...entry, ...(entry.speaker && typeof mapping[entry.speaker] === 'string' ? { speaker: (mapping[entry.speaker] as string).trim() } : {}) })
  const evidence = (source: TranscriptionEvidence): TranscriptionEvidence => ({ ...source,
    ...(source.words ? { words: source.words.map(replace) } : {}),
    ...(source.segments ? { segments: source.segments.map(replace) } : {}),
    ...(source.chunkEvidence ? { chunkEvidence: source.chunkEvidence.map(evidence) } : {})
  })
  return { ...result, segments: result.segments.map(replace), ...(result.evidence ? { evidence: evidence(result.evidence) } : {}) }
}
