import { join } from 'node:path'
import type { CliCommandContext } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { assertProtectedStoreOutputDisjoint } from '../voice-assets/protected-output-boundary'
import { UsageError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { planAdvancedClone, provisionAdvancedVoiceClone } from './advanced-voice-management'
import { loadVoiceRegistrationCatalog } from './character-voice-registry'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { loadVoiceConsentRecord } from './voice-consent-store'
import { assertVoiceConsentAllows } from './voice-management-contracts'
import { provisionMistralSavedReferenceRegistration } from './voice-registration-management'
import {
  CLONE_PROVIDERS, PROFILE_DEFAULT, advancedCapabilityFixtureHash,
  advancedProvider, cloneFileExtension, cloneMediaType, isCloneProvider, maybeCompleteRegistrationJournal, optionalFlag,
  parameter, providerFlag, repeatableFlag, reportVoicePrice, reportVoiceResult, requireBrief,
  requiredFlag, requireVoiceModel
} from './voice-command-support'

export const handleClone = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isCloneProvider(provider)) {
    if (provider === 'hume') throw UsageError('Hume voice cloning is performed in the Hume platform. Clone there, then register the resulting custom voice with voice import.')
    if (provider === 'openai') throw UsageError('OpenAI voice cloning is deferred because creation requires a separate consent resource and the API does not expose matching catalog, inspection, and deletion operations.')
    if (provider === 'speechify') throw UsageError('Speechify voice cloning is deferred because the current workflow requires a challenge phrase and a separate consent recording.')
    throw UsageError(`Voice clone supports ${CLONE_PROVIDERS.join(', ')}; ${provider} has no API cloning capability in this release.`)
  }
  const providerModel = requireVoiceModel(provider, requiredFlag(ctx, 'model'))
  const profileKey = optionalFlag(ctx, 'profile') ?? PROFILE_DEFAULT
  if (ctx.flags['price'] !== true) {
    const catalog = await loadVoiceRegistrationCatalog(getCharactersRoot())
    for (const match of catalog.registrations.filter(entry => entry.subjectKey === subjectKey && entry.provider === provider && entry.profileKey === profileKey)) {
      const completed = await maybeCompleteRegistrationJournal(match, ctx)
      if (completed) {
        reportVoiceResult('Voice provisioning reconciled', { registrationId: completed.registrationId, generationId: completed.generationId, state: completed.provisioning.state })
        return
      }
    }
  }
  const samplePaths = repeatableFlag(ctx, 'sample')
  if (samplePaths.length === 0) throw UsageError(`${provider} instant voice clone requires at least one --sample.`)
  if ((provider === 'cartesia' || provider === 'minimax' || provider === 'grok' || provider === 'mistral') && samplePaths.length !== 1) throw UsageError(`${provider} instant voice clone requires exactly one --sample.`)
  const consentRecordRef = requiredFlag(ctx, 'consent-ref')
  const consent = await loadVoiceConsentRecord(managedVoiceAssetStore, consentRecordRef)
  if (consent.subjectKey !== subjectKey) throw UsageError('Voice clone consent subject does not match the requested subject.')
  assertVoiceConsentAllows(consent, 'upload')
  assertVoiceConsentAllows(consent, 'new-synthesis')
  const authorizationRef = requiredFlag(ctx, 'authorization-ref')
  const planned = await Promise.all(samplePaths.map(sourcePath => managedVoiceAssetStore.plan({ sourcePath, authorizationRef, speakerKey: subjectKey })))
  const request = {
    cloneKind: 'instant',
    desiredName: requiredFlag(ctx, 'voice-name'),
    localAttemptId: 'price-plan',
    protectedSamples: planned.map(item => item.protectedAsset),
    consentRecordRef,
    provenanceRef: requiredFlag(ctx, 'provenance-ref'),
    ...(optionalFlag(ctx, 'description') ? { description: optionalFlag(ctx, 'description') } : {}),
  } as const
  if (ctx.flags['price'] === true) {
    const estimate = planAdvancedClone(request)
    reportVoicePrice('Voice clone estimate', { operation: 'voice-clone', provider, providerModel, cloneKind: 'instant', sampleCount: samplePaths.length, ...estimate, mutation: false, providerCalls: 0 })
    return
  }
  const brief = await requireBrief(subjectKey, profileKey)
  if (provider === 'mistral') {
    const registration = await provisionMistralSavedReferenceRegistration({
      charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), protectedStore: managedVoiceAssetStore,
      subjectKey, profileKey, providerModel, voiceName: request.desiredName, sourcePath: samplePaths[0]!, authorizationRef,
      brief, provenanceRef: request.provenanceRef, consent, consentRecordRef, capabilityFixtureHash: advancedCapabilityFixtureHash('mistral'),
      apiKey: resolveCredential('mistral', 'require', { stage: 'voice:mistral', description: 'Mistral voice clone' })
    })
    reportVoiceResult('Voice clone provisioned', { registrationId: registration.registrationId, generationId: registration.generationId, state: registration.provisioning.state })
    return
  }
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  if (!managedVoiceAssetStore.ingestManaged) throw UsageError('Managed protected store cannot retain clone samples.')
  const createdAt = new Date().toISOString()
  const protectedSamples = await Promise.all(samplePaths.map(async (sourcePath, index) => (await managedVoiceAssetStore.ingestManaged!({ sourcePath, authorizationRef, speakerKey: subjectKey }, {
    schemaVersion: 1, purpose: 'reference-audio', authorizationRef, retention: { mode: 'retain-until-revoked', obligationRef: request.provenanceRef }, consentRecordRef, createdAt,
  }, planned[index]?.protectedAsset)).protectedAsset))
  const resolveProtectedAsset = async (asset: typeof protectedSamples[number]) => {
      const path = await managedVoiceAssetStore.resolve(asset)
      const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
      const mediaType = cloneMediaType(path, bytes)
      return { bytes, fileName: `clone-sample-${asset.assetId}.${cloneFileExtension(mediaType)}`, mediaType }
  }
  const resolveDurationProtectedAsset = async (asset: typeof protectedSamples[number]) => {
    const resolved = await resolveProtectedAsset(asset)
    const path = await managedVoiceAssetStore.resolve(asset)
    const durationSeconds = await getAudioDuration(path)
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw UsageError(`${provider} clone sample duration could not be verified before upload.`)
    return { ...resolved, durationMs: Math.round(durationSeconds * 1000) }
  }
  const adapter = provider === 'elevenlabs'
    ? advancedProvider('elevenlabs', {
        elevenLabsApiKey: resolveCredential('elevenlabs', 'require', { stage: 'voice:elevenlabs', description: 'ElevenLabs instant voice clone' }),
        resolveElevenLabsProtectedAsset: resolveProtectedAsset,
      })
    : provider === 'fish'
      ? advancedProvider('fish', { resolveFishProtectedAsset: resolveProtectedAsset })
      : provider === 'cartesia'
        ? advancedProvider('cartesia', { resolveCartesiaProtectedAsset: resolveProtectedAsset })
        : provider === 'minimax'
          ? advancedProvider('minimax', { resolveMiniMaxProtectedAsset: resolveDurationProtectedAsset })
          : provider === 'grok'
            ? advancedProvider('grok', { resolveGrokProtectedAsset: resolveDurationProtectedAsset })
            : provider === 'deepinfra'
              ? advancedProvider('deepinfra', { resolveDeepinfraProtectedAsset: resolveProtectedAsset })
              : advancedProvider('inworld', {
              inworldApiKey: resolveCredential('inworld', 'require', { stage: 'voice:inworld', description: 'Inworld instant voice clone' }),
              resolveInworldProtectedAsset: resolveProtectedAsset,
            })
  const { localAttemptId: _planningId, ...cloneRequest } = request
  const result = await provisionAdvancedVoiceClone({
    charactersRoot: getCharactersRoot(), journalRoot: join(MANAGED_VOICE_STORE_ROOT, 'journals'), provider: adapter, providerModel, subjectKey, profileKey, brief,
    request: { ...cloneRequest, protectedSamples }, capabilityFixtureHash: advancedCapabilityFixtureHash(provider),
  })
  reportVoiceResult('Voice clone provisioned', { registrationId: result.registration.registrationId, generationId: result.registration.generationId, state: result.registration.provisioning.state })
}
