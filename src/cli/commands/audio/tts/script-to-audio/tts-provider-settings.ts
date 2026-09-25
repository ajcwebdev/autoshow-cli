import { recordSonioxResumeOptions } from '../tts-services/tts-soniox/soniox-resume-options'
import { recordGeminiResumeOptions } from '../tts-services/tts-gemini/gemini-resume-options'
import type { AttemptTurn, ProviderSettingsRecord, PureCurrentTtsRenderPlan, PureCurrentTtsRenderPlanOptions } from '~/types'
import { createProviderSettingsRecord } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'
import { recordSharedTtsResumeOptions } from '../tts-utils/tts-resume-options'
import { canonicalTtsJson } from './contract-identity'
import { buildProviderSerializerDescriptor } from './provider-serializer-registry'

const recordedVoice = (turn: AttemptTurn): Record<string, unknown> => ({
  voiceKind: turn.voice.kind,
  ...(turn.voice.value !== undefined ? { voice: turn.voice.value } : { voiceHash: turn.voice.valueHash }),
  ...(typeof turn.controls.values['referenceAssetSha256'] === 'string' ? { referenceAssetSha256: turn.controls.values['referenceAssetSha256'] } : {}),
  ...(turn.binding.kind === 'approved-snapshot' ? { voiceSnapshot: { snapshotId: turn.binding.snapshotId, entryId: turn.binding.entryId } } : {}),
})

const turnRequestSettings = (
  options: PureCurrentTtsRenderPlanOptions,
  plan: PureCurrentTtsRenderPlan,
  turn: AttemptTurn
): Record<string, unknown> => {
  const descriptor = buildProviderSerializerDescriptor(options.target, turn.voice.value ?? turn.voice.valueHash, turn.effectiveControls, plan.planned.strategy)
  return {
    ...recordedVoice(turn),
    endpointKind: descriptor.endpointKind,
    serializerVersion: descriptor.serializerVersion,
    controls: descriptor.controls,
  }
}

const buildRequest = (options: PureCurrentTtsRenderPlanOptions, plan: PureCurrentTtsRenderPlan): Record<string, unknown> => {
  const groups = new Map<string, { speakers: string[], settings: Record<string, unknown> }>()
  for (const turn of plan.planned.turns) {
    const settings = turnRequestSettings(options, plan, turn)
    const key = canonicalTtsJson(settings)
    const group = groups.get(key) ?? { speakers: [], settings }
    if (!group.speakers.includes(turn.canonical.originalSpeakerLabel)) group.speakers.push(turn.canonical.originalSpeakerLabel)
    groups.set(key, group)
  }
  const entries = [...groups.values()]
  const base = { model: options.target.model, strategy: plan.planned.strategy }
  return entries.length === 1 && entries[0]
    ? { ...base, ...entries[0].settings }
    : { ...base, speakers: entries.map((entry) => ({ speakers: entry.speakers, ...entry.settings })) }
}

const buildLocal = (options: PureCurrentTtsRenderPlanOptions, plan: PureCurrentTtsRenderPlan): Record<string, unknown> => {
  const tts = options.ttsOptions
  const delivery = tts.ttsDelivery
  const chunks = plan.planned.slots.flatMap(slot => slot.chunk ? [slot.chunk] : [])
  return {
    ttsResume: recordSharedTtsResumeOptions(tts),
    ...(options.target.service === 'soniox' ? { sonioxResume: recordSonioxResumeOptions(tts) } : {}),
    ...(options.target.service === 'gemini' ? { geminiResume: recordGeminiResumeOptions(tts) } : {}),
    audioProfile: delivery?.preset ?? 'legacy-16k',
    ...(delivery ? { delivery } : {}),
    chunking: {
      boundary: 'smart',
      policyVersion: chunks[0]?.policyVersion ?? tts.ttsChunking?.replay ?? 'smart-v2',
      ...(tts.ttsChunking?.maxChars !== undefined ? { requestedMaxChars: tts.ttsChunking.maxChars } : {}),
      ...(chunks.length ? { providerLimit: Math.min(...chunks.map(chunk => chunk.providerMaxChars)), effectiveMaxChars: Math.min(...chunks.map(chunk => chunk.effectiveMaxChars)) } : {}),
      requestCount: plan.planned.slots.length,
      requests: plan.planned.slots.map(slot => ({ generationSlotId: slot.generationSlotId, turnIds: slot.turnIds, ...(slot.timingSegmentIndex !== undefined ? { timingSegmentIndex: slot.timingSegmentIndex } : {}), characters: slot.providerText.length,
        ...(slot.chunk ? { sourceStart: slot.chunk.sourceStart, sourceEnd: slot.chunk.sourceEnd, boundaryAfter: slot.chunk.boundaryAfter, effectiveMaxChars: slot.chunk.effectiveMaxChars } : {}) })),
    },
    textPreflight: tts.ttsTextPreflight ?? true,
    ...(tts.ttsExport ? { export: tts.ttsExport } : {}),
    ...(tts.ttsPronunciationLexicon
      ? { pronunciationLexicon: { ...(tts.ttsPronunciationsPath ? { path: tts.ttsPronunciationsPath } : {}), sha256: tts.ttsPronunciationLexicon.lexiconSha256, ruleCount: tts.ttsPronunciationLexicon.rules.length } }
      : {}),
  }
}

const settingsByPlan = new WeakMap<PureCurrentTtsRenderPlan, ProviderSettingsRecord>()

// Provenance only: derived from the already-hashed plan and never fed back into slot, voice, or render identity.
export const ttsProviderSettings = (
  options: PureCurrentTtsRenderPlanOptions,
  plan: PureCurrentTtsRenderPlan
): ProviderSettingsRecord => {
  const cached = settingsByPlan.get(plan)
  if (cached) return cached
  const settings = createProviderSettingsRecord({
    service: options.target.service,
    operation: plan.operation,
    request: buildRequest(options, plan),
    local: buildLocal(options, plan),
  })
  settingsByPlan.set(plan, settings)
  return settings
}
