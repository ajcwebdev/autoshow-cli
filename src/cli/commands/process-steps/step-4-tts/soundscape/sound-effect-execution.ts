import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { HostedConcurrencyCoordinator, ObservedAudioFormat, SoundEffectGenerationResponse, SoundEffectLicenseUse, SoundEffectRenderPlan, SoundEffectRenderResult, SoundEffectRenderResultEntry, SoundEffectRenderTask, SoundEffectTarget, SoundscapePlan } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from '../script-to-audio/safe-artifact-store'
import { serializeElevenLabsSoundEffectRequest, validateElevenLabsSoundEffectTask } from './elevenlabs-sfx-adapter'
import {
  assertAudioGenDispatchEligible,
  assertAudioGenLicenseEligible,
  serializeReplicateAudioGenRequest,
  validateReplicateAudioGenTask,
} from './replicate-audiogen-adapter'
import { SoundEffectProviderError } from './sound-effect-errors'
import { inspectSoundscapeAudio } from './soundscape-audio'
import { routeSoundscapeSynthesisTasks } from './soundscape-routing'
import { classifyHostedRateLimitPressure, runHostedConcurrencyRequest } from '../../hosted-concurrency-coordinator'

const CACHE_ROOT = join(RUNTIME_DIR, 'synthesis-cache', 'v1')

type CacheEntry = {
  schemaVersion: 1
  cacheNamespace: 'shared-synthesis-v1'
  modality: 'sound-effect'
  requestIdentity: string
  targetKey: string
  capabilityFixtureHash: string
  serializerVersion: string
  audio: { path: 'audio.bin', sha256: string, format: ObservedAudioFormat, durationMs: number }
  requestEvidence: SoundEffectGenerationResponse['requestEvidence']
  createdAt: string
}

type SoundEffectAdmissionStarted = {
  schemaVersion: 1
  eventId: string
  state: 'dispatch-started'
  renderPlanId: string
  requestIdentity: string
  requestOrdinal: number
  targetKey: string
  createdAt: string
}

type SoundEffectAdmissionTerminal = {
  schemaVersion: 1
  eventId: string
  state: 'provider-succeeded' | 'rejected' | 'ambiguous'
  renderPlanId: string
  requestIdentity: string
  requestOrdinal: number
  targetKey: string
  response?: {
    audio: { path: string, sha256: string }
    evidence: { path: string, sha256: string }
  } | undefined
  sanitizedReason?: string | undefined
  createdAt: string
}

type PersistedSoundEffectResponse = {
  schemaVersion: 1
  responsePackageId: string
  requestIdentity: string
  requestOrdinal: number
  audioSha256: string
  contentType: string
  providerRequestId?: string | undefined
  observedCharacterCost?: number | undefined
  requestEvidence: SoundEffectGenerationResponse['requestEvidence']
}

const admissionRoot = (plan: SoundEffectRenderPlan, task: SoundEffectRenderTask): string => `audio/sound-effects/${plan.renderPlanId}/admissions/${task.requestIdentity}`
const admissionOrdinal = (value: number): string => String(value).padStart(4, '0')
const admissionEvent = <T extends Omit<SoundEffectAdmissionStarted, 'eventId'> | Omit<SoundEffectAdmissionTerminal, 'eventId'>>(value: T): T & { eventId: string } => ({ ...value, eventId: hashCanonicalTtsValue(value) })

const sanitizeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error))
  .replace(/(?:api[_-]?key|authorization|xi-api-key)\s*[:=]\s*\S+/giu, '[redacted]')

const readPersistedProviderResponse = async (rootDir: string, root: string, ordinal: number): Promise<SoundEffectGenerationResponse | undefined> => {
  const prefix = `${root}/${admissionOrdinal(ordinal)}`
  try {
    const evidenceFile = await readContainedArtifactFile(rootDir, `${prefix}-provider-response.json`)
    const evidence = JSON.parse(evidenceFile.bytes.toString('utf8')) as PersistedSoundEffectResponse
    const audio = await readContainedArtifactFile(rootDir, `${prefix}-provider-response.audio`)
    const { responsePackageId: _packageId, ...evidenceBase } = evidence
    const { requestEvidenceId: _evidenceId, ...requestEvidenceBase } = evidence.requestEvidence
    if (evidence.schemaVersion !== 1 || evidence.requestIdentity !== evidence.requestEvidence.requestIdentity || evidence.requestOrdinal !== ordinal || evidence.requestEvidence.requestOrdinal !== ordinal || evidence.audioSha256 !== audio.sha256 || evidence.responsePackageId !== hashCanonicalTtsValue(evidenceBase) || evidence.requestEvidence.requestEvidenceId !== hashCanonicalTtsValue(requestEvidenceBase)) throw CLIUsageError('Retained sound-effect provider response evidence is invalid.')
    return {
      bytes: audio.bytes,
      contentType: evidence.contentType,
      ...(evidence.providerRequestId ? { providerRequestId: evidence.providerRequestId } : {}),
      ...(evidence.observedCharacterCost !== undefined ? { observedCharacterCost: evidence.observedCharacterCost } : {}),
      requestEvidence: evidence.requestEvidence,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return undefined
    if (error instanceof Error && /does not exist|no such file/iu.test(error.message)) return undefined
    throw error
  }
}

const readAdmission = async (rootDir: string, plan: SoundEffectRenderPlan, task: SoundEffectRenderTask): Promise<{
  nextOrdinal: number
  recovered?: SoundEffectGenerationResponse | undefined
  blocker?: string | undefined
}> => {
  const relativeRoot = admissionRoot(plan, task)
  let names: string[]
  try { names = await readdir(join(rootDir, relativeRoot)) }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return { nextOrdinal: 1 }
    throw error
  }
  const ordinals = [...new Set(names.flatMap(name => {
    const match = /^(\d{4})-(?:dispatch-started|terminal|provider-response)\.(?:json|audio)$/u.exec(name)
    return match?.[1] ? [Number(match[1])] : []
  }))].sort((left, right) => left - right)
  for (const ordinal of ordinals) {
    const startedPath = `${relativeRoot}/${admissionOrdinal(ordinal)}-dispatch-started.json`
    let started: SoundEffectAdmissionStarted
    try { started = JSON.parse((await readContainedArtifactFile(rootDir, startedPath)).bytes.toString('utf8')) as SoundEffectAdmissionStarted }
    catch { return { nextOrdinal: Math.max(0, ...ordinals) + 1, blocker: `Sound-effect request ${task.requestIdentity} has incomplete admission evidence.` } }
    const { eventId: _startedId, ...startedBase } = started
    if (started.state !== 'dispatch-started' || started.renderPlanId !== plan.renderPlanId || started.requestIdentity !== task.requestIdentity || started.requestOrdinal !== ordinal || started.targetKey !== plan.target.targetKey || started.eventId !== hashCanonicalTtsValue(startedBase)) throw CLIUsageError('Retained sound-effect dispatch admission identity is invalid.')
    const recovered = await readPersistedProviderResponse(rootDir, relativeRoot, ordinal)
    let terminal: SoundEffectAdmissionTerminal | undefined
    try { terminal = JSON.parse((await readContainedArtifactFile(rootDir, `${relativeRoot}/${admissionOrdinal(ordinal)}-terminal.json`)).bytes.toString('utf8')) as SoundEffectAdmissionTerminal }
    catch (error) {
      if (!(error instanceof Error && /does not exist|no such file/iu.test(error.message)) && !(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT')) throw error
    }
    if (!terminal) {
      if (recovered) return { nextOrdinal: Math.max(0, ...ordinals) + 1, recovered }
      return { nextOrdinal: Math.max(0, ...ordinals) + 1, blocker: `Sound-effect request ${task.requestIdentity} has an ambiguous provider admission and cannot be repurchased automatically.` }
    }
    const { eventId: _terminalId, ...terminalBase } = terminal
    if (terminal.renderPlanId !== plan.renderPlanId || terminal.requestIdentity !== task.requestIdentity || terminal.requestOrdinal !== ordinal || terminal.targetKey !== plan.target.targetKey || terminal.eventId !== hashCanonicalTtsValue(terminalBase)) throw CLIUsageError('Retained sound-effect terminal admission identity is invalid.')
    if (terminal.state === 'ambiguous') return { nextOrdinal: Math.max(0, ...ordinals) + 1, blocker: `Sound-effect request ${task.requestIdentity} has an ambiguous provider admission and cannot be repurchased automatically${terminal.sanitizedReason ? `: ${terminal.sanitizedReason}` : '.'}` }
    if (terminal.state === 'provider-succeeded') {
      if (!recovered) return { nextOrdinal: Math.max(0, ...ordinals) + 1, blocker: `Sound-effect request ${task.requestIdentity} succeeded remotely but its response is incomplete; automatic redispatch is blocked.` }
      return { nextOrdinal: Math.max(0, ...ordinals) + 1, recovered }
    }
  }
  return { nextOrdinal: Math.max(0, ...ordinals) + 1 }
}

const writeAdmissionStarted = async (rootDir: string, plan: SoundEffectRenderPlan, task: SoundEffectRenderTask, ordinal: number): Promise<void> => {
  const value = admissionEvent({ schemaVersion: 1 as const, state: 'dispatch-started' as const, renderPlanId: plan.renderPlanId, requestIdentity: task.requestIdentity, requestOrdinal: ordinal, targetKey: plan.target.targetKey, createdAt: new Date().toISOString() })
  await writeImmutableArtifactFile(rootDir, `${admissionRoot(plan, task)}/${admissionOrdinal(ordinal)}-dispatch-started.json`, `${canonicalTtsJson(value)}\n`)
}

const writeAdmissionTerminal = async (rootDir: string, plan: SoundEffectRenderPlan, task: SoundEffectRenderTask, ordinal: number, state: SoundEffectAdmissionTerminal['state'], input: { response?: SoundEffectGenerationResponse | undefined, reason?: string | undefined } = {}): Promise<void> => {
  let responseRefs: SoundEffectAdmissionTerminal['response']
  if (input.response) {
    const prefix = `${admissionRoot(plan, task)}/${admissionOrdinal(ordinal)}-provider-response`
    const audio = await writeImmutableArtifactFile(rootDir, `${prefix}.audio`, input.response.bytes)
    const evidenceBase = {
      schemaVersion: 1 as const, requestIdentity: task.requestIdentity, requestOrdinal: ordinal, contentType: input.response.contentType,
      audioSha256: audio.sha256,
      ...(input.response.providerRequestId ? { providerRequestId: input.response.providerRequestId } : {}),
      ...(input.response.observedCharacterCost !== undefined ? { observedCharacterCost: input.response.observedCharacterCost } : {}),
      requestEvidence: input.response.requestEvidence,
    }
    const evidence: PersistedSoundEffectResponse = { ...evidenceBase, responsePackageId: hashCanonicalTtsValue(evidenceBase) }
    const evidenceRef = await writeImmutableArtifactFile(rootDir, `${prefix}.json`, `${canonicalTtsJson(evidence)}\n`)
    responseRefs = { audio: { path: audio.relativePath, sha256: audio.sha256 }, evidence: { path: evidenceRef.relativePath, sha256: evidenceRef.sha256 } }
  }
  const value = admissionEvent({
    schemaVersion: 1 as const, state, renderPlanId: plan.renderPlanId, requestIdentity: task.requestIdentity, requestOrdinal: ordinal, targetKey: plan.target.targetKey,
    ...(responseRefs ? { response: responseRefs } : {}), ...(input.reason ? { sanitizedReason: input.reason } : {}), createdAt: new Date().toISOString(),
  })
  await writeImmutableArtifactFile(rootDir, `${admissionRoot(plan, task)}/${admissionOrdinal(ordinal)}-terminal.json`, `${canonicalTtsJson(value)}\n`)
}

const serializeSoundEffectRequest = (task: SoundEffectRenderTask, target: SoundEffectTarget) =>
  target.provider === 'replicate'
    ? serializeReplicateAudioGenRequest(task, target)
    : serializeElevenLabsSoundEffectRequest(task, target)

const validateSoundEffectTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  if (target.provider === 'replicate') validateReplicateAudioGenTask(task, target)
  else validateElevenLabsSoundEffectTask(task, target)
}

const requestIdentityFor = (task: SoundEffectRenderTask, target: SoundEffectTarget): string =>
  hashCanonicalTtsValue({
    operation: 'sound-effect-generation',
    provider: target.provider,
    model: target.model,
    transport: target.transport,
    serializerVersion: target.capabilityFixture.serializerVersion,
    capabilityFixtureHash: target.capabilityFixture.capabilityFixtureHash,
    request: serializeSoundEffectRequest(task, target),
  })

const planSoundEffectCost = (tasks: readonly SoundEffectRenderTask[], pricing: SoundEffectRenderPlan['target']['capabilityFixture']['pricing']): { amount: number | null, basis: string } => {
  if (pricing.typicalPerPrediction !== undefined && pricing.inputDependent) {
    return {
      amount: tasks.length * pricing.typicalPerPrediction,
      basis: 'version-qualified typical per-prediction estimate with input-dependent variance',
    }
  }
  if (tasks.some(task => task.durationSeconds === undefined)) return { amount: null, basis: 'unknown:auto-duration pricing is not represented as zero' }
  return {
    amount: tasks.reduce((sum, task) => sum + ((task.durationSeconds as number) / 60) * pricing.specifiedDurationPerMinute, 0),
    basis: 'published specified-duration per-minute API rate',
  }
}

const validatePlanIdentity = (plan: SoundEffectRenderPlan): SoundEffectRenderPlan => {
  if (plan.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(plan.soundscapePlanId) || !plan.target.targetKey) throw CLIUsageError('Sound-effect render plan has invalid source or target identity.')
  if (plan.target.capabilityFixture.capabilityFixtureHash !== hashCanonicalTtsValue((({ capabilityFixtureHash: _hash, ...rest }) => rest)(plan.target.capabilityFixture))) throw CLIUsageError('Sound-effect capability fixture hash is invalid.')
  if (plan.target.provider === 'replicate') {
    assertAudioGenLicenseEligible(plan.licenseUse, plan.target.capabilityFixture)
  }
  if (plan.routingDecisions) {
    const dedicated = new Set(plan.routingDecisions.filter(decision => decision.route === 'dedicated-sfx').map(decision => decision.cueId))
    if (plan.routingDecisions.some(decision => decision.route === 'unsupported' && decision.required)) throw CLIUsageError('Sound-effect render plan records a required unsupported cue.')
    if (plan.tasks.some(task => !dedicated.has(task.cueId)) || dedicated.size !== plan.tasks.length) throw CLIUsageError('Sound-effect render plan routing decisions do not match dedicated-sfx tasks.')
  }
  for (const task of plan.tasks) {
    validateSoundEffectTask(task, plan.target)
    if (requestIdentityFor(task, plan.target) !== task.requestIdentity) throw CLIUsageError(`Sound-effect request ${task.taskId} has invalid provider-qualified identity.`)
  }
  const { renderPlanId: _id, ...withoutId } = plan
  if (plan.renderPlanId !== hashCanonicalTtsValue(withoutId)) throw CLIUsageError('Sound-effect render plan content identity is invalid.')
  return plan
}

const validatePlan = (plan: SoundEffectRenderPlan): SoundEffectRenderPlan => validatePlanIdentity(plan)

export const createSoundEffectRenderPlan = (input: {
  plan: SoundscapePlan
  target: SoundEffectTarget
  createdAt?: string | undefined
  licenseUse?: SoundEffectLicenseUse | undefined
  allowUnavailable?: boolean | undefined
}): SoundEffectRenderPlan => {
  if (input.target.provider === 'replicate' && !input.allowUnavailable) {
    assertAudioGenDispatchEligible(input.target.capabilityFixture)
  }
  const licenseUse = input.target.provider === 'replicate'
    ? assertAudioGenLicenseEligible(input.licenseUse, input.target.capabilityFixture)
    : undefined
  const routed = routeSoundscapeSynthesisTasks({ tasks: input.plan.synthesisTasks, target: input.target })
  const tasks: SoundEffectRenderTask[] = routed.sfxTasks.map((task) => {
    const requestBase = { ...task, requestIdentity: '', outputFormat: input.target.outputFormat, promptInfluence: input.target.promptInfluence }
    return { ...task, requestIdentity: requestIdentityFor(requestBase, input.target), outputFormat: input.target.outputFormat, promptInfluence: input.target.promptInfluence }
  })
  const plannedCost = planSoundEffectCost(tasks, input.target.capabilityFixture.pricing)
  const base = {
    schemaVersion: 1 as const,
    soundscapePlanId: input.plan.soundscapePlanId,
    target: input.target,
    tasks,
    plannedCost: { amount: plannedCost.amount, currency: 'USD' as const, basis: plannedCost.basis },
    routingDecisions: routed.decisions,
    ...(licenseUse ? { licenseUse } : {}),
    createdAt: input.createdAt ?? input.plan.createdAt,
  }
  return validatePlanIdentity({ ...base, renderPlanId: hashCanonicalTtsValue(base) })
}

export const writeSoundEffectRenderPlan = async (rootDir: string, plan: SoundEffectRenderPlan): Promise<{ path: string, sha256: string }> => {
  validatePlan(plan)
  const path = `audio/sound-effects/${plan.renderPlanId}/sound-effect-render-plan.json`
  const bytes = `${canonicalTtsJson(plan)}\n`
  const written = await writeImmutableArtifactFile(rootDir, path, bytes)
  return { path: written.relativePath, sha256: written.sha256 }
}

export const loadSoundEffectRenderPlan = async (rootDir: string, ref: { path: string, sha256: string }): Promise<SoundEffectRenderPlan> => {
  const stored = await readContainedArtifactFile(rootDir, ref.path)
  if (stored.sha256 !== ref.sha256) throw CLIUsageError('Retained sound-effect render plan checksum is invalid.')
  return validatePlan(JSON.parse(stored.bytes.toString('utf8')) as SoundEffectRenderPlan)
}

const readCache = async (task: SoundEffectRenderTask, plan: SoundEffectRenderPlan): Promise<{ entry: CacheEntry, bytes: Buffer } | undefined> => {
  const base = `sound-effects/${task.requestIdentity}`
  try {
    const stored = await readContainedArtifactFile(CACHE_ROOT, `${base}/cache-entry.json`)
    const entry = JSON.parse(stored.bytes.toString('utf8')) as CacheEntry
    if (entry.schemaVersion !== 1 || entry.requestIdentity !== task.requestIdentity || entry.targetKey !== plan.target.targetKey || entry.capabilityFixtureHash !== plan.target.capabilityFixture.capabilityFixtureHash || entry.serializerVersion !== plan.target.capabilityFixture.serializerVersion) throw CLIUsageError('Sound-effect synthesis cache entry identity is incompatible.')
    const audio = await readContainedArtifactFile(CACHE_ROOT, `${base}/${entry.audio.path}`)
    if (audio.sha256 !== entry.audio.sha256) throw CLIUsageError('Sound-effect synthesis cache audio checksum is invalid.')
    return { entry, bytes: audio.bytes }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return undefined
    if (error instanceof Error && /does not exist|no such file/iu.test(error.message)) return undefined
    throw error
  }
}

const writeCache = async (task: SoundEffectRenderTask, plan: SoundEffectRenderPlan, response: SoundEffectGenerationResponse, observed: Awaited<ReturnType<typeof inspectSoundscapeAudio>>): Promise<CacheEntry> => {
  await mkdir(CACHE_ROOT, { recursive: true, mode: 0o700 })
  const base = `sound-effects/${task.requestIdentity}`
  const audio = await writeImmutableArtifactFile(CACHE_ROOT, `${base}/audio.bin`, response.bytes)
  const entry: CacheEntry = {
    schemaVersion: 1, cacheNamespace: 'shared-synthesis-v1', modality: 'sound-effect', requestIdentity: task.requestIdentity,
    targetKey: plan.target.targetKey, capabilityFixtureHash: plan.target.capabilityFixture.capabilityFixtureHash, serializerVersion: plan.target.capabilityFixture.serializerVersion,
    audio: { path: 'audio.bin', sha256: audio.sha256, format: observed.format, durationMs: observed.durationMs },
    requestEvidence: response.requestEvidence, createdAt: response.requestEvidence.capturedAt,
  }
  await writeImmutableArtifactFile(CACHE_ROOT, `${base}/cache-entry.json`, `${canonicalTtsJson(entry)}\n`)
  return entry
}

const materialize = async (rootDir: string, plan: SoundEffectRenderPlan, task: SoundEffectRenderTask, bytes: Uint8Array, entry: CacheEntry, source: SoundEffectRenderResultEntry['source']): Promise<SoundEffectRenderResultEntry> => {
  const path = `audio/sound-effects/${plan.renderPlanId}/sources/${task.requestIdentity}.audio`
  const written = await writeImmutableArtifactFile(rootDir, path, bytes)
  return {
    cueId: task.cueId, taskId: task.taskId, generationIdentity: task.generationIdentity, requestIdentity: task.requestIdentity,
    status: 'succeeded', source,
    audio: { path: written.relativePath, sha256: written.sha256, format: entry.audio.format, durationMs: entry.audio.durationMs },
    requestEvidence: entry.requestEvidence,
  }
}

export type SoundEffectAdapter = { generate(task: SoundEffectRenderTask, target: SoundEffectTarget, requestOrdinal: number, cancellation: AbortSignal): Promise<SoundEffectGenerationResponse> }

export const executeSoundEffectRenderPlan = async (input: {
  rootDir: string
  plan: SoundEffectRenderPlan
  adapter: SoundEffectAdapter
  concurrency?: number | undefined
  cancellation?: AbortSignal | undefined
  maxAttempts?: number | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
}): Promise<{ result: SoundEffectRenderResult, ref: { path: string, sha256: string } }> => {
  validatePlan(input.plan)
  const cancellation = input.cancellation ?? new AbortController().signal
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 2, 8, input.plan.tasks.length || 1))
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 3, 5))
  const entries = new Array<SoundEffectRenderResultEntry>(input.plan.tasks.length)
  let next = 0
  let canceled = false
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++
      if (index >= input.plan.tasks.length) return
      const task = input.plan.tasks[index] as SoundEffectRenderTask
      try {
        cancellation.throwIfAborted()
        const cached = await readCache(task, input.plan)
        if (cached) {
          entries[index] = await materialize(input.rootDir, input.plan, task, cached.bytes, cached.entry, 'cache-materialization')
          continue
        }
        const retainedAdmission = await readAdmission(input.rootDir, input.plan, task)
        if (retainedAdmission.blocker) throw CLIUsageError(retainedAdmission.blocker)
        let response = retainedAdmission.recovered
        let resultSource: SoundEffectRenderResultEntry['source'] = response ? 'resume' : 'provider-dispatch'
        let lastError: unknown
        let nextRequestOrdinal = retainedAdmission.nextOrdinal
        if (!response) {
          if (input.plan.target.provider === 'replicate') assertAudioGenDispatchEligible(input.plan.target.capabilityFixture)
          for (let attempt = 1; ; attempt++) {
            cancellation.throwIfAborted()
            try {
              const dispatch = async (): Promise<SoundEffectGenerationResponse> => {
                const ordinal = nextRequestOrdinal++
                await writeAdmissionStarted(input.rootDir, input.plan, task, ordinal)
                try {
                  const generated = await input.adapter.generate(task, input.plan.target, ordinal, cancellation)
                  await writeAdmissionTerminal(input.rootDir, input.plan, task, ordinal, 'provider-succeeded', { response: generated })
                  return generated
                } catch (error) {
                  const disposition = error instanceof SoundEffectProviderError ? error.admissionDisposition : 'ambiguous'
                  await writeAdmissionTerminal(input.rootDir, input.plan, task, ordinal, disposition, { reason: sanitizeFailure(error) })
                  throw error
                }
              }
              response = input.hostedConcurrencyCoordinator
                ? await runHostedConcurrencyRequest({
                    coordinator: input.hostedConcurrencyCoordinator,
                    admission: {
                      provider: input.plan.target.provider,
                      workClass: 'sound-effect',
                      configuredLimit: concurrency,
                      workId: input.plan.renderPlanId,
                      unitIndex: index,
                      context: { taskId: task.taskId },
                      abortSignal: cancellation
                    },
                    classifyPressure: error => error instanceof SoundEffectProviderError && error.admissionDisposition === 'rejected'
                      ? classifyHostedRateLimitPressure(error)
                      : undefined
                  }, async () => await dispatch())
                : await dispatch()
              break
            } catch (error) {
              lastError = error
              const disposition = error instanceof SoundEffectProviderError ? error.admissionDisposition : 'ambiguous'
              if (!(error instanceof SoundEffectProviderError) || !error.retryable || disposition !== 'rejected' || attempt >= maxAttempts) break
            }
          }
        }
        if (!response) throw lastError ?? CLIUsageError('Sound-effect provider returned no response.')
        const temporaryRoot = join(input.rootDir, 'audio', 'sound-effects', `.work-${randomUUID()}`)
        const temporary = join(temporaryRoot, `${task.requestIdentity}.audio`)
        await mkdir(temporaryRoot, { recursive: true })
        try {
          await Bun.write(temporary, response.bytes)
          const observed = await inspectSoundscapeAudio(temporary)
          const cacheEntry = await writeCache(task, input.plan, response, observed)
          entries[index] = await materialize(input.rootDir, input.plan, task, response.bytes, cacheEntry, resultSource)
        } finally {
          await rm(temporaryRoot, { recursive: true, force: true })
        }
      } catch (error) {
        if (cancellation.aborted) canceled = true
        entries[index] = {
          cueId: task.cueId, taskId: task.taskId, generationIdentity: task.generationIdentity, requestIdentity: task.requestIdentity,
          status: 'omitted', source: 'provider-dispatch', omissionReason: sanitizeFailure(error),
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const requiredFailure = input.plan.tasks.some((task, index) => task.required && entries[index]?.status !== 'succeeded')
  const status = canceled ? 'canceled' as const : requiredFailure ? 'failed' as const : 'succeeded' as const
  const base = { schemaVersion: 1 as const, renderPlanId: input.plan.renderPlanId, soundscapePlanId: input.plan.soundscapePlanId, targetKey: input.plan.target.targetKey, status, entries: entries.filter((entry): entry is SoundEffectRenderResultEntry => entry !== undefined), createdAt: new Date().toISOString() }
  const result: SoundEffectRenderResult = { ...base, resultId: hashCanonicalTtsValue(base) }
  const path = status === 'succeeded'
    ? `audio/sound-effects/${input.plan.renderPlanId}/sound-effect-render-result.json`
    : `audio/sound-effects/${input.plan.renderPlanId}/failed-results/${result.resultId}/sound-effect-render-result.json`
  const written = await writeImmutableArtifactFile(input.rootDir, path, `${canonicalTtsJson(result)}\n`)
  return { result, ref: { path: written.relativePath, sha256: written.sha256 } }
}

export const loadSoundEffectRenderResult = async (rootDir: string, plan: SoundEffectRenderPlan): Promise<SoundEffectRenderResult | undefined> => {
  const path = `audio/sound-effects/${plan.renderPlanId}/sound-effect-render-result.json`
  try {
    const bytes = await readFile(join(rootDir, path), 'utf8')
    const result = JSON.parse(bytes) as SoundEffectRenderResult
    const { resultId: _id, ...base } = result
    if (result.renderPlanId !== plan.renderPlanId || result.soundscapePlanId !== plan.soundscapePlanId || result.resultId !== hashCanonicalTtsValue(base)) throw CLIUsageError('Retained sound-effect result identity is invalid.')
    for (const entry of result.entries) if (entry.audio) {
      const audio = await readContainedArtifactFile(rootDir, entry.audio.path)
      if (audio.sha256 !== entry.audio.sha256) throw CLIUsageError(`Retained sound-effect audio checksum is invalid for ${entry.cueId}.`)
    }
    return result
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return undefined
    throw error
  }
}

export const planSoundEffectResumePrice = async (rootDir: string, plan: SoundEffectRenderPlan): Promise<{
  cachedTaskCount: number
  resumedTaskCount: number
  unresolvedTaskCount: number
  amount: number | null
  currency: 'USD'
}> => {
  const retained = await loadSoundEffectRenderResult(rootDir, plan)
  const retainedSettled = new Set(retained?.entries.map(entry => entry.requestIdentity) ?? [])
  let cachedTaskCount = 0
  let resumedTaskCount = 0
  const unresolved: SoundEffectRenderTask[] = []
  for (const task of plan.tasks) {
    if (retainedSettled.has(task.requestIdentity)) {
      resumedTaskCount++
      continue
    }
    if (await readCache(task, plan)) {
      cachedTaskCount++
      continue
    }
    const admission = await readAdmission(rootDir, plan, task)
    if (admission.blocker) throw CLIUsageError(admission.blocker)
    if (admission.recovered) {
      resumedTaskCount++
      continue
    }
    unresolved.push(task)
  }
  const planned = planSoundEffectCost(unresolved, plan.target.capabilityFixture.pricing)
  return { cachedTaskCount, resumedTaskCount, unresolvedTaskCount: unresolved.length, amount: planned.amount, currency: 'USD' }
}
