import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { createCurrentTtsBlockedReadinessState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-readiness-attempt'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import type { CanonicalAudioProviderProjection, GenericTtsDialoguePlan, GenericTtsSourceIdentity, PipelineProviderState, ResumeTarget, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { unexpectedCall } from '../../../test-utils/rest-contract-helpers'
import { createTtsFixtureTarget } from '../../../test-utils/tts-fixture-target'
import { policySkippedTtsProviderStateFrom } from '../../../test-utils/tts-provider-state-fixtures'

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
  const runnableTarget: TtsTarget = {
    ...target,
    ...createTtsFixtureTarget({
      mode: { kind: 'success' },
      service: target.service,
      model: target.model,
      transport: target.transport as string,
      voice: 'alloy',
      requestShape: 'flat'
    }),
    ...(target.targetKey ? { targetKey: target.targetKey } : {})
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
): TtsTarget => ({
  ...createTtsFixtureTarget({
    mode: { kind: 'success' },
    service: target.service,
    model: target.model,
    transport: target.transport as string,
    voice: target.voice ?? 'alloy',
    requestShape: 'flat',
    onRun: () => onRun()
  }),
  ...(target.targetKey ? { targetKey: target.targetKey } : {})
})

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
    ...createTtsFixtureTarget({
      mode: options.admitted ? { kind: 'failAfterAdmission' } : { kind: 'failBeforeDispatch' },
      service: options.target.service,
      model: options.target.model,
      transport: options.target.transport as string,
      voice: options.target.voice ?? 'alloy',
      requestShape: 'flat'
    }),
    ...(options.target.targetKey ? { targetKey: options.target.targetKey } : {})
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

export const policySkippedState = (target: TtsTarget, artifactRoot: string): PipelineProviderState =>
  policySkippedTtsProviderStateFrom({
    target,
    artifactDir: `${artifactRoot}/${target.targetKey as string}`,
    skipId: `skip-${artifactRoot.replace(/\//g, '-')}`
  })

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
