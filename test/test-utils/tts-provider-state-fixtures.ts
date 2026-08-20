import type { PipelineProviderState, TtsTarget } from '~/types'

export const policySkippedTtsProviderState = (
  target: TtsTarget,
  artifactRoot = 'providers'
): PipelineProviderState => {
  const targetKey = target.targetKey as string
  const actor = { namespace: 'local-user' as const, actorId: 'fixture' }
  const at = new Date(0).toISOString()
  const evidence = {
    schemaVersion: 1 as const,
    skipId: `skip-${targetKey}`,
    targetKey,
    reasonCode: 'user-requested' as const,
    reason: 'fixture skip',
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
    service: target.service,
    model: target.model,
    local: false,
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
