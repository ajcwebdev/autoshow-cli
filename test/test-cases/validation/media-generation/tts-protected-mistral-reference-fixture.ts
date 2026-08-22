import { rm } from 'node:fs/promises'
import type { ProtectedAssetRef, ProtectedVoiceAssetStore, TtsCliReferenceInput, TtsOptions } from '~/types'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { planStandaloneMistralReference, planStandaloneMistralSpeakerReferences } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { resolveStandaloneMistralTtsSpeakerReferenceInputs } from '~/cli/options/option-resolution/tts-options'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

export const protectedAsset: ProtectedAssetRef = {
  storeId: 'mistral_request_refs_v1',
  assetId: `sha256_${'a'.repeat(64)}`,
  sha256: 'a'.repeat(64)
}

export const createMistralProtectedFixture = () => {
  const roots: string[] = []
  return {
    makeRoot: async (): Promise<string> => {
      const root = await makeTempDir('autoshow-mistral-protected-integration-')
      roots.push(root)
      return root
    },
    cleanup: async (): Promise<void> => {
      await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
    }
  }
}

export const mistralOptions = (_sourcePath: string, price: boolean): TtsOptions & { price: boolean } => ({
  mistralTtsModels: ['voxtral-mini-tts-2603'],
  price
})

export const mistralReferenceInput = (sourcePath: string): TtsCliReferenceInput => ({
  sourcePath,
  authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
})

export const planSpeakerReferenceOptions = async (
  mappings: readonly string[],
  store: ProtectedVoiceAssetStore,
  price: boolean
): Promise<TtsOptions & { price: boolean }> => {
  const flags = { 'tts-speaker': [...mappings] }
  const occurrences = mappings.map(value => ({ name: 'tts-speaker', raw: `--tts-speaker=${value}`, value, known: true }))
  const inputs = resolveStandaloneMistralTtsSpeakerReferenceInputs(flags, {
    explicitFlags: new Set(['tts-speaker']),
    flagOccurrences: occurrences,
    cliReferenceInput: 'standalone-mistral'
  })
  const plan = requireDefined(await planStandaloneMistralSpeakerReferences(mappings, inputs, store), 'a protected Mistral speaker-reference plan')
  return plan.attach({
    mistralTtsModels: ['voxtral-mini-tts-2603'],
    ttsDialogueFormat: 'labeled',
    ttsSpeakers: [...plan.ttsSpeakers],
    price
  })
}

export const plannedExecution = async (sourcePath: string, store: ProtectedVoiceAssetStore) => {
  await Bun.write(sourcePath, createMockWavBytes())
  const options = { ...mistralOptions(sourcePath, false), batchConcurrency: 1, allowOverBudget: false }
  await planStandaloneMistralReference(options, mistralReferenceInput(sourcePath), store)
  return { options, targets: collectTtsTargets(options) }
}

export const admissionStore = (onIngest: () => void): ProtectedVoiceAssetStore => ({
  plan: async input => ({ materialization: 'non-materialized', protectedAsset, authorizationRef: input.authorizationRef, byteLength: 123 }),
  ingest: async input => {
    onIngest()
    return { materialization: 'materialized', protectedAsset, authorizationRef: input.authorizationRef, byteLength: 123 }
  },
  resolve: async () => { throw new Error('provider execution is not expected') }
})
