import { mkdir } from 'node:fs/promises'
import type {
  CharacterVoiceBrief,
  PlannedCost,
  ProviderVoiceRef,
  TtsOptions,
  TtsTarget,
  VoiceAuditionCategory,
  VoiceAuditionItem,
  VoiceAuditionManifest,
  VoiceConsentRecord,
  VoiceRegistration,
} from '~/types'
import type { ProtectedVoiceAssetStore } from '../voice-assets/protected-voice-asset-store'
import { CLIUsageError } from '~/utils/error-handler'
import { collectTtsTargets } from '../tts-targets'
import { estimateTtsTargetCosts } from '../tts-utils/tts-pricing'
import { computeVoiceAuditionId, assertVoiceConsentAllows, validateVoiceAuditionManifest } from './voice-management-contracts'
import { hashCharacterVoiceBrief } from './character-voice-registry'
import { prepareElevenLabsDialogueText } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'

export type CanonicalVoiceAuditionPassage = {
  itemId: string
  category: VoiceAuditionCategory
  text: string
  delivery?: string | undefined
}

export type CanonicalVoiceAuditionPlan = {
  passages: CanonicalVoiceAuditionPassage[]
  takeCount: number
  characterCount: number
  estimatedCostCents: number
  plannedCost: PlannedCost
}

const COMPARISON_PASSAGE = 'Morning light crossed the quiet station while a distant bell marked the hour.'
const NEUTRAL_PASSAGE = 'This is my voice: clear, steady, and ready to tell the story.'

const pronunciationPassage = (brief: CharacterVoiceBrief): string => {
  const terms = brief.pronunciations.map(entry => entry.term)
  return terms.length > 0
    ? `Names and terms for this story include ${terms.join(', ')}.`
    : 'Names and places should remain clear, deliberate, and easy to understand.'
}

export const buildCanonicalVoiceAuditionPassages = (
  brief: CharacterVoiceBrief,
  representativeLine: string
): CanonicalVoiceAuditionPassage[] => {
  if (!representativeLine.trim()) throw CLIUsageError('Canonical voice audition requires a representative script line.')
  return [
    { itemId: 'neutral', category: 'neutral', text: NEUTRAL_PASSAGE },
    { itemId: 'representative', category: 'representative', text: representativeLine.trim(), ...(brief.defaultDelivery ? { delivery: brief.defaultDelivery } : {}) },
    { itemId: 'contrast-calm', category: 'emotional-delivery', text: 'Stay close. We can solve this together.', delivery: 'quiet reassurance' },
    { itemId: 'contrast-urgent', category: 'emotional-delivery', text: 'Move now—the door is closing!', delivery: 'controlled urgency' },
    { itemId: 'pronunciation', category: 'pronunciation', text: pronunciationPassage(brief) },
    { itemId: 'comparison', category: 'comparison', text: COMPARISON_PASSAGE }
  ]
}

const voiceId = (voice: ProviderVoiceRef): string => {
  if (voice.kind === 'remote-resource') return voice.resourceId
  if (voice.kind === 'shared-library-resource') return voice.sharedVoiceId
  if (voice.kind === 'local-model-voice') return voice.voiceLocator
  throw CLIUsageError('Canonical audition currently requires a materialized saved, stock, shared, or local-model voice; request references must first be saved by voice management.')
}

const targetOptions = (registration: VoiceRegistration): TtsOptions => {
  const voice = voiceId(registration.provisioning.state === 'ready'
    ? registration.provisioning.providerVoice
    : (() => { throw CLIUsageError('Canonical audition requires a ready voice registration.') })())
  const model = registration.providerModel
  switch (registration.provider) {
    case 'kitten': return { kittenTtsModels: [model], ttsSpeaker: voice }
    case 'elevenlabs': return { elevenlabsTtsModels: [model], elevenlabsVoiceId: voice }
    case 'minimax': return { minimaxTtsModels: [model], minimaxTtsVoice: voice }
    case 'groq': return { groqTtsModels: [model], groqVoiceId: voice }
    case 'grok': return { grokTtsModels: [model], grokTtsVoice: voice }
    case 'mistral': return { mistralTtsModels: [model], mistralTtsVoice: voice }
    case 'openai': return { openaiTtsModels: [model], openaiVoiceId: voice }
    case 'gemini': return { geminiTtsModels: [model], geminiVoiceId: voice }
    case 'deepgram': return { deepgramTtsModels: [model], deepgramVoiceId: voice }
    case 'speechify': return { speechifyTtsModels: [model], speechifyVoice: voice }
    case 'hume': return { humeTtsModels: [model], humeTtsVoice: voice }
    case 'cartesia': return { cartesiaTtsModels: [model], cartesiaTtsVoice: voice }
    case 'fish': return { fishTtsModels: [model], fishTtsVoice: voice }
    case 'inworld': return { inworldTtsModels: [model], inworldTtsVoice: voice }
    case 'deepinfra': return { deepinfraTtsModels: [model], deepinfraTtsVoice: voice }
    case 'replicate': return { replicateTtsModels: [model], replicateTtsVoice: voice }
  }
}

const requireSingleTarget = (registration: VoiceRegistration): { target: TtsTarget, options: TtsOptions } => {
  const options = targetOptions(registration)
  const targets = collectTtsTargets(options)
  if (targets.length !== 1 || targets[0]?.service !== registration.provider || targets[0].model !== registration.providerModel) {
    throw CLIUsageError('Canonical audition did not resolve exactly one matching provider/model target.')
  }
  return { target: targets[0], options }
}

export const planCanonicalVoiceAudition = (
  registration: VoiceRegistration,
  brief: CharacterVoiceBrief,
  representativeLine: string,
  takeCount = 1
): CanonicalVoiceAuditionPlan => {
  if (!Number.isInteger(takeCount) || takeCount < 1 || takeCount > 5) throw CLIUsageError('Canonical audition take count must be between 1 and 5.')
  if (brief.subjectKey !== registration.subjectKey || brief.profileKey !== registration.profileKey || hashCharacterVoiceBrief(brief) !== registration.briefHash) throw CLIUsageError('Canonical audition brief does not match the exact registration brief identity.')
  const passages = buildCanonicalVoiceAuditionPassages(brief, representativeLine)
  const characterCount = passages.reduce((sum, passage) => sum + [...passage.text].length, 0) * takeCount
  const { target } = requireSingleTarget(registration)
  const estimates = estimateTtsTargetCosts([target], characterCount)
  const estimatedCostCents = estimates.reduce((sum, estimate) => sum + estimate.totalCost, 0)
  return { passages, takeCount, characterCount, estimatedCostCents, plannedCost: { amounts: [{ amount: estimatedCostCents / 100, currency: 'USD' }] } }
}

export const runCanonicalVoiceAudition = async (input: {
  registration: VoiceRegistration
  brief: CharacterVoiceBrief
  representativeLine: string
  protectedStore: ProtectedVoiceAssetStore
  consent?: VoiceConsentRecord | undefined
  takeCount?: number | undefined
  maxCents?: number | undefined
  now?: string | undefined
}): Promise<VoiceAuditionManifest> => {
  const registration = input.registration
  if (registration.approval.state !== 'draft' || registration.provisioning.state !== 'ready') throw CLIUsageError('Canonical audition requires a ready draft registration.')
  if (registration.consentRecordRef) assertVoiceConsentAllows(input.consent, 'new-synthesis')
  const plan = planCanonicalVoiceAudition(registration, input.brief, input.representativeLine, input.takeCount ?? 1)
  if (input.maxCents !== undefined && plan.estimatedCostCents > input.maxCents) throw CLIUsageError(`Canonical audition estimate ${plan.estimatedCostCents.toFixed(4)} cents exceeds --max-cents ${input.maxCents}.`)
  if (!input.protectedStore.withWorkspace || !input.protectedStore.storeBytes) throw CLIUsageError('Canonical audition requires a managed protected store with workspaces.')
  const { target, options } = requireSingleTarget(registration)
  const providerVoice = registration.provisioning.providerVoice
  const providerVoiceId = voiceId(providerVoice)
  const createdAt = input.now ?? new Date().toISOString()
  const items: VoiceAuditionItem[] = []
  await input.protectedStore.withWorkspace(`audition-${registration.registrationId}`, async workspace => {
    for (const passage of plan.passages) {
      const takes: VoiceAuditionItem['takes'] = []
      const providerText = registration.provider === 'elevenlabs' && registration.providerModel === 'eleven_v3'
        ? prepareElevenLabsDialogueText(passage.text, passage.delivery).providerText
        : passage.text
      const deliveryUnsupported = Boolean(passage.delivery && registration.provider === 'hume' && registration.providerModel === 'octave-2')
      for (let takeIndex = 0; takeIndex < plan.takeCount; takeIndex += 1) {
        if (registration.provider === 'hume' && (items.length > 0 || takeIndex > 0)) {
          await new Promise(resolve => setTimeout(resolve, 7000))
        }
        const takeId = `${passage.itemId}-${takeIndex + 1}`
        const outputDir = `${workspace}/${takeId}`
        await mkdir(outputDir, { recursive: true })
        const result = await target.run(providerText, outputDir, options, {
          sourceId: `audition:${registration.registrationId}:${passage.itemId}:${takeIndex + 1}`,
          sourceIndex: takeIndex,
          speaker: registration.subjectKey,
          voice: { kind: 'id', value: providerVoiceId },
          controls: Object.freeze({
            ...registration.synthesisSettings.values,
            ...(passage.delivery && registration.provider === 'hume' && registration.providerModel === 'octave-1' ? { description: passage.delivery } : {})
          })
        })
        const bytes = new Uint8Array(await Bun.file(result.audioPath).arrayBuffer())
        const protectedAudio = await input.protectedStore.storeBytes!(bytes, {
          schemaVersion: 1,
          purpose: 'audition-audio',
          authorizationRef: `voice-audition:${registration.registrationId}`,
          retention: { mode: 'retain-until-revoked', ...(registration.retention.obligationRef ? { obligationRef: registration.retention.obligationRef } : {}) },
          ...(registration.consentRecordRef ? { consentRecordRef: registration.consentRecordRef } : {}),
          createdAt
        })
        takes.push({
          takeId,
          protectedAudio,
          sha256: protectedAudio.sha256,
          cost: {
            amounts: estimateTtsTargetCosts([target], [...passage.text].length).map(estimate => ({
              amount: estimate.totalCost / 100,
              currency: 'USD'
            }))
          },
          warnings: deliveryUnsupported ? ['Hume Octave 2 does not serialize acting descriptions; this audition take retains the canonical delivery as unsupported evidence.'] : []
        })
      }
      items.push({
        itemId: passage.itemId,
        category: passage.category,
        canonicalText: passage.text,
        providerText,
        ...(passage.delivery ? { delivery: passage.delivery } : {}),
        takes,
        selectedTakeId: takes[0]!.takeId
      })
    }
  })
  const withoutId = {
    schemaVersion: 1 as const,
    registrationDraftId: registration.registrationId,
    provider: registration.provider,
    providerModel: registration.providerModel,
    providerVoice,
    capabilityFixtureHash: registration.capabilityFixtureHash,
    settingsSchema: registration.settingsSchema,
    synthesisSettings: registration.synthesisSettings,
    items,
    plannedCost: plan.plannedCost,
    warnings: [],
    createdAt
  }
  const manifest: VoiceAuditionManifest = { ...withoutId, auditionId: computeVoiceAuditionId(withoutId) }
  return validateVoiceAuditionManifest(manifest)
}
