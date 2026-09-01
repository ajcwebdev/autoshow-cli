import type { AnyCapabilityRecord, AttemptTurn, CanonicalDialogueTurn, CapabilityFixture, ComicDialoguePlan, CreateCurrentTtsRenderAttemptOptions, GenericTtsDialoguePlan, PlannedCost, ProtectedAssetRef, ProviderRenderStrategy, ResolvedVoiceBinding, SanitizedProviderError, TtsTarget, TypedProviderSynthesisSettings } from '~/types'
import { getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { ELEVENLABS_DEFAULT_VOICE_ID, SPEECHIFY_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError, extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { parseRetryAfterMs } from '~/utils/retries'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateCapabilityFacetSet } from './contract-validation'
import { CAPABILITY_CHECKED_AT, CAPABILITY_SOURCE_REFS, EPOCH, REQUESTED_OUTPUT, withIdentity } from './attempt-shared'
import { chunkLimit } from './comic-segmented-audio'

export const sanitizeError = (error: unknown, phase: SanitizedProviderError['phase']): SanitizedProviderError => {
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? sanitizeLogText(metadata['stage']).slice(0, 160) : undefined
  const errorName = error instanceof Error && error.name ? sanitizeLogText(error.name).slice(0, 120) : undefined
  const providerMessage = error instanceof Error && error.message
    ? sanitizeLogText(error.message).replace(/\s+/gu, ' ').trim().slice(0, 600)
    : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const requestId = headers?.get('x-request-id') ?? headers?.get('request-id') ?? headers?.get('cf-ray') ?? undefined
  const retryAfterMs = parseRetryAfterMs(headers)
  const explicitRetryable = typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined
  const message = status !== undefined
    ? `TTS provider request failed with HTTP status ${status}.`
    : phase === 'static-validation'
      ? 'TTS target validation failed before provider dispatch.'
      : phase === 'readiness'
        ? 'TTS execution readiness failed before provider dispatch.'
        : phase === 'admission'
          ? 'TTS provider request admission failed.'
          : phase === 'selection'
            ? 'TTS take selection failed.'
            : phase === 'assembly'
              ? 'TTS audio assembly failed.'
              : phase === 'reconciliation'
                ? 'TTS retained provider evidence reconciliation failed.'
                : 'TTS provider synthesis failed.'
  const retryable = explicitRetryable ?? (status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500))
  return {
    phase,
    code: status ? `http_${status}` : typeof metadata['code'] === 'string' ? sanitizeLogText(metadata['code']).slice(0, 120) : 'tts_target_failed',
    message,
    retryable,
    ...(status !== undefined ? { status } : {}),
    ...(stage ? { stage } : {}),
    ...(errorName ? { errorName } : {}),
    ...(providerMessage ? { providerMessage } : {}),
    ...(requestId ? { requestId: sanitizeLogText(requestId).slice(0, 200) } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
  }
}

export const plannedCost = (target: TtsTarget, characters: number, includeSetup: boolean): PlannedCost => {
  const pricing = getTtsPricing(target.service, target.model)
  const cents = pricing.costPerRequestCents !== undefined
    ? pricing.costPerRequestCents
    : pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    ? characters / 1e6 * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents)
    : characters / 1000 * (pricing.costPer1kCharsCents ?? 0)
  const totalCents = cents + (includeSetup ? target.setupCostCents ?? 0 : 0)
  return totalCents === 0 ? { amounts: [] } : { amounts: [{ amount: totalCents / 100, currency: 'USD' }] }
}

export const buildCapabilityFixture = (
  target: TtsTarget,
  transport: string,
  strategy: ProviderRenderStrategy
): CapabilityFixture => {
  const feature = strategy === 'native-dialogue'
    ? 'native-dialogue' as const
    : strategy === 'native-utterances'
      ? 'native-utterances' as const
      : 'turn-synthesis' as const
  const scope = { provider: target.service, feature, model: target.model, transport }
  const documentationEvidence = withIdentity({
    checkedAt: CAPABILITY_CHECKED_AT,
    sourceRefs: CAPABILITY_SOURCE_REFS[target.service]
  }, 'evidenceHash')
  const hasProtectedSpeakerAssets = Object.keys(target.protectedSpeakerVoiceAssets ?? {}).length > 0
  const voiceKinds = target.protectedVoiceAsset
    ? ['reference-asset' as const]
    : hasProtectedSpeakerAssets
      ? ['provider-id' as const, 'reference-asset' as const]
      : ['provider-id' as const]
  const constraints = feature === 'native-dialogue'
    ? target.service === 'elevenlabs'
      ? { voiceKinds, maxCharacters: 2000, supportedOutputFormats: ['mp3', 'wav', 'pcm'], minSpeakers: 1, maxSpeakers: 10 }
      : { voiceKinds, maxCharacters: chunkLimit(target), supportedOutputFormats: ['wav'], minSpeakers: 2, maxSpeakers: 2 }
    : feature === 'native-utterances'
      ? { voiceKinds, maxCharacters: target.service === 'hume' ? 5000 : chunkLimit(target), supportedOutputFormats: ['mp3', 'wav', 'pcm'], maxTakesPerRequest: target.service === 'hume' ? 5 : 1 }
      : { voiceKinds, maxCharacters: chunkLimit(target), supportedOutputFormats: ['wav'] }
  const record = {
    scope,
    maturity: target.service === 'grok' ? 'preview' as const : 'stable' as const,
    channel: 'api' as const,
    adapterSupport: 'implemented' as const,
    requirements: [],
    constraints,
    documentationEvidence
  } as AnyCapabilityRecord
  validateCapabilityFacetSet([record])
  const base = { schemaVersion: 1 as const, records: [record] }
  return {
    ...base,
    capabilityFixtureHash: hashCanonicalTtsValue(base),
    capabilityScopeHash: hashCanonicalTtsValue(scope)
  }
}

export const voiceBinding = (target: TtsTarget, kind: AttemptTurn['voice']['kind'], value: string, settings: TypedProviderSynthesisSettings, capabilityFixtureHash: string, protectedAsset?: ProtectedAssetRef | undefined): { voice: AttemptTurn['voice'], binding: Extract<ResolvedVoiceBinding, { kind: 'transient-provider-voice' }> } => {
  const activeProtectedAsset = protectedAsset ?? target.protectedVoiceAsset
  const valueHash = kind === 'reference-asset' ? activeProtectedAsset?.sha256 ?? sha256Bytes(value) : sha256Bytes(value)
  const voice = { kind, ...(kind === 'reference-asset' ? {} : { value }), valueHash }
  const providerVoice = kind === 'reference-asset'
    ? activeProtectedAsset
      ? { kind: 'reference-asset' as const, provider: target.service, protectedAsset: activeProtectedAsset, origin: 'request-reference-audio' as const, authorizationRef: 'explicit-cli:mistral-request-reference-v1' }
      : (() => { throw UsageError('Reference-audio synthesis requires a protected asset before render planning.') })()
    : kind === 'local-model-voice'
      ? { kind: 'local-model-voice' as const, provider: target.service, model: target.model, voiceLocator: value, origin: 'local-model-voice' as const }
      : { kind: 'remote-resource' as const, provider: target.service, resourceId: value, namespace: 'provider' as const, origin: 'provider-stock' as const, ownership: 'provider' as const, deletion: { state: 'provider-managed' as const, checkedAt: EPOCH } }
  const identityHash = hashCanonicalTtsValue({ providerVoice, providerModel: target.model, synthesisSettings: settings })
  return {
    voice,
    binding: { kind: 'transient-provider-voice', providerVoice, providerModel: target.model, identityHash, settingsSchema: settings.settingsSchema, synthesisSettings: settings, capabilityFixtureHash }
  }
}

export const flattenPlanTurns = (plan: GenericTtsDialoguePlan | ComicDialoguePlan): CanonicalDialogueTurn[] =>
  plan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)

export const bindingIdentityHash = (binding: ResolvedVoiceBinding): string =>
  binding.kind === 'approved-snapshot' ? binding.entryHash : binding.identityHash

export const sumCosts = (costs: readonly PlannedCost[]): PlannedCost => {
  const amounts = new Map<string, number>()
  for (const cost of costs) for (const entry of cost.amounts) amounts.set(entry.currency, (amounts.get(entry.currency) ?? 0) + entry.amount)
  return { amounts: [...amounts].sort(([left], [right]) => left.localeCompare(right)).map(([currency, amount]) => ({ currency, amount })) }
}

export const requestedOutput = (options: Pick<CreateCurrentTtsRenderAttemptOptions, 'ttsOptions'>) => options.ttsOptions.ttsMasteringProfile
  ? {
      codec: options.ttsOptions.ttsMasteringProfile.codec,
      container: options.ttsOptions.ttsMasteringProfile.container,
      sampleRate: options.ttsOptions.ttsMasteringProfile.sampleRate,
      channels: options.ttsOptions.ttsMasteringProfile.channels,
    }
  : REQUESTED_OUTPUT

export const defaultVoiceValue = (target: TtsTarget): string => {
  switch (target.service) {
    case 'openai': return 'alloy'
    case 'grok': return 'eve'
    case 'minimax': return 'English_expressive_narrator'
    case 'hume': return 'Male English Actor'
    case 'cartesia': return 'f786b574-daa5-4673-aa0c-cbe3e8534c02'
    case 'elevenlabs': return ELEVENLABS_DEFAULT_VOICE_ID
    case 'speechify': return SPEECHIFY_DEFAULT_TTS_VOICE
    default: return 'provider-default'
  }
}
