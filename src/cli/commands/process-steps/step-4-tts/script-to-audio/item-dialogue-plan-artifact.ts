import { lstat, readFile, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { GenericTtsDialoguePlan, PipelineProviderState, TtsDialoguePlanArtifactRef } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalTtsJson, sha256Bytes } from './contract-identity'
import { validateGenericTtsDialoguePlan } from './contract-validation'
import { writeImmutableArtifactFile } from './safe-artifact-store'
import { isContainedPath } from '~/utils/filesystem'

const DIALOGUE_PLAN_ID = /^[a-f0-9]{64}$/
const DIALOGUE_PLAN_DIRECTORY = 'metadata/tts-dialogue-plans'

const artifactPathFor = (dialoguePlanId: string): string =>
  `${DIALOGUE_PLAN_DIRECTORY}/${dialoguePlanId}.json`

export const buildTtsDialoguePlanArtifactRef = (
  dialoguePlan: GenericTtsDialoguePlan
): TtsDialoguePlanArtifactRef => {
  const validatedPlan = validateGenericTtsDialoguePlan(dialoguePlan)
  if (!DIALOGUE_PLAN_ID.test(validatedPlan.dialoguePlanId)) {
    throw UsageError('Canonical TTS dialogue plan has an invalid content identity.')
  }
  const bytes = Buffer.from(`${canonicalTtsJson(validatedPlan)}\n`)
  return {
    dialoguePlanId: validatedPlan.dialoguePlanId,
    path: artifactPathFor(validatedPlan.dialoguePlanId),
    sha256: sha256Bytes(bytes)
  }
}

export const materializeTtsDialoguePlanArtifact = async (
  rootDir: string,
  dialoguePlan: GenericTtsDialoguePlan
): Promise<TtsDialoguePlanArtifactRef> => {
  const validatedPlan = validateGenericTtsDialoguePlan(dialoguePlan)
  const reference = buildTtsDialoguePlanArtifactRef(validatedPlan)
  const bytes = Buffer.from(`${canonicalTtsJson(validatedPlan)}\n`)
  const written = await writeImmutableArtifactFile(rootDir, reference.path, bytes)

  return {
    dialoguePlanId: reference.dialoguePlanId,
    path: written.relativePath,
    sha256: written.sha256
  }
}

export const parseTtsDialoguePlanArtifactRef = (
  state: Pick<PipelineProviderState, 'service' | 'model' | 'options'>
): TtsDialoguePlanArtifactRef => {
  const value = state.options['dialoguePlan']
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
  if (
    !record
    || Object.keys(record).some((key) => !['dialoguePlanId', 'path', 'sha256'].includes(key))
    || typeof record['dialoguePlanId'] !== 'string'
    || typeof record['path'] !== 'string'
    || typeof record['sha256'] !== 'string'
    || !DIALOGUE_PLAN_ID.test(record['dialoguePlanId'])
    || record['path'] !== artifactPathFor(record['dialoguePlanId'])
    || !DIALOGUE_PLAN_ID.test(record['sha256'])
  ) {
    throw UsageError(`Canonical TTS provider ${state.service}/${state.model ?? ''} is missing its item-owned dialogue-plan artifact reference.`)
  }
  return {
    dialoguePlanId: record['dialoguePlanId'],
    path: record['path'],
    sha256: record['sha256']
  }
}

export const readTtsDialoguePlanArtifact = async (
  rootDir: string,
  reference: TtsDialoguePlanArtifactRef
): Promise<GenericTtsDialoguePlan> => {
  const expectedPath = artifactPathFor(reference.dialoguePlanId)
  if (
    !DIALOGUE_PLAN_ID.test(reference.dialoguePlanId)
    || reference.path !== expectedPath
    || !DIALOGUE_PLAN_ID.test(reference.sha256)
  ) {
    throw UsageError('Canonical TTS dialogue-plan artifact reference is malformed.')
  }
  const canonicalRoot = await realpath(rootDir)
  const candidate = resolve(canonicalRoot, reference.path)
  if (!isContainedPath(canonicalRoot, candidate)) {
    throw UsageError('Canonical TTS dialogue-plan artifact escaped its run root.')
  }
  let cursor = canonicalRoot
  for (const segment of reference.path.split('/')) {
    cursor = join(cursor, segment)
    const entry = await lstat(cursor)
    if (entry.isSymbolicLink()) {
      throw UsageError('Canonical TTS dialogue-plan artifact cannot traverse a symbolic link.')
    }
  }
  const entry = await lstat(candidate)
  if (!entry.isFile()) throw UsageError('Canonical TTS dialogue-plan artifact is not a regular file.')
  const bytes = await readFile(candidate)
  if (sha256Bytes(bytes) !== reference.sha256) {
    throw UsageError('Canonical TTS dialogue-plan artifact checksum does not match its provider options.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw UsageError('Canonical TTS dialogue-plan artifact is not valid JSON.')
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || (parsed as { dialoguePlanId?: unknown }).dialoguePlanId !== reference.dialoguePlanId
    || !bytes.equals(Buffer.from(`${canonicalTtsJson(parsed)}\n`))
  ) {
    throw UsageError('Canonical TTS dialogue-plan artifact bytes or identity are not canonical.')
  }
  return parsed as GenericTtsDialoguePlan
}

export const bindTtsDialoguePlanArtifact = (
  state: PipelineProviderState,
  dialoguePlan: TtsDialoguePlanArtifactRef
): PipelineProviderState => {
  const existing = state.options['dialoguePlan']
  if (existing !== undefined && canonicalTtsJson(existing) !== canonicalTtsJson(dialoguePlan)) {
    throw UsageError(`TTS provider ${state.service}/${state.model ?? ''} cannot change its canonical item dialogue plan.`)
  }
  return {
    ...state,
    options: { ...state.options, dialoguePlan: { ...dialoguePlan } }
  }
}
