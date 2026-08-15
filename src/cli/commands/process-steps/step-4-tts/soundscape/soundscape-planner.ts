import type { ComicDialoguePlan, SoundEffectSynthesisTask, SoundscapeMixProfile, SoundscapePlan, SoundscapeTimingPolicy, StructuredScriptArtifactRef, StructuredScriptData } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../script-to-audio/contract-identity'
import { writeImmutableArtifactFile } from '../script-to-audio/safe-artifact-store'

export const DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE: SoundscapeMixProfile = {
  schemaVersion: 1,
  profileKey: 'comic-soundscape-v1',
  busGainDb: { dialogue: 0, 'vocal-reaction': -1, 'action-sfx': -3, ambience: -14 },
  loudness: { mode: 'ebu-r128', integratedLufs: -16 },
  ambienceDucking: {
    sidechainBuses: ['dialogue', 'vocal-reaction'],
    depthDb: 9,
    detectorWindowMs: 50,
    thresholdDb: -32,
    attackMs: 30,
    releaseMs: 350,
    ratio: 7,
  },
  bedLoopCrossfadeMs: 120,
  panLaw: 'constant-power',
  defaultPan: 0,
  fadeInMs: 8,
  fadeOutMs: 20,
  limiter: { ceiling: 0.95, truePeakDb: -1 },
  sampleRate: 48000,
  channels: 2,
  codec: 'pcm_s24le',
  container: 'wav',
}

const finite = (value: number | undefined, label: string): void => {
  if (value !== undefined && !Number.isFinite(value)) throw CLIUsageError(`${label} must be finite.`)
}

export const validateSoundscapeMixProfile = (profile: SoundscapeMixProfile): SoundscapeMixProfile => {
  if (profile.schemaVersion !== 1 || !profile.profileKey.trim()) throw CLIUsageError('Soundscape mix profile requires schemaVersion 1 and a stable profile key.')
  const buses = ['dialogue', 'vocal-reaction', 'action-sfx', 'ambience']
  if (Object.keys(profile.busGainDb).sort().join('\0') !== buses.slice().sort().join('\0')) throw CLIUsageError('Soundscape mix profile requires exactly the four semantic bus gains.')
  Object.entries(profile.busGainDb).forEach(([bus, gain]) => finite(gain, `Soundscape ${bus} bus gain`))
  if (profile.panLaw !== 'constant-power' || profile.defaultPan < -1 || profile.defaultPan > 1) throw CLIUsageError('Soundscape Phase 1 requires constant-power pan in the -1..1 range.')
  finite(profile.defaultPan, 'Soundscape default pan')
  finite(profile.loudness.integratedLufs, 'Soundscape integrated loudness')
  if (profile.loudness.mode === 'ebu-r128' && profile.loudness.integratedLufs === undefined) throw CLIUsageError('EBU R128 soundscape mastering requires an integrated LUFS target.')
  const duck = profile.ambienceDucking
  for (const [name, value] of Object.entries(duck).filter((entry): entry is [string, number] => typeof entry[1] === 'number')) finite(value, `Soundscape ambience ducking ${name}`)
  if (duck.sidechainBuses[0] !== 'dialogue' || duck.sidechainBuses[1] !== 'vocal-reaction' || duck.depthDb < 0 || duck.detectorWindowMs <= 0 || duck.attackMs < 0 || duck.releaseMs < 0 || duck.ratio < 1) throw CLIUsageError('Soundscape ambience ducking controls are invalid.')
  if (![profile.bedLoopCrossfadeMs, profile.fadeInMs, profile.fadeOutMs].every(value => Number.isSafeInteger(value) && value >= 0)) throw CLIUsageError('Soundscape loop crossfade and fade durations must be non-negative integer milliseconds.')
  if (!Number.isSafeInteger(profile.sampleRate) || profile.sampleRate <= 0 || ![1, 2].includes(profile.channels) || !['pcm_s16le', 'pcm_s24le'].includes(profile.codec) || profile.container !== 'wav') throw CLIUsageError('Soundscape master output profile must be PCM WAV with a positive sample rate and one or two channels.')
  finite(profile.limiter.ceiling, 'Soundscape limiter ceiling')
  finite(profile.limiter.truePeakDb, 'Soundscape limiter true-peak target')
  if (profile.limiter.ceiling <= 0 || profile.limiter.ceiling > 1 || profile.limiter.truePeakDb > 0) throw CLIUsageError('Soundscape limiter ceiling must be in the 0..1 range and its true-peak target must not exceed 0 dBTP.')
  return profile
}

const validateAnchor = (anchor: SoundscapePlan['cues'][number]['anchor'], structuredScript: StructuredScriptData, label: string): void => {
  if (anchor.kind === 'scene-clock') {
    if (!Number.isSafeInteger(anchor.positionMs) || anchor.positionMs < 0) throw CLIUsageError(`${label} scene-clock position must be a non-negative integer number of milliseconds.`)
    return
  }
  if (anchor.kind === 'resolved-scene-edge') {
    if (anchor.edge !== 'start' && anchor.edge !== 'end') throw CLIUsageError(`${label} resolved scene edge must be start or end.`)
    return
  }
  const segment = structuredScript.sourceSegments.find(candidate => candidate.id === anchor.sourceSegmentId)
  if (!segment || (segment.type !== 'dialogue' && segment.type !== 'narration')) throw CLIUsageError(`${label} references unknown or non-speakable source segment ${anchor.sourceSegmentId}.`)
  if (!Number.isSafeInteger(anchor.offsetMs)) throw CLIUsageError(`${label} source offset must be an integer number of milliseconds.`)
  if (anchor.kind === 'source-text-offset' && (!Number.isSafeInteger(anchor.textOffset) || anchor.textOffset < 0 || anchor.textOffset > [...segment.text].length || anchor.indexUnit !== 'unicode-scalar-value')) throw CLIUsageError(`${label} text offset is outside its canonical Unicode source segment.`)
}

export const validateSoundscapePlan = (plan: SoundscapePlan, structuredScript?: StructuredScriptData): SoundscapePlan => {
  if (plan.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(plan.sceneRunIdentity) || !/^[a-f0-9]{64}$/u.test(plan.structuredScriptHash) || !/^[a-f0-9]{64}$/u.test(plan.dialoguePlanId)) throw CLIUsageError('Soundscape plan requires strict scene, structured-script, and dialogue identities.')
  validateSoundscapeMixProfile(plan.mixProfile)
  if (plan.timingPolicy !== 'strict' && plan.timingPolicy !== 'proportional') throw CLIUsageError('Soundscape timing policy must be strict or proportional.')
  if (hashCanonicalTtsValue(plan.mixProfile) !== plan.mixProfileHash) throw CLIUsageError('Soundscape plan mix profile hash is invalid.')
  const all = [...plan.cues, ...plan.ambientBeds]
  if (new Set(all.map(cue => cue.cueId)).size !== all.length) throw CLIUsageError('Soundscape plan contains duplicate cue IDs.')
  if (new Set(plan.synthesisTasks.map(task => task.taskId)).size !== plan.synthesisTasks.length) throw CLIUsageError('Soundscape plan contains duplicate synthesis task IDs.')
  for (const cue of all) {
    if (!cue.prompt.trim() || cue.prompt !== cue.prompt.normalize('NFKC').replace(/\s+/gu, ' ').trim()) throw CLIUsageError(`Sound cue ${cue.cueId} prompt is empty or not canonically normalized.`)
    if (!Number.isSafeInteger(cue.sourceSpan.start) || !Number.isSafeInteger(cue.sourceSpan.end) || cue.sourceSpan.start < 0 || cue.sourceSpan.end <= cue.sourceSpan.start || cue.sourceSpan.kind !== 'sound-effect' || cue.sourceSpan.indexUnit !== 'unicode-scalar-value') throw CLIUsageError(`Sound cue ${cue.cueId} has an invalid exact source span.`)
    finite(cue.durationSeconds, `Sound cue ${cue.cueId} duration`)
    if (cue.durationSeconds !== undefined && (cue.durationSeconds < 0.5 || cue.durationSeconds > 30)) throw CLIUsageError(`Sound cue ${cue.cueId} duration must be between 0.5 and 30 seconds.`)
    finite(cue.gainDb, `Sound cue ${cue.cueId} gain`)
    finite(cue.pan, `Sound cue ${cue.cueId} pan`)
    if (cue.pan !== undefined && (cue.pan < -1 || cue.pan > 1)) throw CLIUsageError(`Sound cue ${cue.cueId} pan must be between -1 and 1.`)
    if (structuredScript) {
      if (cue.kind === 'ambience') {
        if (cue.range.kind === 'anchors') {
          validateAnchor(cue.range.start, structuredScript, `Ambient cue ${cue.cueId} start`)
          validateAnchor(cue.range.end, structuredScript, `Ambient cue ${cue.cueId} end`)
        }
      } else validateAnchor(cue.anchor, structuredScript, `Sound cue ${cue.cueId}`)
    }
  }
  for (const task of plan.synthesisTasks) {
    const cue = all.find(candidate => candidate.cueId === task.cueId)
    if (!cue || task.prompt !== cue.prompt || task.kind !== cue.kind || task.required !== cue.required || task.loop !== (cue.kind === 'ambience')) throw CLIUsageError(`Sound synthesis task ${task.taskId} does not bind its authored cue.`)
    const generationBase = { schemaVersion: 1, operation: 'sound-effect-generation', kind: task.kind, prompt: task.prompt, durationSeconds: task.durationSeconds ?? null, loop: task.loop }
    if (task.generationIdentity !== hashCanonicalTtsValue(generationBase) || task.taskId !== hashCanonicalTtsValue({ cueId: task.cueId, generationIdentity: task.generationIdentity })) throw CLIUsageError(`Sound synthesis task ${task.taskId} has invalid content identity.`)
  }
  const { soundscapePlanId: _id, ...withoutId } = plan
  if (plan.soundscapePlanId !== hashCanonicalTtsValue(withoutId)) throw CLIUsageError('Soundscape plan content identity is invalid.')
  return plan
}

export const createSoundscapePlan = (input: {
  structuredScript: StructuredScriptData
  structuredScriptRef: StructuredScriptArtifactRef
  dialoguePlan: ComicDialoguePlan
  sceneRunIdentity: string
  createdAt: string
  mixProfile?: SoundscapeMixProfile | undefined
  timingPolicy?: SoundscapeTimingPolicy | undefined
}): SoundscapePlan => {
  if (input.structuredScript.schemaVersion !== 5 || input.structuredScriptRef.artifactSchemaVersion !== 5) throw CLIUsageError('Soundscape planning requires clean-break structured-script v5 input.')
  if (input.dialoguePlan.sceneRunIdentity !== input.sceneRunIdentity || input.dialoguePlan.structuredScript.sha256 !== input.structuredScriptRef.sha256) throw CLIUsageError('Soundscape and dialogue plans must bind the same exact scene-run input.')
  const mixProfile = validateSoundscapeMixProfile(input.mixProfile ?? DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE)
  const timingPolicy = input.timingPolicy ?? 'strict'
  const authored = input.structuredScript.scene.soundscape
  const synthesisTasks: SoundEffectSynthesisTask[] = [...authored.cues, ...authored.ambientBeds].map((cue) => {
    const generationBase = { schemaVersion: 1, operation: 'sound-effect-generation', kind: cue.kind, prompt: cue.prompt, durationSeconds: cue.durationSeconds ?? null, loop: cue.kind === 'ambience' }
    const generationIdentity = hashCanonicalTtsValue(generationBase)
    return {
      taskId: hashCanonicalTtsValue({ cueId: cue.cueId, generationIdentity }),
      generationIdentity,
      cueId: cue.cueId,
      kind: cue.kind,
      prompt: cue.prompt,
      required: cue.required,
      ...(cue.durationSeconds !== undefined ? { durationSeconds: cue.durationSeconds } : {}),
      loop: cue.kind === 'ambience',
    }
  })
  const mixProfileHash = hashCanonicalTtsValue(mixProfile)
  const mixIdentity = hashCanonicalTtsValue({
    schemaVersion: 1,
    dialoguePlanId: input.dialoguePlan.dialoguePlanId,
    placements: authored.cues.map(cue => ({ cueId: cue.cueId, anchor: cue.anchor, gainDb: cue.gainDb ?? null, pan: cue.pan ?? null })),
    ambientRanges: authored.ambientBeds.map(cue => ({ cueId: cue.cueId, range: cue.range, gainDb: cue.gainDb ?? null, pan: cue.pan ?? null })),
    timingPolicy,
    mixProfileHash,
  })
  const base = {
    schemaVersion: 1 as const,
    sceneRunIdentity: input.sceneRunIdentity,
    sourceIdentity: input.structuredScript.sourceIdentity,
    structuredScript: input.structuredScriptRef,
    structuredScriptHash: input.structuredScriptRef.sha256,
    dialoguePlanId: input.dialoguePlan.dialoguePlanId,
    timingPolicy,
    cues: authored.cues,
    ambientBeds: authored.ambientBeds,
    synthesisTasks,
    mixProfile,
    mixProfileHash,
    mixIdentity,
    createdAt: input.createdAt,
  }
  return validateSoundscapePlan({ ...base, soundscapePlanId: hashCanonicalTtsValue(base) }, input.structuredScript)
}

export const writeSoundscapePlan = async (sceneRunDir: string, plan: SoundscapePlan): Promise<{ path: string, sha256: string }> => {
  validateSoundscapePlan(plan)
  const path = `metadata/soundscape-plans/${plan.soundscapePlanId}/soundscape-plan.json`
  const bytes = `${canonicalTtsJson(plan)}\n`
  const written = await writeImmutableArtifactFile(sceneRunDir, path, bytes)
  return { path: written.relativePath, sha256: sha256Bytes(bytes) }
}
