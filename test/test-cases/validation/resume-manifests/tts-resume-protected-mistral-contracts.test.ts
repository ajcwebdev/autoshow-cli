import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { priceGenerationTarget, resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { resolveStoredTtsTargetsForResume, ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import type { PipelineProviderState, TtsOptions, TtsTarget } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import type { ProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { canonicalFileInput, findRecoverableCompletedState, materializeFailedProviderState, resumeTarget } from './tts-resume-fixtures'

const protectedMistralTarget = (
  protectedAsset: { storeId: string, assetId: string, sha256: string },
  onRun: () => void = () => {}
): TtsTarget => {
  const model = 'voxtral-mini-tts-2603'
  const voice = `ref_audio:${protectedAsset.assetId}`
  const bytes = createMockWavBytes()
  return {
    service: 'mistral',
    model,
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'mistral', model, 'hosted-api'),
    voice,
    protectedVoiceAsset: protectedAsset,
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'mistral.tts.phase-0-v1',
        serializedRequest: { text, speaker: voice },
        providerText: text,
        voiceField: 'speaker',
        voices: [{ kind: 'reference-asset', valueHash: protectedAsset.sha256 }],
        requestControls: { stream: false, responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-protected-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'mistral',
          ttsModel: model,
          speaker: `protected reference asset ${protectedAsset.assetId}`,
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const materializeProtectedStoreFixture = async (
  dir: string
): Promise<{ store: ProtectedVoiceAssetStore, protectedAsset: { storeId: string, assetId: string, sha256: string } }> => {
  const sourcePath = join(dir, 'authorized-reference.wav')
  await Bun.write(sourcePath, createMockWavBytes({ samples: 800 }))
  const store = createProtectedVoiceAssetStore({ storeId: 'resume_mistral_refs', root: join(dir, 'protected-store') })
  const materialized = await store.ingest({
    sourcePath,
    authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
  })
  return { store, protectedAsset: materialized.protectedAsset }
}

const withMistralCredential = async <T>(operation: () => Promise<T>): Promise<T> => {
  const prior = process.env['MISTRAL_API_KEY']
  process.env['MISTRAL_API_KEY'] = 'configured-for-local-protected-resume-fixture'
  try {
    return await operation()
  } finally {
    if (prior === undefined) delete process.env['MISTRAL_API_KEY']
    else process.env['MISTRAL_API_KEY'] = prior
  }
}

describe('canonical TTS resume — protected Mistral references', () => {
  test('blocks interrupted protected Mistral work before target invocation or manifest mutation', async () => {
    await withTempDir('autoshow-tts-resume-protected-block-', async (dir) => {
      const text = 'Do not redispatch this interrupted protected reference.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const { store, protectedAsset } = await materializeProtectedStoreFixture(dir)
      const target = protectedMistralTarget(protectedAsset)
      const failed = await withMistralCredential(async () => await materializeFailedProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan
      }))
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let targetCalls = 0
      const config = {
        ...ttsResumeConfig,
        resolveStoredTargets: async (...args: Parameters<typeof resolveStoredTtsTargetsForResume>) => {
          const targets = await resolveStoredTtsTargetsForResume(args[0], args[1], args[2], args[3], store)
          for (const resolved of targets) {
            resolved.run = async () => {
              targetCalls++
              throw new Error('Protected interrupted work must not invoke its target.')
            }
          }
          return targets
        }
      }

      await expect(priceGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)).rejects.toThrow('cannot authorize protected Mistral reference redispatch')
      await withMistralCredential(async () => {
        await expect(resumeGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)).rejects.toThrow('still has failed providers')
      })
      expect(targetCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('recovers completed protected Mistral evidence without resolving a second provider request', async () => {
    await withTempDir('autoshow-tts-resume-protected-recovery-', async (dir) => {
      const text = 'Recover the already promoted protected-reference result.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const { store, protectedAsset } = await materializeProtectedStoreFixture(dir)
      const target = protectedMistralTarget(protectedAsset)
      const snapshots: PipelineProviderState[] = []
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      await withMistralCredential(async () => {
        await runTtsForTargets(text, dir, {}, [target], {
          sourceIdentity,
          dialoguePlan,
          onProviderState: async (state) => {
            snapshots.push(structuredClone(bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)))
          }
        })
      })
      const retained = await findRecoverableCompletedState(dir, snapshots)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: retained.status === 'failed' ? 'failed' : 'incomplete',
        metadata: { tts: [] },
        providers: [retained]
      })]))
      const beforePrice = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let resumedTargetCalls = 0
      const config = {
        ...ttsResumeConfig,
        resolveStoredTargets: async (...args: Parameters<typeof resolveStoredTtsTargetsForResume>) => {
          const targets = await resolveStoredTtsTargetsForResume(args[0], args[1], args[2], args[3], store)
          for (const resolved of targets) {
            resolved.run = async () => {
              resumedTargetCalls++
              throw new Error('Completed protected recovery must not invoke its target.')
            }
          }
          return targets
        }
      }

      const estimate = await priceGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)
      expect(estimate.totalEstimatedCost).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforePrice)
      await withMistralCredential(async () => {
        await resumeGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)
      })
      expect(resumedTargetCalls).toBe(0)
      expect((await readManifest(dir))?.items[0]?.providers[0]?.status).toBe('succeeded')
    })
  })
})
