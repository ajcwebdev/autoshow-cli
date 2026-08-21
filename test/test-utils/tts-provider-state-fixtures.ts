import type { PipelineProviderState, TtsTarget } from '~/types'

type PolicySkipIdentity = Pick<TtsTarget, 'service' | 'model' | 'transport' | 'targetKey'>

/**
 * The distinguishing dimensions of a policy-skipped provider state are its target
 * identity, where the artifacts live, and which skip evidence the manifest carries.
 * Those are required; the harness-labelling fields have fixture defaults.
 */
export type PolicySkippedTtsProviderStateOptions = {
  target: PolicySkipIdentity
  artifactDir: string
  skipId: string
  actorId?: string | undefined
  reason?: string | undefined
  at?: string | undefined
  local?: boolean | undefined
}

export const policySkippedTtsProviderStateFrom = (
  options: PolicySkippedTtsProviderStateOptions
): PipelineProviderState => {
  const targetKey = options.target.targetKey as string
  const actor = { namespace: 'local-user' as const, actorId: options.actorId ?? 'fixture' }
  const at = options.at ?? new Date(0).toISOString()
  const evidence = {
    schemaVersion: 1 as const,
    skipId: options.skipId,
    targetKey,
    reasonCode: 'user-requested' as const,
    reason: options.reason ?? 'fixture skip',
    actor,
    at
  }
  const projection = {
    activeWork: { kind: 'policy-skip' as const, evidence },
    branchHistory: [],
    readinessAttempts: [],
    renderHistory: [],
    pointerEvents: [{ sequence: 1, action: 'activate-policy-skip' as const, skipId: evidence.skipId, actor, at }]
  }
  return {
    service: options.target.service,
    model: options.target.model,
    ...(options.local === undefined ? {} : { local: options.local }),
    operation: 'tts-synthesis',
    targetKey,
    transport: options.target.transport as string,
    artifactDir: options.artifactDir,
    status: 'skipped',
    attempts: 0,
    options: {},
    metadata: { ttsAudio: projection },
    result: { ttsAudio: projection }
  }
}

/** Target-and-root spelling used by the canonical manifest and resume-setup suites. */
export const policySkippedTtsProviderState = (
  target: TtsTarget,
  artifactRoot = 'providers'
): PipelineProviderState => policySkippedTtsProviderStateFrom({
  target,
  artifactDir: `${artifactRoot}/${target.targetKey as string}`,
  skipId: `skip-${target.targetKey as string}`,
  local: false
})
