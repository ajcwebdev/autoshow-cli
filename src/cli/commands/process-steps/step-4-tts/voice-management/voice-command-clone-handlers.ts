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
import {
  CLONE_PROVIDERS, PROFILE_DEFAULT, SPEECHIFY_CLONE_GENDERS, advancedCapabilityFixtureHash,
  advancedProvider, cloneMediaType, isCloneProvider, maybeCompleteRegistrationJournal, optionalFlag,
  parameter, providerFlag, repeatableFlag, reportVoicePrice, reportVoiceResult, requireBrief,
  requiredFlag, requireVoiceModel
} from './voice-command-support'

export const handleClone = async (ctx: CliCommandContext): Promise<void> => {
  const subjectKey = parameter(ctx, 'subjectKey')
  const provider = providerFlag(ctx)
  if (!isCloneProvider(provider)) throw UsageError(`Voice clone currently supports ${CLONE_PROVIDERS.join(', ')}; other providers return unsupported until their adapter is implemented.`)
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
  if ((provider === 'cartesia' || provider === 'speechify') && samplePaths.length !== 1) throw UsageError(`${provider} instant voice clone requires exactly one --sample.`)
  const speechifyConsentName = optionalFlag(ctx, 'consent-name')
  const speechifyConsentEmail = optionalFlag(ctx, 'consent-email')
  const speechifyLocale = optionalFlag(ctx, 'locale')
  const speechifyGender = optionalFlag(ctx, 'gender')
  if (provider === 'speechify') {
    if (!speechifyConsentName || !speechifyConsentEmail) throw UsageError('Speechify instant clone requires --consent-name and --consent-email.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speechifyConsentEmail)) throw UsageError('--consent-email must be a valid email address.')
    if (speechifyGender && !SPEECHIFY_CLONE_GENDERS.includes(speechifyGender as typeof SPEECHIFY_CLONE_GENDERS[number])) throw UsageError(`--gender must be ${SPEECHIFY_CLONE_GENDERS.join(', ')}.`)
  } else if (speechifyConsentName || speechifyConsentEmail || speechifyLocale || speechifyGender) {
    throw UsageError('--consent-name, --consent-email, --locale, and --gender are Speechify instant-clone flags.')
  }
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
  await assertProtectedStoreOutputDisjoint(getCharactersRoot(), MANAGED_VOICE_STORE_ROOT)
  if (!managedVoiceAssetStore.ingestManaged) throw UsageError('Managed protected store cannot retain clone samples.')
  const createdAt = new Date().toISOString()
  const protectedSamples = await Promise.all(samplePaths.map(async (sourcePath, index) => (await managedVoiceAssetStore.ingestManaged!({ sourcePath, authorizationRef, speakerKey: subjectKey }, {
    schemaVersion: 1, purpose: 'reference-audio', authorizationRef, retention: { mode: 'retain-until-revoked', obligationRef: request.provenanceRef }, consentRecordRef, createdAt,
  }, planned[index]?.protectedAsset)).protectedAsset))
  const resolveProtectedAsset = async (asset: typeof protectedSamples[number]) => {
      const path = await managedVoiceAssetStore.resolve(asset)
      return { bytes: new Uint8Array(await Bun.file(path).arrayBuffer()), fileName: `clone-sample-${asset.assetId}.${path.split('.').pop() ?? 'audio'}`, mediaType: cloneMediaType(path) }
  }
  const resolveSpeechifyProtectedAsset = async (asset: typeof protectedSamples[number]) => {
    const resolved = await resolveProtectedAsset(asset)
    const path = await managedVoiceAssetStore.resolve(asset)
    const durationSeconds = await getAudioDuration(path)
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw UsageError('Speechify clone sample duration could not be verified before upload.')
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
        : provider === 'speechify'
          ? advancedProvider('speechify', {
              resolveSpeechifyProtectedAsset,
              resolveSpeechifyProtectedConsent: async () => ({
                fullName: speechifyConsentName!,
                email: speechifyConsentEmail!,
                ...(speechifyLocale ? { locale: speechifyLocale } : {}),
                ...(speechifyGender ? { gender: speechifyGender as typeof SPEECHIFY_CLONE_GENDERS[number] } : {}),
              }),
            })
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
