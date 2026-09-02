import type { DesignProviderName } from '~/types'
import { UsageError } from '~/utils/error-handler'

type VoiceDesignRequestInput = Readonly<{
  provider: DesignProviderName
  creationModel: string
  description: string
  previewText: string
  candidateCount: number
  sourceVoiceId?: string | undefined
  eligibilitySnapshotHash?: string | undefined
  seedRaw?: string | undefined
}>

export type ValidatedVoiceDesignRequest = Omit<VoiceDesignRequestInput, 'seedRaw'> & Readonly<{
  seed?: number | undefined
}>

export const validateVoiceDesignRequest = (input: VoiceDesignRequestInput): ValidatedVoiceDesignRequest => {
  const { provider, creationModel, description, previewText, candidateCount, sourceVoiceId, eligibilitySnapshotHash } = input
  if ((sourceVoiceId || eligibilitySnapshotHash) && provider !== 'elevenlabs') throw UsageError('Voice remix is supported only by the ElevenLabs advanced adapter.')
  if ((sourceVoiceId && !eligibilitySnapshotHash) || (!sourceVoiceId && eligibilitySnapshotHash)) throw UsageError('ElevenLabs remix requires both --source-voice-id and --eligibility-snapshot-hash.')
  if (eligibilitySnapshotHash && !/^[a-f0-9]{64}$/.test(eligibilitySnapshotHash)) throw UsageError('--eligibility-snapshot-hash must be a lowercase SHA-256 digest.')
  const seed = input.seedRaw === undefined ? undefined : Number(input.seedRaw)
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0)) throw UsageError('--seed must be a non-negative integer.')
  if (provider === 'elevenlabs') {
    if (creationModel !== 'eleven_ttv_v3' && creationModel !== 'eleven_multilingual_ttv_v2') throw UsageError('ElevenLabs Voice Design creation model must be eleven_ttv_v3 or eleven_multilingual_ttv_v2; synthesis model IDs such as eleven_v3 are not design model IDs.')
    if (candidateCount > 3) throw UsageError('ElevenLabs Voice Design supports one to three bounded previews per operation.')
    if (description.length < 20 || description.length > 1000) throw UsageError('ElevenLabs Voice Design description must contain 20-1000 characters.')
    if (previewText.length < 100 || previewText.length > 1000) throw UsageError('ElevenLabs Voice Design preview text must contain 100-1000 characters.')
  } else if (provider === 'inworld') {
    if (creationModel !== 'realtime-tts-2') throw UsageError('Inworld Voice Design creation model must be realtime-tts-2.')
    if (candidateCount > 3) throw UsageError('Inworld Voice Design supports one to three bounded previews per request.')
    if (description.length < 30 || description.length > 250) throw UsageError('Inworld Voice Design description must contain 30-250 characters.')
    if (!previewText.trim()) throw UsageError('Inworld Voice Design preview text cannot be blank.')
    if (seed !== undefined) throw UsageError('Inworld Voice Design does not expose a deterministic seed.')
  } else if (provider === 'hume') {
    if (creationModel !== 'octave-1') throw UsageError('Hume Voice Design creation model must be octave-1.')
    if (candidateCount > 5) throw UsageError('Hume Voice Design supports one to five bounded previews per request.')
    if (!description.trim() || description.length > 1000) throw UsageError('Hume Voice Design description must contain 1-1000 characters.')
    if (!previewText.trim()) throw UsageError('Hume Voice Design preview text cannot be blank.')
    if (seed !== undefined) throw UsageError('Hume Voice Design does not expose a deterministic seed.')
  }
  return { provider, creationModel, description, previewText, candidateCount, sourceVoiceId, eligibilitySnapshotHash, seed }
}
