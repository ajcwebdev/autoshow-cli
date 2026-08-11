import { extname, join } from 'node:path'
import type { ProtectedVoiceAssetStore } from './protected-voice-asset-store'
import type { TtsCliReferenceInput, TtsOptions } from '~/types'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { CLIUsageError } from '~/utils/error-handler'
import { createProtectedVoiceAssetStore } from './protected-voice-asset-store'
import {
  attachMistralProtectedReference,
  attachMistralProtectedSpeakerReferences,
  getMistralProtectedReference,
  getMistralProtectedSpeakerReferences,
  promoteMistralProtectedReference,
  promoteMistralProtectedSpeakerReferences
} from './mistral-protected-reference-binding'
import { preflightTtsTargetSelection } from '../tts-targets/tts-target-collect'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from './mistral-request-reference-policy'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings } from '../dialogue-normalizer'
import { assertProtectedStoreOutputDisjoint } from './protected-output-boundary'
import { getOutputRootAbsolute } from '~/cli/commands/process-steps/output-root'
import { getPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { assertMistralReferenceAudioDecodable } from './mistral-reference-audio-preflight'

export const MISTRAL_REQUEST_REFERENCE_STORE_ID = 'mistral_request_refs_v1'
export const MISTRAL_REQUEST_REFERENCE_STORE_ROOT = join(
  RUNTIME_DIR,
  'protected-voice-assets',
  'mistral-request-references-v1'
)

const defaultStore = createProtectedVoiceAssetStore({
  storeId: MISTRAL_REQUEST_REFERENCE_STORE_ID,
  root: MISTRAL_REQUEST_REFERENCE_STORE_ROOT
})

type PendingStandaloneMistralReference = {
  sourcePath: string
  sourceExtension: string
  authorizationRef: string
  store: ProtectedVoiceAssetStore
}

const pendingReferenceByOptions = new WeakMap<TtsOptions, PendingStandaloneMistralReference>()

type PendingStandaloneMistralSpeakerReference = PendingStandaloneMistralReference & {
  speakerKey: string
  protectedAsset: Awaited<ReturnType<ProtectedVoiceAssetStore['plan']>>['protectedAsset']
}

const pendingSpeakerReferencesByOptions = new WeakMap<TtsOptions, readonly PendingStandaloneMistralSpeakerReference[]>()

export type PlannedStandaloneMistralSpeakerReferences = Readonly<{
  ttsSpeakers: readonly string[]
  attach: <T extends TtsOptions>(options: T) => T
}>

export const planStandaloneMistralSpeakerReferences = async (
  speakerMappings: readonly string[] | undefined,
  referenceInputs: readonly TtsCliReferenceInput[],
  store: ProtectedVoiceAssetStore = defaultStore
): Promise<PlannedStandaloneMistralSpeakerReferences | undefined> => {
  if (referenceInputs.length === 0) return undefined
  const registry = parseSpeakerVoiceMappings(speakerMappings)
  const inputBySpeaker = new Map(referenceInputs.map((input) => [input.speakerKey, input]))
  if (
    inputBySpeaker.size !== referenceInputs.length
    || referenceInputs.some((input) => !input.speakerKey || input.authorizationRef !== MISTRAL_CLI_REFERENCE_AUTHORIZATION)
  ) {
    throw CLIUsageError('Mistral dialogue request references require one explicit authorization for each unique speaker.')
  }

  const plannedBySource = new Map<string, Promise<Awaited<ReturnType<ProtectedVoiceAssetStore['plan']>>>>()
  for (const input of referenceInputs) {
    if (plannedBySource.has(input.sourcePath)) continue
    plannedBySource.set(input.sourcePath, (async () => {
      const planned = await store.plan(input)
      await assertMistralReferenceAudioDecodable(input.sourcePath)
      return planned
    })())
  }

  const pendingEntries = await Promise.all(registry.entries.flatMap((entry) => {
    if (entry.voiceKind !== 'ref-audio') return []
    const input = inputBySpeaker.get(entry.normalizedSpeaker)
    if (!input) {
      throw CLIUsageError(`Mistral dialogue reference for speaker ${entry.speaker} did not retain its exact edge authorization.`)
    }
    return [(async (): Promise<PendingStandaloneMistralSpeakerReference> => {
      const planned = await plannedBySource.get(input.sourcePath)
      if (
        !planned
        || planned.materialization !== 'non-materialized'
        || planned.authorizationRef !== input.authorizationRef
      ) {
        throw CLIUsageError(`Protected Mistral reference planning did not preserve the exact speaker binding for ${entry.speaker}.`)
      }
      return {
        speakerKey: entry.normalizedSpeaker,
        sourcePath: input.sourcePath,
        sourceExtension: extname(input.sourcePath).toLowerCase(),
        authorizationRef: input.authorizationRef,
        protectedAsset: planned.protectedAsset,
        store
      }
    })()]
  }))
  if (pendingEntries.length !== referenceInputs.length) {
    throw CLIUsageError('Mistral dialogue request-reference planning did not consume every explicit edge input.')
  }
  const pendingBySpeaker = new Map(pendingEntries.map((entry) => [entry.speakerKey, entry]))
  const sanitizedMappings = registry.entries.map((entry) => {
    if (entry.voiceKind !== 'ref-audio') return `${entry.speaker}=${entry.voice}`
    const pending = pendingBySpeaker.get(entry.normalizedSpeaker)
    if (!pending) throw CLIUsageError(`Missing protected Mistral reference plan for speaker ${entry.speaker}.`)
    return `${entry.speaker}=ref_audio:${pending.protectedAsset.assetId}`
  })

  return Object.freeze({
    ttsSpeakers: Object.freeze(sanitizedMappings),
    attach: <T extends TtsOptions>(options: T): T => {
      if (JSON.stringify(options.ttsSpeakers ?? []) !== JSON.stringify(sanitizedMappings)) {
        throw CLIUsageError('Protected Mistral speaker-reference capability does not match the exact sanitized dialogue mappings.')
      }
      if (getMistralProtectedReference(options)) {
        throw CLIUsageError('Standalone Mistral reference audio cannot be combined with per-speaker dialogue references.')
      }
      pendingSpeakerReferencesByOptions.set(options, pendingEntries)
      attachMistralProtectedSpeakerReferences(options, {
        materialization: 'non-materialized',
        entries: pendingEntries.map((entry) => ({
          speakerKey: entry.speakerKey,
          protectedAsset: entry.protectedAsset,
          sourceExtension: entry.sourceExtension
        }))
      })
      preflightTtsTargetSelection(options)
      return options
    }
  })
}

export const planStandaloneMistralReference = async <T extends TtsOptions>(
  options: T,
  referenceInput: TtsCliReferenceInput | undefined,
  store: ProtectedVoiceAssetStore = defaultStore
): Promise<T> => {
  preflightTtsTargetSelection(options)

  if (!referenceInput) return options
  const sourcePath = referenceInput.sourcePath.trim()
  if (!sourcePath) {
    throw CLIUsageError('Standalone Mistral request reference path is empty.')
  }

  if (referenceInput.authorizationRef !== MISTRAL_CLI_REFERENCE_AUTHORIZATION) {
    throw CLIUsageError(
      'Standalone Mistral request reference is missing its explicit CLI authorization.',
      'Pass --mistral-tts-ref-audio explicitly to standalone `tts`, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --mistral-tts-voice.'
    )
  }
  if (referenceInput.speakerKey) {
    throw CLIUsageError(
      'Per-speaker Mistral reference inputs are not available in the Phase 0 standalone path.',
      'Create or import each voice with the shared `voice` command or `comic reference-voice`, then use its existing voice ID in dialogue mappings.'
    )
  }
  if (isMultiSpeakerRequested(options)) {
    throw CLIUsageError(
      'Standalone Mistral request reference audio cannot be combined with dialogue voice mappings in Phase 0.',
      'Create or import each voice with the shared `voice` command or `comic reference-voice`, then use its existing voice ID in SPEAKER=VOICE mappings.'
    )
  }
  const hasMistralTarget = Boolean(options.mistralTtsModel || options.mistralTtsModels?.length)
  if (!hasMistralTarget) {
    throw CLIUsageError('Mistral TTS reference audio requires selecting Mistral TTS with --provider/--tts mistral[=model].')
  }
  if (options.mistralTtsVoice?.trim()) {
    throw CLIUsageError('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
  }

  const edgeInput = {
    sourcePath,
    authorizationRef: referenceInput.authorizationRef
  }
  const planned = await store.plan(edgeInput)
  await assertMistralReferenceAudioDecodable(sourcePath)
  if (
    planned.materialization !== 'non-materialized'
    || planned.authorizationRef !== edgeInput.authorizationRef
  ) {
    throw CLIUsageError('Protected Mistral reference planning did not preserve the explicit request authorization.')
  }
  const sourceExtension = extname(sourcePath).toLowerCase()

  // This is the privacy boundary: the raw edge input never enters the runtime bag. Keep it only in
  // a capability bound to this exact sanitized options object.
  pendingReferenceByOptions.set(options, { ...edgeInput, sourceExtension, store })
  return attachMistralProtectedReference(options, {
    materialization: 'non-materialized',
    protectedAsset: planned.protectedAsset,
    sourceExtension
  })
}

export const materializeStandaloneMistralReference = async <T extends TtsOptions & { price?: boolean | undefined }>(
  options: T,
  outputPath: string = getPinnedRunDir() ?? getOutputRootAbsolute()
): Promise<T> => {
  const pending = pendingReferenceByOptions.get(options)
  const pendingSpeakers = pendingSpeakerReferencesByOptions.get(options)
  const binding = getMistralProtectedReference(options)
  const speakerBinding = getMistralProtectedSpeakerReferences(options)
  if (!pending && !pendingSpeakers) {
    if (binding?.materialization === 'non-materialized' || speakerBinding?.materialization === 'non-materialized') {
      throw CLIUsageError('Planned Mistral reference cannot execute without its exact authorization capability. Re-run the tts command and do not clone its runtime options.')
    }
    return options
  }
  if (pending && pendingSpeakers) {
    throw CLIUsageError('Standalone Mistral reference audio cannot be combined with per-speaker dialogue references.')
  }
  if (options.price === true) {
    throw CLIUsageError('Price planning cannot materialize a protected Mistral reference.')
  }

  const stores = [
    ...(pending ? [pending.store] : []),
    ...(pendingSpeakers ?? []).map((entry) => entry.store)
  ]
  const checkedRoots = new Set<string>()
  for (const store of stores) {
    const root = store.root ?? MISTRAL_REQUEST_REFERENCE_STORE_ROOT
    if (checkedRoots.has(root)) continue
    checkedRoots.add(root)
    await assertProtectedStoreOutputDisjoint(outputPath, root)
  }

  // Consume before the first write attempt so one options capability cannot ingest twice.
  pendingReferenceByOptions.delete(options)
  pendingSpeakerReferencesByOptions.delete(options)
  if (pending) {
    if (binding?.materialization !== 'non-materialized') {
      throw CLIUsageError('Protected Mistral reference lost its non-materialized planning identity before execution ingestion.')
    }
    const materialized = await pending.store.ingest({
      sourcePath: pending.sourcePath,
      authorizationRef: pending.authorizationRef
    }, binding.protectedAsset)
    if (
      materialized.authorizationRef !== pending.authorizationRef
      || materialized.protectedAsset.storeId !== binding.protectedAsset.storeId
      || materialized.protectedAsset.assetId !== binding.protectedAsset.assetId
      || materialized.protectedAsset.sha256 !== binding.protectedAsset.sha256
    ) {
      throw CLIUsageError('Protected Mistral reference changed between deterministic planning and execution ingestion.')
    }
    return promoteMistralProtectedReference(options, {
      materialization: 'materialized',
      protectedAsset: materialized.protectedAsset,
      sourceExtension: pending.sourceExtension,
      resolve: async () => await pending.store.resolve(materialized.protectedAsset)
    })
  }

  if (!pendingSpeakers || speakerBinding?.materialization !== 'non-materialized') {
    throw CLIUsageError('Protected Mistral speaker references lost their non-materialized planning identity before execution ingestion.')
  }
  const expectedBySpeaker = new Map(speakerBinding.entries.map((entry) => [entry.speakerKey, entry]))
  if (
    expectedBySpeaker.size !== pendingSpeakers.length
    || pendingSpeakers.some((entry) => {
      const expected = expectedBySpeaker.get(entry.speakerKey)
      return !expected
        || expected.protectedAsset.storeId !== entry.protectedAsset.storeId
        || expected.protectedAsset.assetId !== entry.protectedAsset.assetId
        || expected.protectedAsset.sha256 !== entry.protectedAsset.sha256
    })
  ) {
    throw CLIUsageError('Protected Mistral speaker references changed after deterministic planning.')
  }
  const uniquePending = new Map<string, PendingStandaloneMistralSpeakerReference>()
  for (const entry of pendingSpeakers) {
    const key = `${entry.protectedAsset.storeId}\0${entry.protectedAsset.assetId}\0${entry.protectedAsset.sha256}`
    if (!uniquePending.has(key)) uniquePending.set(key, entry)
  }
  const materializedByKey = new Map<string, Awaited<ReturnType<ProtectedVoiceAssetStore['ingest']>>>()
  for (const [key, entry] of uniquePending) {
    const materialized = await entry.store.ingest({
      speakerKey: entry.speakerKey,
      sourcePath: entry.sourcePath,
      authorizationRef: entry.authorizationRef
    }, entry.protectedAsset)
    materializedByKey.set(key, materialized)
  }
  return promoteMistralProtectedSpeakerReferences(options, {
    materialization: 'materialized',
    entries: pendingSpeakers.map((entry) => {
      const key = `${entry.protectedAsset.storeId}\0${entry.protectedAsset.assetId}\0${entry.protectedAsset.sha256}`
      const materialized = materializedByKey.get(key)
      if (!materialized) throw CLIUsageError(`Protected Mistral reference for speaker ${entry.speakerKey} was not ingested.`)
      return {
        speakerKey: entry.speakerKey,
        protectedAsset: materialized.protectedAsset,
        sourceExtension: entry.sourceExtension,
        resolve: async () => await entry.store.resolve(materialized.protectedAsset)
      }
    })
  })
}

export const prepareStandaloneMistralReference = async <T extends TtsOptions & { price?: boolean | undefined }>(
  options: T,
  referenceInput: TtsCliReferenceInput | undefined,
  store: ProtectedVoiceAssetStore = defaultStore,
  outputPath?: string | undefined
): Promise<T> => {
  const planned = await planStandaloneMistralReference(options, referenceInput, store)
  return options.price === true
    ? planned
    : await materializeStandaloneMistralReference(planned, outputPath)
}
