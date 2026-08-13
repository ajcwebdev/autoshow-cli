import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type {
  CanonicalAudioProviderProjection,
  GenericTtsDialoguePlan,
  GenericTtsSourceIdentity,
  PipelineProviderState,
  ProviderReadinessResult,
  ProviderRenderBranchPlan,
  ProviderRenderPlan,
  ProviderVoiceRef
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import {
  validateGenericTtsDialoguePlan,
  validateGenericTtsSourceIdentity,
  validateProviderRenderPlanIdentity
} from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import type { TtsRunSourceContext } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { resolveUserPath } from '~/utils/runtime-paths'
import { parseTtsDialoguePlanArtifactRef, readTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import type { TtsDialoguePlanArtifactRef } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'

export type ResolvedTtsResumeSourceContext = TtsRunSourceContext & {
  retainedPlanIdentities: ReadonlyMap<string,
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
  >
  dialoguePlanArtifact: TtsDialoguePlanArtifactRef
}

type ProviderTtsResumeSourceContext = {
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  targetKey: string
  planIdentity:
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
}

const SOURCE_IDENTITY_FILE = 'source-identity.json'
const DIALOGUE_PLAN_FILE = 'dialogue-plan.json'

const isContainedPath = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

const assertSafeRelativePath = (value: string, label: string): void => {
  if (
    value.length === 0
    || value.includes('\\')
    || isAbsolute(value)
    || value.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw CLIUsageError(`Stored TTS ${label} is not a safe contained path. Rebuild this output before resuming it.`)
  }
}

const assertRealPathWithoutSymlinks = async (
  canonicalRoot: string,
  relativePath: string,
  kind: 'directory' | 'file',
  label: string
): Promise<string> => {
  assertSafeRelativePath(relativePath, label)
  const candidate = resolve(canonicalRoot, relativePath)
  if (!isContainedPath(canonicalRoot, candidate)) {
    throw CLIUsageError(`Stored TTS ${label} escapes its artifact root. Rebuild this output before resuming it.`)
  }

  let cursor = canonicalRoot
  for (const segment of relativePath.split('/')) {
    cursor = join(cursor, segment)
    let entry
    try {
      entry = await lstat(cursor)
    } catch {
      throw CLIUsageError(`Stored TTS ${label} is missing. Rebuild this output before resuming it.`)
    }
    if (entry.isSymbolicLink()) {
      throw CLIUsageError(`Stored TTS ${label} cannot traverse a symbolic link. Rebuild this output before resuming it.`)
    }
  }

  const entry = await lstat(candidate)
  if ((kind === 'directory' && !entry.isDirectory()) || (kind === 'file' && !entry.isFile())) {
    throw CLIUsageError(`Stored TTS ${label} has the wrong artifact type. Rebuild this output before resuming it.`)
  }
  const canonical = await realpath(candidate)
  if (!isContainedPath(canonicalRoot, canonical)) {
    throw CLIUsageError(`Stored TTS ${label} resolves outside its artifact root. Rebuild this output before resuming it.`)
  }
  return canonical
}

const readJsonRecord = async (
  canonicalArtifactRoot: string,
  relativePath: string,
  label: string,
  expectedSha256?: string | undefined
): Promise<Record<string, unknown>> => {
  const path = await assertRealPathWithoutSymlinks(canonicalArtifactRoot, relativePath, 'file', label)
  const bytes = await readFile(path)
  if (expectedSha256 !== undefined && sha256Bytes(bytes) !== expectedSha256) {
    throw CLIUsageError(`Stored TTS ${label} checksum does not match its canonical reference. Rebuild this output before resuming it.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw CLIUsageError(`Stored TTS ${label} is not valid JSON. Rebuild this output before resuming it.`)
  }
  if (!isRecord(parsed)) {
    throw CLIUsageError(`Stored TTS ${label} is not a JSON object. Rebuild this output before resuming it.`)
  }
  return parsed
}

const activeRenderForProvider = (
  provider: PipelineProviderState
): CanonicalAudioProviderProjection['renderHistory'][number] | undefined => {
  const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  if (!projection) return undefined
  if (active?.kind === 'render') {
    return projection.renderHistory.find((render) => render.renderIdentity === active.renderIdentity)
  }
  return undefined
}

const activeBranchForProvider = (
  provider: PipelineProviderState
): CanonicalAudioProviderProjection['branchHistory'][number] | undefined => {
  const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  return projection && active?.kind === 'branch'
    ? projection.branchHistory.find((branch) => branch.branchPlanId === active.branchPlanId)
    : undefined
}

export const readRetainedTtsResolvedVoices = async (
  rootDir: string,
  provider: PipelineProviderState
): Promise<ProviderVoiceRef[]> => {
  if (!provider.targetKey) {
    throw CLIUsageError('Stored TTS voice evidence is missing its operation-scoped target identity. Rebuild this output before resuming it.')
  }
  const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  if (!projection || !active || active.kind === 'policy-skip') return []
  const canonicalRoot = await realpath(rootDir)
  const canonicalArtifactRoot = await assertRealPathWithoutSymlinks(
    canonicalRoot,
    provider.artifactDir,
    'directory',
    'provider artifact directory'
  )
  let branchPlanId: string
  if (active.kind === 'branch') {
    branchPlanId = active.branchPlanId
  } else {
    const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
    if (!render) throw CLIUsageError('Stored TTS active render is missing its exact render history. Rebuild this output before resuming it.')
    const renderPlan = validateProviderRenderPlanIdentity(
      await readJsonRecord(canonicalArtifactRoot, render.renderPlanRef, 'active render plan', render.renderPlanSha256) as unknown as ProviderRenderPlan
    )
    branchPlanId = renderPlan.branchPlanId
  }
  const readinessRef = projection.readinessAttempts
    .filter((entry) => entry.branchPlanId === branchPlanId)
    .sort((left, right) => right.sequence - left.sequence)[0]
  if (!readinessRef) {
    throw CLIUsageError('Stored TTS active work has no checksum-bound readiness voice evidence. Rebuild this output before resuming it.')
  }
  const record = await readJsonRecord(
    canonicalArtifactRoot,
    readinessRef.readinessResultRef,
    'active readiness result',
    readinessRef.readinessResultHash
  )
  const { readinessResultHash: _readinessResultHash, ...readinessIdentity } = record
  if (
    record['schemaVersion'] !== 1
    || record['readinessResultHash'] !== hashCanonicalTtsValue(readinessIdentity)
    || record['branchPlanId'] !== branchPlanId
    || record['targetKey'] !== provider.targetKey
    || !Array.isArray(record['resolvedVoices'])
  ) {
    throw CLIUsageError('Stored TTS readiness voice evidence has an invalid identity or target binding. Rebuild this output before resuming it.')
  }
  const readiness = record as unknown as ProviderReadinessResult
  if (readiness.resolvedVoices.some((entry) => !isRecord(entry) || !isRecord(entry.providerVoice))) {
    throw CLIUsageError('Stored TTS readiness voice evidence is malformed. Rebuild this output before resuming it.')
  }
  return readiness.resolvedVoices.map((entry) => entry.providerVoice)
}

const readProviderSourceContext = async (
  rootDir: string,
  input: string,
  provider: PipelineProviderState,
  itemDialoguePlan: GenericTtsDialoguePlan
): Promise<ProviderTtsResumeSourceContext | undefined> => {
  const render = activeRenderForProvider(provider)
  const branch = activeBranchForProvider(provider)
  if (!render && !branch) return undefined

  if (!provider.targetKey) {
    throw CLIUsageError('Stored TTS active work is missing its operation-scoped target identity. Rebuild this output before resuming it.')
  }

  assertSafeRelativePath(provider.artifactDir, 'provider artifact directory')
  const canonicalRoot = await realpath(rootDir)
  const canonicalArtifactRoot = await assertRealPathWithoutSymlinks(
    canonicalRoot,
    provider.artifactDir,
    'directory',
    'provider artifact directory'
  )
  if (branch) {
    const branchPlan = await readJsonRecord(
      canonicalArtifactRoot,
      branch.branchPlanRef,
      'active branch plan',
      branch.branchPlanSha256
    ) as unknown as ProviderRenderBranchPlan
    const { branchPlanId: _branchPlanId, ...branchIdentity } = branchPlan
    if (
      branchPlan.schemaVersion !== 1
      || hashCanonicalTtsValue(branchIdentity) !== branchPlan.branchPlanId
      || branchPlan.branchPlanId !== branch.branchPlanId
      || branchPlan.targetKey !== provider.targetKey
      || branchPlan.operation !== provider.operation
      || branchPlan.provider !== provider.service
      || branchPlan.model !== provider.model
      || branchPlan.transport !== provider.transport
      || branchPlan.sourceIdentityHash !== itemDialoguePlan.sourceIdentity.identityHash
      || branchPlan.dialoguePlanId !== itemDialoguePlan.dialoguePlanId
    ) {
      throw CLIUsageError('Stored TTS active branch does not bind its exact item source, dialogue, and operation-scoped target. Rebuild this output before resuming it.')
    }
    return {
      sourceIdentity: itemDialoguePlan.sourceIdentity,
      dialoguePlan: itemDialoguePlan,
      targetKey: provider.targetKey,
      planIdentity: { kind: 'branch', branchPlanId: branchPlan.branchPlanId }
    }
  }

  if (!render) return undefined
  await assertRealPathWithoutSymlinks(canonicalArtifactRoot, render.renderDir, 'directory', 'active render directory')

  const sourceIdentity = validateGenericTtsSourceIdentity(
    await readJsonRecord(
      canonicalArtifactRoot,
      `${render.renderDir}/${SOURCE_IDENTITY_FILE}`,
      'source identity'
    ) as unknown as GenericTtsSourceIdentity
  )
  const dialoguePlan = validateGenericTtsDialoguePlan(
    await readJsonRecord(
      canonicalArtifactRoot,
      `${render.renderDir}/${DIALOGUE_PLAN_FILE}`,
      'dialogue plan'
    ) as unknown as GenericTtsDialoguePlan
  )
  const renderPlan = validateProviderRenderPlanIdentity(
    await readJsonRecord(canonicalArtifactRoot, render.renderPlanRef, 'render plan', render.renderPlanSha256) as unknown as ProviderRenderPlan
  )

  const exactSourceHash = sourceIdentity.sourceLocator.kind === 'file'
    ? sha256Bytes(new Uint8Array(await Bun.file(resolveUserPath(sourceIdentity.sourceLocator.canonicalPath)).arrayBuffer()))
    : sha256Bytes(input)

  if (
    sourceIdentity.contentSha256 !== exactSourceHash
    || dialoguePlan.sourceIdentity.identityHash !== sourceIdentity.identityHash
    || renderPlan.sourceIdentityHash !== sourceIdentity.identityHash
    || renderPlan.dialoguePlanId !== dialoguePlan.dialoguePlanId
    || renderPlan.renderPlanId !== render.renderPlanId
    || renderPlan.renderIdentity !== render.renderIdentity
    || renderPlan.targetKey !== provider.targetKey
  ) {
    throw CLIUsageError('Stored TTS source/dialogue evidence does not match its active render or resume input. Rebuild this output before resuming it.')
  }

  return {
    sourceIdentity,
    dialoguePlan,
    targetKey: provider.targetKey,
    planIdentity: {
      kind: 'render',
      renderPlanId: renderPlan.renderPlanId,
      renderIdentity: renderPlan.renderIdentity
    }
  }
}

export const resolveTtsResumeSourceContext = async (
  rootDir: string,
  input: string,
  providers: PipelineProviderState[],
  targetKeys: ReadonlySet<string>
): Promise<ResolvedTtsResumeSourceContext> => {
  const dialoguePlanArtifacts = providers
    .filter((provider) =>
      provider.operation === 'tts-synthesis'
      && provider.legacyRenderIdentity === undefined
      && provider.status !== 'skipped'
    )
    .map(parseTtsDialoguePlanArtifactRef)
  const dialoguePlanArtifact = dialoguePlanArtifacts[0]
  if (!dialoguePlanArtifact) {
    throw CLIUsageError('TTS resume has no item-owned canonical dialogue-plan artifact. Rebuild this output with the current tts command.')
  }
  if (dialoguePlanArtifacts.some((candidate) => canonicalTtsJson(candidate) !== canonicalTtsJson(dialoguePlanArtifact))) {
    throw CLIUsageError('TTS resume found conflicting item-owned dialogue plans across selected targets. Rebuild this output before resuming it.')
  }
  const itemDialoguePlan = validateGenericTtsDialoguePlan(
    await readTtsDialoguePlanArtifact(rootDir, dialoguePlanArtifact)
  )
  const exactItemSourceHash = itemDialoguePlan.sourceIdentity.sourceLocator.kind === 'file'
    ? sha256Bytes(new Uint8Array(await Bun.file(resolveUserPath(itemDialoguePlan.sourceIdentity.sourceLocator.canonicalPath)).arrayBuffer()))
    : sha256Bytes(input)
  if (itemDialoguePlan.sourceIdentity.contentSha256 !== exactItemSourceHash) {
    throw CLIUsageError('TTS resume input bytes do not match the item-owned source identity. Restore the exact source or rebuild this output.')
  }
  const selectedProviders = providers.filter((provider) =>
    provider.targetKey !== undefined && targetKeys.has(provider.targetKey)
  )
  const candidates = selectedProviders.length > 0 ? selectedProviders : providers
  const contexts = (await Promise.all(candidates.map(async (provider) =>
    await readProviderSourceContext(rootDir, input, provider, itemDialoguePlan)
  ))).filter((context): context is ProviderTtsResumeSourceContext => context !== undefined)

  if (contexts.length === 0 && candidates !== providers) {
    contexts.push(...(await Promise.all(providers.map(async (provider) =>
      await readProviderSourceContext(rootDir, input, provider, itemDialoguePlan)
    ))).filter((context): context is ProviderTtsResumeSourceContext => context !== undefined))
  }
  const sourceContext = contexts[0]
  if (!sourceContext) {
    throw CLIUsageError('TTS resume has no retained active source/dialogue evidence and cannot authorize synthesis. Rebuild this output with the current tts command.')
  }
  if (contexts.some((context) =>
    canonicalTtsJson(context.sourceIdentity) !== canonicalTtsJson(sourceContext.sourceIdentity)
    || canonicalTtsJson(context.dialoguePlan) !== canonicalTtsJson(sourceContext.dialoguePlan)
  )) {
    throw CLIUsageError('TTS resume found conflicting active source/dialogue evidence across selected targets. Rebuild this output before resuming it.')
  }
  if (
    itemDialoguePlan.dialoguePlanId !== dialoguePlanArtifact.dialoguePlanId
    || canonicalTtsJson(itemDialoguePlan) !== canonicalTtsJson(sourceContext.dialoguePlan)
  ) {
    throw CLIUsageError('TTS resume item dialogue plan does not match its retained render evidence. Rebuild this output before resuming it.')
  }
  return {
    sourceIdentity: sourceContext.sourceIdentity,
    dialoguePlan: itemDialoguePlan,
    dialoguePlanArtifact,
    retainedPlanIdentities: new Map(contexts.map((context) => [
      context.targetKey,
      context.planIdentity
    ]))
  }
}
