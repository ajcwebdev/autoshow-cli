import type { AttemptTurn } from '~/types'
import { isGeminiPrebuiltVoice, validateGeminiTurns, type GeminiSpeechTurn } from './gemini-tts-request'

export const geminiTurnFromAttempt = (turn: AttemptTurn): GeminiSpeechTurn => ({ text: turn.canonical.canonicalText, speaker: turn.canonical.originalSpeakerLabel, voice: turn.voice.value!, style: turn.effectiveControls['instructions'] as string | undefined })
export const geminiNativeEligible = (model: string, turns: readonly AttemptTurn[], defaultFormat = 'wav'): boolean => {
  const voices = new Map(turns.map(t => [t.canonical.originalSpeakerLabel, t.voice.value]))
  if (voices.size !== 2 || [...voices.values()].some(v => !v || !isGeminiPrebuiltVoice(v))) return false
  if (turns.some(t => t.canonical.effect || t.canonical.timingCues?.length)) return false
  if (new Set(turns.map(t => t.effectiveControls['responseFormat'] ?? defaultFormat)).size > 1) return false
  try { for (const turn of turns) validateGeminiTurns(model, [geminiTurnFromAttempt(turn)]) } catch { return false }
  return true
}
export const groupGeminiTurns = <T extends GeminiSpeechTurn>(model: string, turns: readonly T[]): T[][] => {
  const groups: T[][] = []; let current: T[] = []
  for (const turn of turns) {
    validateGeminiTurns(model, [turn])
    try { validateGeminiTurns(model, [...current, turn]) } catch { groups.push(current); current = [] }
    current.push(turn)
  }
  if (current.length) groups.push(current)
  return groups
}
export const planGeminiNativeGroups = (model: string, turns: readonly AttemptTurn[], speakerLabels?: Readonly<Record<string, string>>) => groupGeminiTurns(model, turns.map(t => ({ ...geminiTurnFromAttempt(t), speaker: speakerLabels?.[t.canonical.turnId] ?? t.canonical.originalSpeakerLabel, turnId: t.canonical.turnId }))).map(group => ({ turnIds: group.map(t => t.turnId), providerTexts: [group.map(t => `${t.speaker}: ${t.text}`).join('\n')] }))
export const geminiRequestControls = (instructions: string | undefined, format: string | undefined, mode = 'unary') => ({ ...(instructions ? { instructions } : {}), responseFormat: format ?? (mode === 'stream' ? 'pcm' : 'wav'), mode })
