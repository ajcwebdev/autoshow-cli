import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type {
  VoiceIssuedResource,
  VoiceProvisioningAttempt,
  VoiceProvisioningState,
  RunCrashSafeProvisioningInput,
} from '~/types'
import { CLIUsageError, InfraError, ValidationError, extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { withProcessLock } from '~/utils/process-lock'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { classifyTtsProviderAdmissionError } from '../script-to-audio/tts-request-evidence'
import { validateVoiceProvisioningAttempt } from './voice-management-contracts'
import { atomicWriteJson } from '~/utils/filesystem'

const SAFE_KEY = /^[a-z0-9][a-z0-9_-]{0,127}$/

const assertSafeKey = (value: string, label: string): void => {
  if (!SAFE_KEY.test(value)) throw CLIUsageError(`${label} must be a safe lowercase key.`)
}

const attemptPath = (root: string, registrationDraftId: string, attemptId: string): string => {
  assertSafeKey(registrationDraftId, 'Registration draft ID')
  assertSafeKey(attemptId, 'Provisioning attempt ID')
  return join(resolve(root), registrationDraftId, attemptId, 'voice-provisioning-attempt.json')
}

const loadAttemptPath = async (path: string): Promise<VoiceProvisioningAttempt> => {
  if (!existsSync(path)) throw CLIUsageError('Voice provisioning attempt journal was not found.')
  let attempt: VoiceProvisioningAttempt
  try {
    attempt = JSON.parse(await readFile(path, 'utf8')) as VoiceProvisioningAttempt
  } catch (error) {
    throw ValidationError('Voice provisioning attempt journal contains invalid JSON.', { stage: 'voice:provisioning', ...(error instanceof Error ? { cause: error } : {}) })
  }
  return validateVoiceProvisioningAttempt(attempt)
}

const lockName = (root: string, registrationDraftId: string): string =>
  `voice-provision-${new Bun.CryptoHasher('sha256').update(`${resolve(root)}\0${registrationDraftId}`).digest('hex').slice(0, 32)}`

export const loadVoiceProvisioningAttempt = async (
  journalRoot: string,
  registrationDraftId: string,
  attemptId: string
): Promise<VoiceProvisioningAttempt> => await loadAttemptPath(attemptPath(journalRoot, registrationDraftId, attemptId))

export const listVoiceProvisioningAttempts = async (
  journalRoot: string,
  registrationDraftId: string
): Promise<VoiceProvisioningAttempt[]> => {
  if (!SAFE_KEY.test(registrationDraftId)) return []
  const root = join(resolve(journalRoot), registrationDraftId)
  if (!existsSync(root)) return []
  const attempts: VoiceProvisioningAttempt[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(root, entry.name, 'voice-provisioning-attempt.json')
    if (!existsSync(path)) continue
    attempts.push(await loadAttemptPath(path))
  }
  return attempts
}

const assertAppendPreservingUpdate = (
  current: VoiceProvisioningAttempt,
  next: VoiceProvisioningAttempt
): void => {
  for (const field of ['schemaVersion', 'attemptId', 'registrationDraftId', 'operation', 'accountScopeHash', 'lockLeaseId', 'requestFingerprint', 'idempotencyKey'] as const) {
    if (canonicalTtsJson(current[field] ?? null) !== canonicalTtsJson(next[field] ?? null)) throw CLIUsageError(`Provisioning update cannot change ${field}.`)
  }
  if (canonicalTtsJson(current.protectedRequestEvidence) !== canonicalTtsJson(next.protectedRequestEvidence)) throw CLIUsageError('Provisioning update cannot change protected request evidence.')
  if (canonicalTtsJson(current.reconciliation ?? null) !== canonicalTtsJson(next.reconciliation ?? null)) throw CLIUsageError('Provisioning update cannot change reconciliation strategy or evidence.')
  if (next.compareAndSwapVersion !== current.compareAndSwapVersion + 1) throw CLIUsageError('Provisioning update has a stale compare-and-swap version.')
  if (next.transitions.length < current.transitions.length || canonicalTtsJson(next.transitions.slice(0, current.transitions.length)) !== canonicalTtsJson(current.transitions)) {
    throw CLIUsageError('Provisioning transitions must be append-preserving.')
  }
  if (next.issuedResources.length < current.issuedResources.length || canonicalTtsJson(next.issuedResources.slice(0, current.issuedResources.length)) !== canonicalTtsJson(current.issuedResources)) {
    throw CLIUsageError('Provisioning issued resources must be append-preserving.')
  }
  if (current.outcome !== undefined && canonicalTtsJson(current.outcome) !== canonicalTtsJson(next.outcome)) {
    const appendedPhases = next.transitions.slice(current.transitions.length).map(entry => entry.phase)
    const isReconciliation = current.outcome.state === 'reconciliation-required'
      && next.outcome !== undefined
      && next.outcome.state !== 'reconciliation-required'
      && appendedPhases.includes('reconciled')
    if (!isReconciliation) throw CLIUsageError('Provisioning outcome is immutable except through an explicit reconciliation transition.')
  }
}

const transition = (
  attempt: VoiceProvisioningAttempt,
  phase: VoiceProvisioningAttempt['transitions'][number]['phase'],
  evidenceHash?: string | undefined
): VoiceProvisioningAttempt => ({
  ...attempt,
  transitions: [...attempt.transitions, {
    sequence: attempt.transitions.length + 1,
    phase,
    at: new Date().toISOString(),
    ...(evidenceHash ? { evidenceHash } : {})
  }],
  compareAndSwapVersion: attempt.compareAndSwapVersion + 1
})

const markAmbiguous = async (
  path: string,
  attempt: VoiceProvisioningAttempt,
  error: unknown
): Promise<VoiceProvisioningAttempt> => {
  if (attempt.outcome) return attempt
  const reason = error instanceof Error ? error.message : String(error)
  let next = transition(attempt, 'ambiguous', hashCanonicalTtsValue({ reason }))
  await atomicWriteJson(path, next)
  next = {
    ...transition(next, 'terminal'),
    outcome: {
      state: 'reconciliation-required',
      attemptId: next.attemptId,
      reason: 'Provider mutation may have been admitted; reconcile the durable attempt before retrying.'
    }
  }
  validateVoiceProvisioningAttempt(next)
  await atomicWriteJson(path, next)
  return next
}

const markRejected = async (
  path: string,
  attempt: VoiceProvisioningAttempt,
  error: unknown
): Promise<VoiceProvisioningAttempt> => {
  if (attempt.outcome) return attempt
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const message = sanitizeLogText(error instanceof Error ? error.message : String(error)).slice(0, 600)
  const evidenceHash = hashCanonicalTtsValue({ status: status ?? null, message })
  let next = transition(attempt, 'response-received', evidenceHash)
  await atomicWriteJson(path, next)
  next = {
    ...transition(next, 'terminal', evidenceHash),
    outcome: {
      state: 'failed',
      code: status === undefined ? 'PROVIDER_REJECTED' : `HTTP_${status}`,
      message
    }
  }
  validateVoiceProvisioningAttempt(next)
  await atomicWriteJson(path, next)
  return next
}

const assertSameProvisioningIntent = (
  current: VoiceProvisioningAttempt,
  proposed: VoiceProvisioningAttempt
): void => {
  for (const field of ['schemaVersion', 'attemptId', 'registrationDraftId', 'operation', 'accountScopeHash', 'requestFingerprint', 'idempotencyKey'] as const) {
    if (canonicalTtsJson(current[field] ?? null) !== canonicalTtsJson(proposed[field] ?? null)) {
      throw CLIUsageError(`Existing provisioning attempt does not match proposed ${field}.`)
    }
  }
  if (canonicalTtsJson(current.protectedRequestEvidence) !== canonicalTtsJson(proposed.protectedRequestEvidence)
    || canonicalTtsJson(current.reconciliation ?? null) !== canonicalTtsJson(proposed.reconciliation ?? null)) {
    throw CLIUsageError('Existing provisioning attempt does not match the proposed protected or reconciliation evidence.')
  }
}

export const reconcileVoiceProvisioningAttempt = async (input: {
  journalRoot: string
  registrationDraftId: string
  attemptId: string
  outcome: Exclude<VoiceProvisioningState, { state: 'reconciliation-required' }>
  issuedResources?: VoiceIssuedResource[] | undefined
  evidenceHash: string
}): Promise<VoiceProvisioningAttempt> => await withProcessLock(lockName(input.journalRoot, input.registrationDraftId), async () => {
  const path = attemptPath(input.journalRoot, input.registrationDraftId, input.attemptId)
  let current = await loadAttemptPath(path)
  if (current.outcome?.state === 'ready') return current
  if (current.outcome?.state !== 'reconciliation-required') throw CLIUsageError('Only a reconciliation-required provisioning attempt can be reconciled.')
  const existingKeys = new Set(current.issuedResources.map(resource => canonicalTtsJson(resource.providerVoice)))
  const issuedResources = [...current.issuedResources]
  for (const resource of input.issuedResources ?? []) {
    const key = canonicalTtsJson(resource.providerVoice)
    if (!existingKeys.has(key)) {
      existingKeys.add(key)
      issuedResources.push(resource)
    }
  }
  const reconciled = { ...transition(current, 'reconciled', input.evidenceHash), issuedResources, outcome: input.outcome }
  assertAppendPreservingUpdate(current, reconciled)
  validateVoiceProvisioningAttempt(reconciled)
  await atomicWriteJson(path, reconciled)
  const next = transition(reconciled, 'terminal', input.evidenceHash)
  assertAppendPreservingUpdate(reconciled, next)
  validateVoiceProvisioningAttempt(next)
  await atomicWriteJson(path, next)
  return next
})

export const requireVoiceProvisioningReconciliation = async (
  journalRoot: string,
  registrationDraftId: string,
  attemptId: string
): Promise<VoiceProvisioningAttempt> => await withProcessLock(lockName(journalRoot, registrationDraftId), async () => {
  const path = attemptPath(journalRoot, registrationDraftId, attemptId)
  const current = await loadAttemptPath(path)
  if (current.outcome !== undefined) return current
  if (!current.transitions.some(entry => entry.phase === 'request-sent')) {
    throw CLIUsageError('Prepared provisioning has not reached the provider and can be safely resumed through the original management action.')
  }
  return await markAmbiguous(path, current, InfraError('Provisioning stopped after request dispatch without a durable terminal outcome.', { stage: 'tts:voice-provisioning', retryable: false }))
})

export const runCrashSafeVoiceProvisioning = async (
  input: RunCrashSafeProvisioningInput
): Promise<VoiceProvisioningAttempt> => {
  const initial = validateVoiceProvisioningAttempt(input.attempt)
  const path = attemptPath(input.journalRoot, initial.registrationDraftId, initial.attemptId)
  return await withProcessLock(lockName(input.journalRoot, initial.registrationDraftId), async () => {
    let attempt: VoiceProvisioningAttempt
    if (existsSync(path)) {
      attempt = await loadAttemptPath(path)
      if (attempt.outcome?.state === 'ready') return attempt
      if (attempt.outcome?.state === 'failed') return attempt
      assertSameProvisioningIntent(attempt, initial)
      if (attempt.transitions.length === 1 && attempt.transitions[0]?.phase === 'prepared' && attempt.outcome === undefined) {
        // The durable journal proves the provider mutation was never admitted, so resuming this exact
        // attempt is safe. Preserve the original lease and prepared transition.
      } else if (attempt.outcome === undefined && attempt.transitions.some(entry => entry.phase === 'request-sent')) {
        await markAmbiguous(path, attempt, InfraError('Provisioning stopped after request dispatch without a durable terminal outcome.', { stage: 'tts:voice-provisioning', retryable: false }))
        throw CLIUsageError('Voice provisioning may have reached the provider; automatic redispatch is blocked pending reconciliation. Pass --reconcile to safely complete the durable attempt without recreating the voice.')
      } else {
        throw CLIUsageError('A provisioning attempt already exists for this identity; automatic redispatch is blocked pending reconciliation. Pass --reconcile to safely complete the durable attempt without recreating the voice.')
      }
    } else {
      await atomicWriteJson(path, initial)
      attempt = initial
      await input.faultInjection?.afterPrepared?.()
    }

    attempt = transition(attempt, 'request-sent')
    await atomicWriteJson(path, attempt)
    try {
      await input.faultInjection?.afterRequestSent?.()
      const response = await input.mutate(attempt)
      const existingKeys = new Set(attempt.issuedResources.map(resource => canonicalTtsJson(resource.providerVoice)))
      const issuedResources = [...attempt.issuedResources]
      for (const resource of response.issuedResources) {
        const key = canonicalTtsJson(resource.providerVoice)
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          issuedResources.push(resource)
        }
      }
      attempt = {
        ...transition(attempt, 'response-received', response.evidenceHash),
        issuedResources
      }
      validateVoiceProvisioningAttempt(attempt)
      await atomicWriteJson(path, attempt)
      await input.faultInjection?.afterResponseRecorded?.()
      attempt = {
        ...transition(attempt, 'terminal'),
        outcome: response.state
      }
      validateVoiceProvisioningAttempt(attempt)
      await atomicWriteJson(path, attempt)
      return attempt
    } catch (error) {
      const current = await loadAttemptPath(path)
      if (classifyTtsProviderAdmissionError(error) === 'rejected') {
        await markRejected(path, current, error)
      } else {
        await markAmbiguous(path, current, error)
      }
      throw error
    }
  })
}
