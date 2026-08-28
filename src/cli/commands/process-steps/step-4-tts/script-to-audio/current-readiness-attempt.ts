import { readdir } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import type {
  AccountCapabilityObservation,
  CanonicalAudioProviderProjection,
  CanonicalReadinessAttempt,
  PipelineProviderState,
  ProviderReadinessResult,
  ResolvedVoiceBinding,
  SanitizedProviderError,
  CreateCurrentTtsBlockedReadinessStateOptions,
  WrittenJson,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  planCurrentTtsReadiness,
} from './current-render-attempt'
import {
  canonicalTtsJson,
  hashCanonicalTtsValue,
} from './contract-identity'
import {
  projectCanonicalAudioProviderStatus,
  validateAccountCapabilityObservation,
} from './contract-validation'
import { writeImmutableArtifactFile } from './safe-artifact-store'
const LOCAL_ACTOR = { namespace: 'local-user' as const, actorId: 'current-cli-user' }

const withIdentity = <T extends Record<string, unknown>, K extends string>(
  value: T,
  field: K
): T & Record<K, string> =>
  ({ ...value, [field]: hashCanonicalTtsValue(value) }) as T & Record<K, string>

const writeJsonCreateOnly = async <T>(rootDir: string, path: string, value: T): Promise<WrittenJson<T>> => {
  const bytes = `${canonicalTtsJson(value)}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { value, path, sha256: written.sha256 }
}

const contained = (root: string, path: string): string => {
  const value = relative(root, path)
  if (!value || value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw UsageError('TTS readiness evidence escaped its stable provider artifact directory.')
  }
  return value.split(sep).join('/')
}

const normalizeArtifactRoot = (value: string | undefined): string => {
  const artifactRoot = (value ?? 'providers').replace(/\/+$/, '')
  if (
    !artifactRoot
    || isAbsolute(artifactRoot)
    || artifactRoot.includes('\\')
    || artifactRoot.split('/').some((part) => !part || part === '.' || part === '..')
  ) throw UsageError(`Invalid TTS provider artifact root: ${artifactRoot}`)
  return artifactRoot
}

const nextReadinessArtifactNumber = async (branchDir: string): Promise<number> => {
  const names = await readdir(branchDir).catch(() => [])
  const numbers = names.flatMap((name) => {
    const match = /^readiness-result-attempt-(\d+)\.json$/.exec(name)
    return match?.[1] ? [Number.parseInt(match[1], 10)] : []
  }).filter(Number.isFinite)
  return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1
}

const voiceLocatorHash = (voice: ResolvedVoiceBinding): string =>
  voice.kind === 'transient-provider-voice' ? voice.identityHash : voice.entryHash

const resolvedVoicesFromPlan = (
  renderPlan: ReturnType<typeof planCurrentTtsReadiness>['renderPlan']
): ProviderReadinessResult['resolvedVoices'] => renderPlan.nodes.flatMap((node) => {
  const turns = node.kind === 'turn' ? [node.turn] : node.turns
  return turns.map((turn) => ({
    locatorHash: voiceLocatorHash(turn.voice),
    providerVoice: turn.voice.providerVoice,
    ...(turn.voice.kind === 'approved-snapshot' && turn.voice.providerRevision
      ? { providerRevision: turn.voice.providerRevision }
      : {}),
    externallyMutable: turn.voice.providerVoice.kind === 'remote-resource'
  }))
})

const PEER_READINESS_ERROR: SanitizedProviderError = {
  phase: 'readiness',
  code: 'peer-readiness-failed',
  message: 'Another selected TTS target failed execution readiness; all-target synthesis admission was blocked.',
  retryable: false,
  blockedReason: 'dependency-readiness-failed'
}

export const createCurrentTtsBlockedReadinessState = async (
  options: CreateCurrentTtsBlockedReadinessStateOptions
): Promise<PipelineProviderState> => {
  const plan = planCurrentTtsReadiness(options)
  if (options.readiness.targetKey !== plan.targetKey) {
    throw UsageError('TTS execution-readiness observation does not match its operation-scoped target.')
  }
  if (
    (options.readiness.status === 'ready' && (options.readiness.accountState !== 'available' || options.readiness.error !== undefined))
    || (options.readiness.status === 'blocked' && (options.readiness.accountState === 'available' || options.readiness.error?.phase !== 'readiness'))
  ) {
    throw UsageError('TTS execution-readiness observation has a contradictory account state or error.')
  }
  if (options.readiness.status === 'ready' && !options.peerBlocked) {
    throw UsageError('A ready TTS target may use the branch-only writer only when a selected peer blocks all-target admission.')
  }

  const artifactRoot = normalizeArtifactRoot(options.artifactRoot)
  const targetRelativeDir = `${artifactRoot}/${plan.targetKey}`
  const targetDir = `${options.outputDir}/${targetRelativeDir}`
  const branchDir = `${targetDir}/branches/${plan.branchPlan.branchPlanId}`
  const capabilityFile = await writeJsonCreateOnly(
    options.outputDir,
    `${targetDir}/capability-fixtures/${plan.capabilityFixtureHash}.json`,
    plan.capability
  )
  const branchFile = await writeJsonCreateOnly(options.outputDir, `${branchDir}/branch-plan.json`, plan.branchPlan)
  const checkedAt = options.now?.() ?? new Date().toISOString()
  const accountScopeHash = hashCanonicalTtsValue({
    provider: options.target.service,
    transport: plan.transport,
    credentialScope: 'configured-provider-account'
  })
  const capabilityObservation = withIdentity({
    capabilityScopeHash: plan.capabilityScopeHash,
    capabilityFixtureHash: plan.capabilityFixtureHash,
    accountScopeHash,
    state: options.readiness.accountState,
    satisfiedRequirements: [],
    unmetRequirements: [],
    checkedAt,
    evidenceRefs: [contained(targetDir, capabilityFile.path)],
    ...(options.readiness.status === 'blocked'
      ? { reason: options.readiness.error?.message ?? 'TTS execution readiness is blocked.' }
      : {})
  }, 'observationHash') as AccountCapabilityObservation
  validateAccountCapabilityObservation(capabilityObservation, {
    capabilityScopeHash: plan.capabilityScopeHash,
    capabilityFixtureHash: plan.capabilityFixtureHash,
    accountScopeHash
  })

  const selfError = options.readiness.status === 'blocked'
    ? options.readiness.error as SanitizedProviderError
    : undefined
  const readinessResult = withIdentity({
    schemaVersion: 1 as const,
    branchPlanId: plan.branchPlan.branchPlanId,
    targetKey: plan.targetKey,
    status: options.readiness.status,
    capabilityFixture: {
      capabilityFixtureHash: plan.capabilityFixtureHash,
      path: contained(targetDir, capabilityFile.path),
      sha256: capabilityFile.sha256
    },
    capabilityObservations: [capabilityObservation],
    candidateReadiness: [{
      candidateId: plan.branchCandidate.candidateId,
      strategy: plan.strategy,
      requiredCapabilityScopeHashes: [plan.capabilityScopeHash],
      accountObservationHashes: [capabilityObservation.observationHash],
      status: options.readiness.status,
      errors: selfError ? [selfError] : []
    }],
    resolvedVoices: resolvedVoicesFromPlan(plan.renderPlan),
    checkedAt,
    errors: selfError ? [selfError] : []
  }, 'readinessResultHash') as ProviderReadinessResult
  const readinessArtifactNumber = await nextReadinessArtifactNumber(branchDir)
  const readinessFile = await writeJsonCreateOnly(
    options.outputDir,
    `${branchDir}/readiness-result-attempt-${String(readinessArtifactNumber).padStart(3, '0')}.json`,
    readinessResult
  )
  const projectedError = selfError ?? PEER_READINESS_ERROR
  const canonicalReadinessAttempt: CanonicalReadinessAttempt = options.readiness.status === 'blocked'
    ? {
        sequence: 1,
        branchPlanId: plan.branchPlan.branchPlanId,
        readinessResultRef: contained(targetDir, readinessFile.path),
        readinessResultHash: readinessFile.sha256,
        accountObservationHashes: [capabilityObservation.observationHash],
        at: checkedAt,
        status: 'blocked',
        admissionDisposition: 'self-blocked',
        error: projectedError
      }
    : {
        sequence: 1,
        branchPlanId: plan.branchPlan.branchPlanId,
        readinessResultRef: contained(targetDir, readinessFile.path),
        readinessResultHash: readinessFile.sha256,
        accountObservationHashes: [capabilityObservation.observationHash],
        at: checkedAt,
        status: 'ready',
        admissionDisposition: 'peer-blocked',
        error: projectedError
      }
  const projection: CanonicalAudioProviderProjection = {
    activeWork: {
      kind: 'branch',
      branchPlanId: plan.branchPlan.branchPlanId,
      readinessAttemptSequence: 1
    },
    branchHistory: [{
      sequence: 1,
      branchPlanId: plan.branchPlan.branchPlanId,
      branchPlanRef: contained(targetDir, branchFile.path),
      branchPlanSha256: branchFile.sha256,
      createdAt: checkedAt
    }],
    readinessAttempts: [canonicalReadinessAttempt],
    renderHistory: [],
    pointerEvents: [
      {
        sequence: 1,
        action: 'activate-branch',
        branchPlanId: plan.branchPlan.branchPlanId,
        actor: LOCAL_ACTOR,
        at: checkedAt
      },
      {
        sequence: 2,
        action: 'project-branch-readiness',
        branchPlanId: plan.branchPlan.branchPlanId,
        readinessAttemptSequence: 1,
        actor: LOCAL_ACTOR,
        at: checkedAt
      }
    ]
  }
  const projected = projectCanonicalAudioProviderStatus(projection)
  if (projected.status !== 'failed' || projected.attempts !== 0) {
    throw UsageError('TTS branch-only readiness failure did not project failed with zero attempts.')
  }
  const namespace = plan.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return {
    service: options.target.service,
    model: options.target.model,
    local: false,
    operation: plan.operation,
    targetKey: plan.targetKey,
    transport: plan.transport,
    artifactDir: targetRelativeDir,
    status: projected.status,
    attempts: projected.attempts,
    options: {},
    metadata: { [namespace]: projection },
    result: { [namespace]: projection },
    error: projectedError
  }
}
