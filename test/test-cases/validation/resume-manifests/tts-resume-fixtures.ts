import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { createCurrentTtsBlockedReadinessState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-readiness-attempt'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import type { CanonicalAudioProviderProjection, GenericTtsDialoguePlan, GenericTtsSourceIdentity, PipelineProviderState, ResumeTarget, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { unexpectedCall } from '../../../test-utils/rest-contract-helpers'

export const ttsTarget = (transport = 'hosted-api'): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const service = 'openai' as const
  const model = 'gpt-4o-mini-tts-2025-12-15'
  return {
    service,
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, service, model, transport),
    run: unexpectedCall('provider run in a local contract test')
  }
}

export const canonicalFileInput = (sourceIdentity: GenericTtsSourceIdentity): string => {
  if (sourceIdentity.sourceLocator.kind !== 'file') throw new Error('Expected a file-backed TTS source fixture')
  return sourceIdentity.sourceLocator.canonicalPath
}

export const succeededMetadata = async (
  rootDir: string,
  target: TtsTarget,
  label: string,
  source?: {
    text: string
    sourceIdentity: GenericTtsSourceIdentity
    dialoguePlan: GenericTtsDialoguePlan
  } | undefined
): Promise<Step4Metadata> => {
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  const runnableTarget: TtsTarget = {
    ...target,
    voice: 'alloy',
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { text, voice: 'alloy' },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: target.service,
          ttsModel: target.model,
          speaker: 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
  const sourceText = source?.text ?? `Fixture render ${label}.`
  const result = await runTtsForTargets(
    sourceText,
    rootDir,
    {},
    [runnableTarget],
    source ? { sourceIdentity: source.sourceIdentity, dialoguePlan: source.dialoguePlan } : undefined
  )
  return result.metadata[0] as Step4Metadata
}

export const successfulTarget = (
  target: TtsTarget,
  onRun: () => void = () => {}
): TtsTarget => {
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  return {
    ...target,
    voice: target.voice ?? 'alloy',
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { text, voice: target.voice ?? 'alloy' },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: target.voice ?? 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: target.service,
          ttsModel: target.model,
          speaker: target.voice ?? 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

export const materializeFailedProviderState = async (options: {
  rootDir: string
  target: TtsTarget
  text: string
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  admitted?: boolean | undefined
  artifactRoot?: string | undefined
}): Promise<PipelineProviderState> => {
  let latest: PipelineProviderState | undefined
  const runnable: TtsTarget = {
    ...options.target,
    voice: options.target.voice ?? 'alloy',
    run: async (text, _outputDir, _opts, _invocation, requestEvidence): Promise<never> => {
      if (options.admitted) {
        await requestEvidence?.dispatch({
          chunkIndex: 1,
          endpointKind: 'speech-synthesis',
          serializerVersion: 'openai.tts.phase-0-v1',
          serializedRequest: { text, voice: options.target.voice ?? 'alloy' },
          providerText: text,
          voiceField: 'voice',
          voices: [{ kind: 'provider-id', value: options.target.voice ?? 'alloy' }],
          requestControls: { responseFormat: 'wav' },
          continuation: { kind: 'none' }
        }, { attempt: 1 }, async () => {
          throw new Error('ambiguous fixture failure after provider admission')
        })
      }
      throw new Error('fixture failure before provider dispatch')
    }
  }
  await runTtsForTargets(options.text, options.rootDir, {}, [runnable], {
    sourceIdentity: options.sourceIdentity,
    dialoguePlan: options.dialoguePlan,
    artifactOutputDir: options.rootDir,
    ...(options.artifactRoot ? { artifactRoot: options.artifactRoot } : {}),
    onProviderState: async (state) => { latest = state }
  }).catch(() => undefined)
  if (!latest || latest.status !== 'failed') throw new Error('Fixture lifecycle did not produce a failed canonical TTS state.')
  return bindTtsDialoguePlanArtifact(
    latest,
    await materializeTtsDialoguePlanArtifact(options.rootDir, options.dialoguePlan)
  )
}

export const materializeBlockedReadinessProviderState = async (options: {
  rootDir: string
  target: TtsTarget
  text: string
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  ttsOptions: TtsOptions
}): Promise<PipelineProviderState> => bindTtsDialoguePlanArtifact(
  await createCurrentTtsBlockedReadinessState({
    outputDir: options.rootDir,
    target: options.target,
    sourceText: options.text,
    ttsOptions: options.ttsOptions,
    sourceIdentity: options.sourceIdentity,
    dialoguePlan: options.dialoguePlan,
    readiness: {
      targetKey: options.target.targetKey as string,
      accountState: 'not-configured',
      status: 'blocked',
      error: {
        phase: 'readiness',
        code: 'provider-credential-not-configured',
        message: 'OPENAI_API_KEY environment variable is required for OpenAI TTS.',
        retryable: false,
        blockedReason: 'provider-credential-not-configured'
      }
    },
    peerBlocked: false
  }),
  await materializeTtsDialoguePlanArtifact(options.rootDir, options.dialoguePlan)
)

export const policySkippedState = (target: TtsTarget, artifactRoot: string): PipelineProviderState => {
  const targetKey = target.targetKey as string
  const actor = { namespace: 'local-user' as const, actorId: 'fixture' }
  const at = new Date(0).toISOString()
  const evidence = { schemaVersion: 1 as const, skipId: `skip-${artifactRoot.replace(/\//g, '-')}`, targetKey, reasonCode: 'user-requested' as const, reason: 'fixture skip', actor, at }
  const projection = {
    activeWork: { kind: 'policy-skip' as const, evidence },
    branchHistory: [],
    readinessAttempts: [],
    renderHistory: [],
    pointerEvents: [{ sequence: 1, action: 'activate-policy-skip' as const, skipId: evidence.skipId, actor, at }]
  }
  return {
    service: target.service,
    model: target.model,
    operation: 'tts-synthesis',
    targetKey,
    transport: target.transport as string,
    artifactDir: `${artifactRoot}/${targetKey}`,
    status: 'skipped',
    attempts: 0,
    options: {},
    metadata: { ttsAudio: projection },
    result: { ttsAudio: projection }
  }
}

export const findRecoverableCompletedState = async (
  rootDir: string,
  states: readonly PipelineProviderState[]
): Promise<PipelineProviderState> => {
  for (const state of states) {
    const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
    const event = projection?.renderHistory.flatMap((render) => render.events).findLast((entry) => entry.admissionJournalRef)
    if (!event?.admissionJournalRef) continue
    const journal = await Bun.file(join(rootDir, state.artifactDir, event.admissionJournalRef)).json() as { recordedResult?: unknown }
    if (journal.recordedResult !== undefined && state.status !== 'succeeded') return state
  }
  throw new Error('Fixture lifecycle did not expose a pre-terminal state with a complete promoted provider result.')
}

export const resumeTarget = (dir: string): ResumeTarget => ({
  kind: 'tts',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

export const localTtsResumeConfig = (
  selectedTargets: TtsTarget[],
  metadataByKey: ReadonlyMap<string, Step4Metadata>,
  ranTargetKeys: string[]
) => ({
  ...ttsResumeConfig,
  collectTargets: () => selectedTargets,
  runMissingTargets: async (targets: TtsTarget[]) => {
    ranTargetKeys.push(...targets.map((target) => target.targetKey as string))
    return targets.map((target) => metadataByKey.get(target.targetKey as string) as Step4Metadata)
  },
  rebuildRunMetadata: () => ({})
})
