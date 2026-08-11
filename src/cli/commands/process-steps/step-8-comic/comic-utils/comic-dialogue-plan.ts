import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  CanonicalDialoguePlanNode,
  CanonicalDialogueTurn,
  ComicAudioRolePolicy,
  ComicDialoguePlan,
  ComicSourceIdentity,
  StructuredScriptArtifactRef,
  StructuredScriptData,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { validateComicDialoguePlan } from './comic-audio-contracts'

const normalizeLabel = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase()

const rolePolicyMap = (policies: readonly ComicAudioRolePolicy[]): ReadonlyMap<string, string> => {
  const result = new Map<string, string>()
  for (const policy of policies) {
    const label = normalizeLabel(policy.speakerLabel)
    if (!label || !policy.subjectKey.trim()) throw CLIUsageError('Comic audio role policies require a speaker label and subject key.')
    if (result.has(label)) throw CLIUsageError(`Duplicate comic audio role policy for ${policy.speakerLabel}.`)
    result.set(label, policy.subjectKey.trim())
  }
  return result
}

const voiceEffectFor = (segment: StructuredScriptData['sourceSegments'][number]): CanonicalDialogueTurn['effect'] | undefined => {
  const effects = [
    ...[...segment.speakerLabel?.matchAll(/(?:\bV\.O\.|\bO\.S\.|\bOFFSCREEN\b|\bRADIO\b|\bINTERCOM\b|\bTELEPHONE\b|\bCOMPUTER\b)/giu) ?? []].map(match => match[0].toUpperCase()),
    ...(segment.sourceSpans ?? []).filter(span => span.kind === 'voice-effect').map(span => span.text.normalize('NFKC').trim().toUpperCase()),
  ].filter((value, index, all) => value && all.indexOf(value) === index)
  if (effects.length === 0) return undefined
  const kind = effects.join('+').replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return { kind, settingsHash: hashCanonicalTtsValue({ schemaVersion: 1, effects }) }
}

const deliveryFor = (segment: StructuredScriptData['sourceSegments'][number]): CanonicalDialogueTurn['delivery'] | undefined => {
  const descriptions = [
    ...(segment.delivery ? [segment.delivery] : []),
    ...(segment.sourceSpans ?? []).filter(span => span.kind === 'timing' || span.kind === 'stage-direction').map(span => span.text),
  ].map(value => value.trim()).filter(Boolean)
  return descriptions.length > 0 ? { kind: 'source', description: descriptions.join('; ') } : undefined
}

const turn = (input: {
  index: number
  childIndex?: number | undefined
  segment: StructuredScriptData['sourceSegments'][number]
  subjectKey: string
  originalSpeakerLabel: string
}): CanonicalDialogueTurn => ({
  turnId: `dialogue-turn-${String(input.index).padStart(3, '0')}${input.childIndex === undefined ? '' : `-${String(input.childIndex + 1).padStart(2, '0')}`}`,
  sourceSegmentId: input.segment.id,
  ...(input.segment.beatIndex !== undefined ? { beatIndex: input.segment.beatIndex } : {}),
  subjectKey: input.subjectKey,
  originalSpeakerLabel: input.originalSpeakerLabel,
  canonicalText: input.segment.text,
  sourceSpans: input.segment.sourceSpans,
  ...(deliveryFor(input.segment) ? { delivery: deliveryFor(input.segment) } : {}),
  ...(voiceEffectFor(input.segment) ? { effect: voiceEffectFor(input.segment) } : {}),
})

export const createComicDialoguePlan = (input: {
  structuredScript: StructuredScriptData
  sourceIdentity: ComicSourceIdentity
  structuredScriptRef: StructuredScriptArtifactRef
  sceneRunIdentity: string
  createdAt: string
  rolePolicies?: readonly ComicAudioRolePolicy[] | undefined
}): ComicDialoguePlan => {
  if (input.structuredScript.schemaVersion !== 4 || canonicalTtsJson(input.structuredScript.sourceIdentity) !== canonicalTtsJson(input.sourceIdentity)) {
    throw CLIUsageError('Comic dialogue planning requires strict structured-script v4 bound to the exact source identity.')
  }
  const policies = rolePolicyMap(input.rolePolicies ?? [])
  const speakable = input.structuredScript.sourceSegments.filter(segment => segment.type === 'dialogue' || segment.type === 'narration')
  const sourceIds = speakable.map(segment => segment.id)
  if (new Set(sourceIds).size !== sourceIds.length) throw CLIUsageError('Structured script contains duplicate speakable source segment IDs.')

  const nodes: CanonicalDialoguePlanNode[] = speakable.map((segment, index) => {
    const label = segment.speakerLabel?.trim() || (segment.type === 'narration' ? 'NARRATOR' : '')
    if (!label) throw CLIUsageError(`Speakable source segment ${segment.id} has no speaker label or explicit narration policy.`)
    const policySubject = policies.get(normalizeLabel(label))
    const speakerKeys = segment.speakerKeys ?? (segment.speakerKey ? [segment.speakerKey] : [])
    if (speakerKeys.length > 1 && !policySubject) {
      const turns = speakerKeys.map((subjectKey, childIndex) => turn({ index: index + 1, childIndex, segment, subjectKey, originalSpeakerLabel: label }))
      return { kind: 'overlap' as const, groupId: `overlap-${sha256Bytes(`${segment.id}\0${speakerKeys.join('\0')}`).slice(0, 24)}`, turns }
    }
    const subjectKey = policySubject
      ?? speakerKeys[0]
      ?? (segment.type === 'narration' ? 'role:narrator' : undefined)
    if (!subjectKey) {
      throw CLIUsageError(`Uncatalogued speaking role "${label}" in ${segment.id} requires --role "${label}=voice:<key>" or an authored role registration.`)
    }
    return { kind: 'turn' as const, turn: turn({ index: index + 1, segment, subjectKey, originalSpeakerLabel: label }) }
  })

  const base = {
    schemaVersion: 1 as const,
    sceneRunIdentity: input.sceneRunIdentity,
    sourceIdentity: input.sourceIdentity,
    structuredScript: input.structuredScriptRef,
    createdAt: input.createdAt,
    nodes,
  }
  return validateComicDialoguePlan({ ...base, dialoguePlanId: hashCanonicalTtsValue(base) })
}

export const writeComicDialoguePlan = async (
  sceneRunDir: string,
  plan: ComicDialoguePlan
): Promise<{ path: string, sha256: string }> => {
  validateComicDialoguePlan(plan)
  const relativePath = `metadata/dialogue-plans/${plan.dialoguePlanId}.json`
  const path = join(sceneRunDir, relativePath)
  const bytes = `${canonicalTtsJson(plan)}\n`
  await mkdir(dirname(path), { recursive: true })
  if (await Bun.file(path).exists()) {
    if (await readFile(path, 'utf8') !== bytes) throw CLIUsageError('Create-only comic dialogue plan conflicts with existing bytes.')
  } else {
    await Bun.write(path, bytes)
  }
  const indexPath = join(sceneRunDir, 'metadata/dialogue-plans.json')
  const existing = await Bun.file(indexPath).exists()
    ? await Bun.file(indexPath).json() as { schemaVersion?: unknown, entries?: unknown }
    : { schemaVersion: 1, entries: [] }
  if (existing.schemaVersion !== 1 || !Array.isArray(existing.entries)) throw CLIUsageError('Comic dialogue plan index is invalid.')
  const entries = existing.entries as Array<{ dialoguePlanId: string, path: string, sha256: string, createdAt: string }>
  const nextEntry = { dialoguePlanId: plan.dialoguePlanId, path: relativePath, sha256: sha256Bytes(bytes), createdAt: plan.createdAt }
  const prior = entries.find(entry => entry.dialoguePlanId === plan.dialoguePlanId)
  if (prior && canonicalTtsJson(prior) !== canonicalTtsJson(nextEntry)) throw CLIUsageError('Comic dialogue plan index contains conflicting append-only identity.')
  if (!prior) {
    const temporary = `${indexPath}.tmp-${randomUUID()}`
    await mkdir(dirname(indexPath), { recursive: true })
    try {
      await Bun.write(temporary, `${JSON.stringify({ schemaVersion: 1, entries: [...entries, nextEntry] }, null, 2)}\n`)
      await rename(temporary, indexPath)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }
  return { path: relativePath, sha256: nextEntry.sha256 }
}
