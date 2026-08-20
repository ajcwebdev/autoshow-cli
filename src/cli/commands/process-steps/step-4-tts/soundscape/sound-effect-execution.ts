import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { CacheEntry, CompactSfx, CompactSfxEntry, HostedConcurrencyCoordinator, PersistedSoundEffectResponse, SoundEffectAdapter, SoundEffectAdmissionStarted, SoundEffectAdmissionTerminal, SoundEffectGenerationResponse, SoundEffectLicenseUse, SoundEffectRenderPlan, SoundEffectRenderResult, SoundEffectRenderResultEntry, SoundEffectRenderTask, SoundEffectTarget, SoundscapePlan } from '~/types'
import { AppError, CLIUsageError, hasErrorCode } from '~/utils/error-handler'
import { formatRetryExhaustedMessage, getRetryPolicyForClass, logRetryAttempt, sleepWithAbortSignal } from '~/utils/retries'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { isMissingArtifactError, readContainedArtifactFile, removeContainedDirectory, writeImmutableArtifactFile, writeReplaceableArtifactFile } from '../script-to-audio/safe-artifact-store'
import { serializeElevenLabsSoundEffectRequest, validateElevenLabsSoundEffectTask } from './elevenlabs-sfx-adapter'
import {
  assertAudioGenDispatchEligible,
  assertAudioGenLicenseEligible,
  serializeReplicateAudioGenRequest,
  validateReplicateAudioGenTask,
} from './replicate-audiogen-adapter'
import { serializeStabilitySoundEffectRequest, validateStabilitySoundEffectTask } from './stability-stable-audio-adapter'
import { SoundEffectProviderError } from './sound-effect-errors'
import { inspectSoundscapeAudio } from './soundscape-audio'
import { routeSoundscapeSynthesisTasks } from './soundscape-routing'
import { classifyHostedRateLimitPressure, runHostedConcurrencyRequest } from '../../hosted-concurrency-coordinator'

const CACHE_ROOT = join(RUNTIME_DIR, 'synthesis-cache', 'v1')
export const SOUND_EFFECT_ARCHIVE_PATH = 'audio/sound-effects/sfx.json'
export const soundEffectSourcePath = (requestIdentity: string): string => `audio/sound-effects/sources/${requestIdentity}.audio`
export const soundEffectWorkingRoot = (renderPlanId: string): string => `audio/sound-effects/${renderPlanId}`

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
    if (isMissingArtifactError(error)) return undefined
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
    if (hasErrorCode(error, 'ENOENT')) return { nextOrdinal: 1 }
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
      if (!isMissingArtifactError(error)) throw error
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
    : target.provider === 'stability'
      ? serializeStabilitySoundEffectRequest(task, target)
      : serializeElevenLabsSoundEffectRequest(task, target)

const validateSoundEffectTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  if (target.provider === 'replicate') validateReplicateAudioGenTask(task, target)
  else if (target.provider === 'stability') validateStabilitySoundEffectTask(task, target)
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
    if (isMissingArtifactError(error)) return undefined
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

const materialize = async (rootDir: string, task: SoundEffectRenderTask, bytes: Uint8Array, entry: CacheEntry, source: SoundEffectRenderResultEntry['source']): Promise<SoundEffectRenderResultEntry> => {
  const written = await writeImmutableArtifactFile(rootDir, soundEffectSourcePath(task.requestIdentity), bytes)
  return {
    cueId: task.cueId, taskId: task.taskId, generationIdentity: task.generationIdentity, requestIdentity: task.requestIdentity,
    status: 'succeeded', source,
    audio: { path: written.relativePath, sha256: written.sha256, format: entry.audio.format, durationMs: entry.audio.durationMs },
    requestEvidence: entry.requestEvidence,
  }
}

const compactSfxEntry = (entry: SoundEffectRenderResultEntry): CompactSfxEntry => ({
  cueId: entry.cueId,
  taskId: entry.taskId,
  generationIdentity: entry.generationIdentity,
  requestIdentity: entry.requestIdentity,
  status: entry.status,
  ...(entry.audio ? { audio: entry.audio } : {}),
  ...(entry.requestEvidence?.observedCharacterCost !== undefined ? { cost: { amount: entry.requestEvidence.observedCharacterCost, currency: 'USD' as const } } : {}),
  ...(entry.omissionReason ? { omissionReason: entry.omissionReason } : {}),
})

export const compactSoundEffectResult = (plan: SoundEffectRenderPlan, result: SoundEffectRenderResult): CompactSfx => {
  const base = {
    schemaVersion: 1 as const,
    renderPlanId: plan.renderPlanId,
    soundscapePlanId: plan.soundscapePlanId,
    targetKey: plan.target.targetKey,
    target: plan.target,
    ...(plan.licenseUse ? { licenseUse: plan.licenseUse } : {}),
    status: 'succeeded' as const,
    cost: plan.plannedCost,
    entries: result.entries.map(compactSfxEntry),
    createdAt: result.createdAt,
  }
  return { ...base, sfxId: hashCanonicalTtsValue(base) }
}

const projectCompactSfx = (sfx: CompactSfx): SoundEffectRenderResult => ({
  schemaVersion: 1,
  resultId: sfx.sfxId,
  renderPlanId: sfx.renderPlanId,
  soundscapePlanId: sfx.soundscapePlanId,
  targetKey: sfx.targetKey,
  status: sfx.status,
  entries: sfx.entries.map(entry => ({
    cueId: entry.cueId,
    taskId: entry.taskId,
    generationIdentity: entry.generationIdentity,
    requestIdentity: entry.requestIdentity,
    status: entry.status,
    source: 'resume',
    ...(entry.audio ? { audio: entry.audio } : {}),
    ...(entry.omissionReason ? { omissionReason: entry.omissionReason } : {}),
  })),
  createdAt: sfx.createdAt,
})

const validateCompactSfx = (sfx: CompactSfx): CompactSfx => {
  const { sfxId: _id, ...base } = sfx
  if (sfx.schemaVersion !== 1 || sfx.status !== 'succeeded' || sfx.sfxId !== hashCanonicalTtsValue(base)) throw CLIUsageError('Retained compact sound-effect archive identity is invalid.')
  return sfx
}

const compactSfxMatchesPlan = (sfx: CompactSfx, plan: SoundEffectRenderPlan): boolean =>
  sfx.renderPlanId === plan.renderPlanId && sfx.soundscapePlanId === plan.soundscapePlanId && sfx.targetKey === plan.target.targetKey

export const loadCompactSfx = async (rootDir: string, plan?: SoundEffectRenderPlan): Promise<{ value: CompactSfx, ref: { path: string, sha256: string } } | undefined> => {
  try {
    const stored = await readContainedArtifactFile(rootDir, SOUND_EFFECT_ARCHIVE_PATH)
    const sfx = validateCompactSfx(JSON.parse(stored.bytes.toString('utf8')) as CompactSfx)
    if (plan && !compactSfxMatchesPlan(sfx, plan)) return undefined
    return { value: sfx, ref: { path: stored.relativePath, sha256: stored.sha256 } }
  } catch (error) {
    if (isMissingArtifactError(error)) return undefined
    throw error
  }
}

const compactSucceededSoundEffectRender = async (rootDir: string, plan: SoundEffectRenderPlan, result: SoundEffectRenderResult): Promise<{ compact: CompactSfx, ref: { path: string, sha256: string } }> => {
  const compact = compactSoundEffectResult(plan, result)
  const written = await writeReplaceableArtifactFile(rootDir, SOUND_EFFECT_ARCHIVE_PATH, `${canonicalTtsJson(compact)}\n`)
  const referenced = new Set(compact.entries.flatMap(entry => entry.audio ? [entry.requestIdentity] : []))
  for (const entry of compact.entries) {
    if (!entry.audio) continue
    const source = await readContainedArtifactFile(rootDir, entry.audio.path)
    if (source.sha256 !== entry.audio.sha256) throw CLIUsageError(`Compact sound-effect source checksum is invalid for ${entry.cueId}.`)
  }
  try {
    const names = await readdir(join(rootDir, 'audio', 'sound-effects', 'sources'))
    for (const name of names) {
      const match = /^(.*)\.audio$/u.exec(name)
      if (!match?.[1] || referenced.has(match[1])) continue
      await rm(join(rootDir, 'audio', 'sound-effects', 'sources', name), { force: true })
    }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  await removeContainedDirectory(rootDir, soundEffectWorkingRoot(plan.renderPlanId))
  return { compact, ref: { path: written.relativePath, sha256: written.sha256 } }
}

const SOUND_EFFECT_REDISPATCH_POLICY = getRetryPolicyForClass('runtime_http_create_conservative')

export const executeSoundEffectRenderPlan = async (input: {
  rootDir: string
  plan: SoundEffectRenderPlan
  adapter: SoundEffectAdapter
  concurrency?: number | undefined
  cancellation?: AbortSignal | undefined
  maxAttempts?: number | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
}): Promise<{ result: SoundEffectRenderResult, ref: { path: string, sha256: string }, compact?: CompactSfx | undefined }> => {
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
          entries[index] = await materialize(input.rootDir, task, cached.bytes, cached.entry, 'cache-materialization')
          continue
        }
        const retainedAdmission = await readAdmission(input.rootDir, input.plan, task)
        if (retainedAdmission.blocker) throw CLIUsageError(retainedAdmission.blocker)
        let response = retainedAdmission.recovered
        let resultSource: SoundEffectRenderResultEntry['source'] = response ? 'resume' : 'provider-dispatch'
        let lastError: unknown
        let retriedDispatch = false
        let dispatchAttempts = 0
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

              // This redispatch used to be immediate and completely silent, with the
              // admission journal on disk as its only evidence. It now backs off like
              // every other paid create and reports the attempt in the shared shape.
              const delayMs = Math.round(SOUND_EFFECT_REDISPATCH_POLICY.baseDelayMs * Math.pow(2, attempt - 1))
              retriedDispatch = true
              dispatchAttempts = attempt
              logRetryAttempt({
                operation: `sound-effect-dispatch-${task.taskId}`,
                attempt,
                maxAttempts,
                reason: 'provider rejected the paid create',
                delayMs
              }, {
                retryClass: 'runtime_http_create_conservative',
                provider: input.plan.target.provider,
                taskId: task.taskId,
                renderPlanId: input.plan.renderPlanId
              })
              await sleepWithAbortSignal(Math.min(delayMs, SOUND_EFFECT_REDISPATCH_POLICY.maxDelayMs), cancellation)
            }
          }
        }
        if (!response) {
          if (!retriedDispatch) throw lastError ?? CLIUsageError('Sound-effect provider returned no response.')
          throw new AppError(
            formatRetryExhaustedMessage(`sound-effect-dispatch-${task.taskId}`, dispatchAttempts, maxAttempts, 'max attempts reached', 0),
            {
              kind: 'retry_exhausted',
              stage: 'soundscape:sound-effect',
              retryClass: 'runtime_http_create_conservative',
              ...(lastError instanceof Error ? { cause: lastError } : {}),
              metadata: {
                taskId: task.taskId,
                renderPlanId: input.plan.renderPlanId,
                attemptsMade: dispatchAttempts,
                maxAttempts,
                stopReason: 'max attempts reached'
              }
            }
          )
        }
        const temporaryRoot = join(input.rootDir, 'audio', 'sound-effects', `.work-${randomUUID()}`)
        const temporary = join(temporaryRoot, `${task.requestIdentity}.audio`)
        await mkdir(temporaryRoot, { recursive: true })
        try {
          await Bun.write(temporary, response.bytes)
          const observed = await inspectSoundscapeAudio(temporary)
          const cacheEntry = await writeCache(task, input.plan, response, observed)
          entries[index] = await materialize(input.rootDir, task, response.bytes, cacheEntry, resultSource)
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
  if (status === 'succeeded') {
    const compacted = await compactSucceededSoundEffectRender(input.rootDir, input.plan, result)
    return { result, ref: compacted.ref, compact: compacted.compact }
  }
  const path = `audio/sound-effects/${input.plan.renderPlanId}/failed-results/${result.resultId}/sound-effect-render-result.json`
  const written = await writeImmutableArtifactFile(input.rootDir, path, `${canonicalTtsJson(result)}\n`)
  return { result, ref: { path: written.relativePath, sha256: written.sha256 } }
}

export const loadSoundEffectRenderResult = async (rootDir: string, plan: SoundEffectRenderPlan): Promise<SoundEffectRenderResult | undefined> => {
  const compact = await loadCompactSfx(rootDir, plan)
  if (compact) {
    for (const entry of compact.value.entries) if (entry.audio) {
      const audio = await readContainedArtifactFile(rootDir, entry.audio.path)
      if (audio.sha256 !== entry.audio.sha256) throw CLIUsageError(`Retained sound-effect audio checksum is invalid for ${entry.cueId}.`)
    }
    return projectCompactSfx(compact.value)
  }
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
    if (hasErrorCode(error, 'ENOENT')) return undefined
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
