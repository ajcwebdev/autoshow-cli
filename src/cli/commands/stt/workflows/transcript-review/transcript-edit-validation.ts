import type { TranscriptionEvidenceWord } from '~/types'
import { ValidationError } from '~/utils/error-handler'

export type TranscriptEdit = { startWord: number; deleteCount: number; expectedText: string; replacement: string; reason: string }

const isInvalidTranscriptEditPacket = (packet: unknown, sourceSha256: string): boolean =>
  !packet || typeof packet !== 'object' || !('sourceSha256' in packet) || packet.sourceSha256 !== sourceSha256 || !('schemaVersion' in packet) || packet.schemaVersion !== 1 || !('edits' in packet) || !Array.isArray(packet.edits)

const hasInvalidEditFields = (edit: TranscriptEdit, words: TranscriptionEvidenceWord[]): boolean =>
  !Number.isInteger(edit.startWord) || edit.startWord < 0 || !Number.isInteger(edit.deleteCount) || edit.deleteCount < 1 || edit.startWord + edit.deleteCount > words.length
  || typeof edit.expectedText !== 'string' || typeof edit.replacement !== 'string' || typeof edit.reason !== 'string' || !edit.reason.trim()

export const parseTranscriptEdits = (packet: unknown, sourceSha256: string, words: TranscriptionEvidenceWord[]): TranscriptEdit[] => {
  if (isInvalidTranscriptEditPacket(packet, sourceSha256)) throw ValidationError('Transcript edit file must have schemaVersion 1, matching sourceSha256, and an edits array.')
  const edits: TranscriptEdit[] = []
  for (const entry of (packet as { edits: unknown[] }).edits) {
    if (!entry || typeof entry !== 'object') throw ValidationError('Invalid transcript edit.')
    const edit = entry as TranscriptEdit
    if (hasInvalidEditFields(edit, words)) throw ValidationError('Each edit requires an in-range startWord/deleteCount, expectedText, replacement, and nonempty reason.')
    if (words.slice(edit.startWord, edit.startWord + edit.deleteCount).map(word => word.text).join(' ') !== edit.expectedText) throw ValidationError(`Transcript edit at word ${edit.startWord} does not match expectedText.`)
    edits.push(edit)
  }
  edits.sort((a, b) => a.startWord - b.startWord)
  if (edits.some((edit, index) => index > 0 && edit.startWord < edits[index - 1]!.startWord + edits[index - 1]!.deleteCount)) throw ValidationError('Transcript edits must not overlap.')
  return edits
}
