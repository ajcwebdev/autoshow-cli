import { mkdir, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import type { ObservedAudioFormat, ResolvedSoundscapeTimeline, SoundEffectRenderPlan, SoundEffectRenderResult, SoundscapeAudioRun, SoundscapeBus, SoundscapePlan, SoundscapeStemRef, SoundscapeTransform } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../script-to-audio/contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from '../script-to-audio/safe-artifact-store'
import { inspectSoundscapeAudio } from './soundscape-audio'

type SourcePlacement = {
  cueId: string
  inputPath: string
  sourceDurationMs: number
  startMs: number
  endMs: number
  gainDb: number
  pan: number
  loopIterations: number
}

const runFfmpeg = async (args: string[], label: string, cancellation?: AbortSignal): Promise<void> => {
  cancellation?.throwIfAborted()
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1', ...args], { signal: cancellation })
  if (result.exitCode !== 0) throw InfraError(`Failed to render ${label}: ${result.stderr.trim()}`, { stage: 'tts:soundscape-mixer' })
}

const checkedSource = async (rootDir: string, path: string, sha256: string): Promise<string> => {
  const source = await readContainedArtifactFile(rootDir, path)
  if (source.sha256 !== sha256) throw CLIUsageError(`Soundscape source checksum mismatch: ${path}`)
  return source.path
}

const gain = (profileGain: number, authoredGain: number): string => (profileGain + authoredGain).toFixed(4)

const deterministicOutputFormat = (plan: SoundscapePlan): string => `aresample=${plan.mixProfile.sampleRate}:osf=${plan.mixProfile.codec === 'pcm_s16le' ? 's16' : 's32'}:dither_method=none`

const panFilter = (pan: number, channels: 1 | 2): string => {
  if (channels === 1) return 'aformat=channel_layouts=mono'
  const angle = (pan + 1) * Math.PI / 4
  const left = Math.cos(angle).toFixed(9)
  const right = Math.sin(angle).toFixed(9)
  return `aformat=channel_layouts=mono,pan=stereo|c0=${left}*c0|c1=${right}*c0`
}

const finishImmutableAudio = async (rootDir: string, temporaryPath: string, relativePath: string): Promise<SoundscapeStemRef['path'] extends string ? { path: string, sha256: string, format: ObservedAudioFormat, durationMs: number } : never> => {
  const observed = await inspectSoundscapeAudio(temporaryPath)
  const bytes = new Uint8Array(await Bun.file(temporaryPath).arrayBuffer())
  const written = await writeImmutableArtifactFile(rootDir, relativePath, bytes)
  return { path: written.relativePath, sha256: written.sha256, format: observed.format, durationMs: observed.durationMs }
}

const renderDialogueStem = async (input: {
  sourcePath: string
  outputPath: string
  durationMs: number
  preRollMs: number
  plan: SoundscapePlan
  cancellation?: AbortSignal | undefined
}): Promise<void> => {
  const profile = input.plan.mixProfile
  const delay = profile.channels === 2 ? `${input.preRollMs}|${input.preRollMs}` : String(input.preRollMs)
  const filter = [
    `aresample=${profile.sampleRate}`,
    `aformat=sample_fmts=fltp:channel_layouts=${profile.channels === 2 ? 'stereo' : 'mono'}`,
    `volume=${profile.busGainDb.dialogue.toFixed(4)}dB`,
    ...(input.preRollMs > 0 ? [`adelay=${delay}`] : []),
    'apad',
    `atrim=0:${(input.durationMs / 1000).toFixed(6)}`,
    deterministicOutputFormat(input.plan),
  ].join(',')
  await runFfmpeg(['-i', input.sourcePath, '-af', filter, '-ar', String(profile.sampleRate), '-ac', String(profile.channels), '-c:a', profile.codec, '-bitexact', '-y', input.outputPath], 'dialogue stem', input.cancellation)
}

const renderPlacementBus = async (input: {
  bus: Exclude<SoundscapeBus, 'dialogue'>
  placements: SourcePlacement[]
  outputPath: string
  durationMs: number
  plan: SoundscapePlan
  cancellation?: AbortSignal | undefined
}): Promise<void> => {
  const profile = input.plan.mixProfile
  const inputs = input.placements.flatMap(placement => ['-i', placement.inputPath])
  const filters: string[] = []
  const labels: string[] = []
  input.placements.forEach((placement, inputIndex) => {
    const rangeMs = placement.endMs - placement.startMs
    const baseFadeIn = Math.min(profile.fadeInMs, Math.floor(rangeMs / 2))
    const baseFadeOut = Math.min(profile.fadeOutMs, Math.floor(rangeMs / 2))
    if (input.bus !== 'ambience') {
      const delay = profile.channels === 2 ? `${placement.startMs}|${placement.startMs}` : String(placement.startMs)
      const label = `p${inputIndex}`
      filters.push([
        `[${inputIndex}:a]aresample=${profile.sampleRate}`,
        'aformat=sample_fmts=fltp:channel_layouts=mono',
        `atrim=0:${(rangeMs / 1000).toFixed(6)}`,
        'asetpts=PTS-STARTPTS',
        ...(baseFadeIn > 0 ? [`afade=t=in:st=0:d=${(baseFadeIn / 1000).toFixed(6)}`] : []),
        ...(baseFadeOut > 0 ? [`afade=t=out:st=${((rangeMs - baseFadeOut) / 1000).toFixed(6)}:d=${(baseFadeOut / 1000).toFixed(6)}`] : []),
        `volume=${gain(profile.busGainDb[input.bus], placement.gainDb)}dB`,
        panFilter(placement.pan, profile.channels),
        ...(placement.startMs > 0 ? [`adelay=${delay}`] : []),
        'apad',
        `atrim=0:${(input.durationMs / 1000).toFixed(6)}[${label}]`,
      ].join(','))
      labels.push(`[${label}]`)
      return
    }
    const crossfadeMs = Math.min(profile.bedLoopCrossfadeMs, Math.max(0, placement.sourceDurationMs - 1))
    const stepMs = Math.max(1, placement.sourceDurationMs - crossfadeMs)
    for (let iteration = 0; iteration < placement.loopIterations; iteration++) {
      const chunkStart = placement.startMs + iteration * stepMs
      if (chunkStart >= placement.endMs) break
      const chunkDuration = Math.min(placement.sourceDurationMs, placement.endMs - chunkStart)
      const fadeInMs = iteration === 0 ? baseFadeIn : Math.min(crossfadeMs, Math.floor(chunkDuration / 2))
      const isLast = chunkStart + chunkDuration >= placement.endMs
      const fadeOutMs = isLast ? baseFadeOut : Math.min(crossfadeMs, Math.floor(chunkDuration / 2))
      const delay = profile.channels === 2 ? `${chunkStart}|${chunkStart}` : String(chunkStart)
      const label = `p${inputIndex}_${iteration}`
      filters.push([
        `[${inputIndex}:a]aresample=${profile.sampleRate}`,
        'aformat=sample_fmts=fltp:channel_layouts=mono',
        `atrim=0:${(chunkDuration / 1000).toFixed(6)}`,
        'asetpts=PTS-STARTPTS',
        ...(fadeInMs > 0 ? [`afade=t=in:st=0:d=${(fadeInMs / 1000).toFixed(6)}`] : []),
        ...(fadeOutMs > 0 ? [`afade=t=out:st=${((chunkDuration - fadeOutMs) / 1000).toFixed(6)}:d=${(fadeOutMs / 1000).toFixed(6)}`] : []),
        `volume=${gain(profile.busGainDb.ambience, placement.gainDb)}dB`,
        panFilter(placement.pan, profile.channels),
        ...(chunkStart > 0 ? [`adelay=${delay}`] : []),
        'apad',
        `atrim=0:${(input.durationMs / 1000).toFixed(6)}[${label}]`,
      ].join(','))
      labels.push(`[${label}]`)
    }
  })
  if (labels.length === 0) throw CLIUsageError(`Cannot render an empty ${input.bus} soundscape bus.`)
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,atrim=0:${(input.durationMs / 1000).toFixed(6)},${deterministicOutputFormat(input.plan)}[bus]`)
  await runFfmpeg([...inputs, '-filter_complex', filters.join(';'), '-map', '[bus]', '-ar', String(profile.sampleRate), '-ac', String(profile.channels), '-c:a', profile.codec, '-bitexact', '-y', input.outputPath], `${input.bus} stem`, input.cancellation)
}

const duckAmbience = async (input: { ambience: string, drivers: string[], output: string, plan: SoundscapePlan, cancellation?: AbortSignal | undefined }): Promise<void> => {
  if (input.drivers.length === 0) return
  const profile = input.plan.mixProfile
  const duck = profile.ambienceDucking
  const driverLabels = input.drivers.map((_, index) => `[${index + 1}:a]`).join('')
  const detectorSamples = Math.max(1, Math.round(profile.sampleRate * duck.detectorWindowMs / 1000))
  const driver = input.drivers.length === 1 ? `[1:a]asetnsamples=n=${detectorSamples}:p=1[driver]` : `${driverLabels}amix=inputs=${input.drivers.length}:duration=longest:normalize=0,asetnsamples=n=${detectorSamples}:p=1[driver]`
  const threshold = 10 ** (duck.thresholdDb / 20)
  const ratio = Math.max(1, duck.ratio)
  const filters = `${driver};[0:a][driver]sidechaincompress=threshold=${threshold.toFixed(8)}:ratio=${ratio.toFixed(4)}:attack=${duck.attackMs}:release=${duck.releaseMs}:makeup=1,${deterministicOutputFormat(input.plan)}[ducked]`
  await runFfmpeg(['-i', input.ambience, ...input.drivers.flatMap(path => ['-i', path]), '-filter_complex', filters, '-map', '[ducked]', '-ar', String(profile.sampleRate), '-ac', String(profile.channels), '-c:a', profile.codec, '-bitexact', '-y', input.output], 'ducked ambience stem', input.cancellation)
}

const masterStems = async (input: { stems: string[], output: string, plan: SoundscapePlan, durationMs: number, cancellation?: AbortSignal | undefined }): Promise<void> => {
  const profile = input.plan.mixProfile
  const labels = input.stems.map((_, index) => `[${index}:a]`).join('')
  const loudness = profile.loudness.mode === 'ebu-r128' ? `,loudnorm=I=${profile.loudness.integratedLufs ?? -16}:TP=${profile.limiter.truePeakDb}:LRA=11` : ''
  const filter = `${labels}amix=inputs=${input.stems.length}:duration=longest:normalize=0${loudness},alimiter=limit=${profile.limiter.ceiling.toFixed(6)},atrim=0:${(input.durationMs / 1000).toFixed(6)},${deterministicOutputFormat(input.plan)}[master]`
  await runFfmpeg([...input.stems.flatMap(path => ['-i', path]), '-filter_complex', filter, '-map', '[master]', '-ar', String(profile.sampleRate), '-ac', String(profile.channels), '-c:a', profile.codec, '-bitexact', '-y', input.output], 'soundscape master', input.cancellation)
}

const loadExistingSoundscapeRun = async (input: {
  rootDir: string
  path: string
  plan: SoundscapePlan
  dialogueAudioRunId: string
  renderResultId?: string | undefined
}): Promise<{ audioRun: SoundscapeAudioRun, ref: { path: string, sha256: string } } | undefined> => {
  let stored: Awaited<ReturnType<typeof readContainedArtifactFile>>
  try { stored = await readContainedArtifactFile(input.rootDir, input.path) }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return undefined
    if (error instanceof Error && /does not exist|no such file/iu.test(error.message)) return undefined
    throw error
  }
  let audioRun: SoundscapeAudioRun
  try { audioRun = JSON.parse(stored.bytes.toString('utf8')) as SoundscapeAudioRun }
  catch { throw CLIUsageError('Retained soundscape AudioRun is not valid JSON.') }
  const { audioRunId: _id, ...base } = audioRun
  if (audioRun.schemaVersion !== 1 || audioRun.audioRunId !== hashCanonicalTtsValue(base) || audioRun.dialogueAudioRun.audioRunId !== input.dialogueAudioRunId || audioRun.soundscapePlan.soundscapePlanId !== input.plan.soundscapePlanId || audioRun.mixIdentity !== input.plan.mixIdentity || audioRun.mixProfileHash !== input.plan.mixProfileHash || audioRun.soundEffectRenderResult?.resultId !== input.renderResultId) throw CLIUsageError('Retained soundscape AudioRun identity is incompatible with the selected inputs.')
  const refs = [audioRun.resolvedTimeline, audioRun.transformLedger, ...audioRun.stems, audioRun.master]
  for (const ref of refs) {
    const artifact = await readContainedArtifactFile(input.rootDir, ref.path)
    if (artifact.sha256 !== ref.sha256) throw CLIUsageError(`Retained soundscape artifact checksum is invalid: ${ref.path}`)
  }
  return { audioRun, ref: { path: stored.relativePath, sha256: stored.sha256 } }
}

export const mixSoundscape = async (input: {
  rootDir: string
  plan: SoundscapePlan
  planRef: { path: string, sha256: string }
  timeline: ResolvedSoundscapeTimeline
  dialogueAudioRun: { audioRunId: string, path: string, sha256: string, finalAudio: { path: string, sha256: string } }
  renderPlan?: { value: SoundEffectRenderPlan, ref: { path: string, sha256: string } } | undefined
  renderResult?: { value: SoundEffectRenderResult, ref: { path: string, sha256: string } } | undefined
  cancellation?: AbortSignal | undefined
}): Promise<{ audioRun: SoundscapeAudioRun, ref: { path: string, sha256: string } }> => {
  if (input.timeline.soundscapePlanId !== input.plan.soundscapePlanId || input.timeline.dialogueAudioRunId !== input.dialogueAudioRun.audioRunId) throw CLIUsageError('Resolved soundscape timeline does not bind the selected plan and dialogue audio run.')
  if (input.timeline.durationMs <= 0 || !Number.isSafeInteger(input.timeline.durationMs)) throw CLIUsageError('Resolved soundscape timeline requires a positive integer duration.')
  const materializationIdentity = hashCanonicalTtsValue({
    mixIdentity: input.plan.mixIdentity,
    dialogueAudioRunId: input.dialogueAudioRun.audioRunId,
    soundEffectRenderResultId: input.renderResult?.value.resultId ?? null,
  })
  const outputRoot = `audio/soundscape/${materializationIdentity}`
  const existing = await loadExistingSoundscapeRun({ rootDir: input.rootDir, path: `${outputRoot}/audio-run.json`, plan: input.plan, dialogueAudioRunId: input.dialogueAudioRun.audioRunId, ...(input.renderResult ? { renderResultId: input.renderResult.value.resultId } : {}) })
  if (existing) return existing
  const work = join(input.rootDir, 'audio', 'soundscape', `.work-${randomUUID()}`)
  await mkdir(work, { recursive: true })
  const transforms: SoundscapeTransform[] = []
  const stems: SoundscapeStemRef[] = []
  try {
    const dialogueSource = await checkedSource(input.rootDir, input.dialogueAudioRun.finalAudio.path, input.dialogueAudioRun.finalAudio.sha256)
    const dialogueTemp = join(work, 'dialogue.wav')
    await renderDialogueStem({ sourcePath: dialogueSource, outputPath: dialogueTemp, durationMs: input.timeline.durationMs, preRollMs: input.timeline.preRollMs, plan: input.plan, cancellation: input.cancellation })
    const dialogue = await finishImmutableAudio(input.rootDir, dialogueTemp, `${outputRoot}/stems/dialogue.wav`)
    stems.push({ bus: 'dialogue', ...dialogue })
    transforms.push({ transformId: hashCanonicalTtsValue({ kind: 'normalize', bus: 'dialogue', preRollMs: input.timeline.preRollMs, profile: input.plan.mixProfileHash }), kind: 'normalize', bus: 'dialogue', parametersHash: hashCanonicalTtsValue({ preRollMs: input.timeline.preRollMs, profile: input.plan.mixProfileHash }), finalRangeMs: { start: 0, end: input.timeline.durationMs } })

    const resultByCue = new Map(input.renderResult?.value.entries.map(entry => [entry.cueId, entry] as const) ?? [])
    const cueById = new Map([...input.plan.cues, ...input.plan.ambientBeds].map(cue => [cue.cueId, cue] as const))
    const placementsByBus = new Map<Exclude<SoundscapeBus, 'dialogue'>, SourcePlacement[]>([['vocal-reaction', []], ['action-sfx', []], ['ambience', []]])
    for (const entry of input.timeline.entries) {
      if (entry.status !== 'placed' || !entry.finalRangeMs || !entry.sourceRangeMs) continue
      const result = resultByCue.get(entry.cueId)
      const cue = cueById.get(entry.cueId)
      if (!result?.audio || !cue) throw CLIUsageError(`Placed sound cue ${entry.cueId} has no checksum-bound source result.`)
      const inputPath = await checkedSource(input.rootDir, result.audio.path, result.audio.sha256)
      placementsByBus.get(entry.bus)?.push({ cueId: entry.cueId, inputPath, sourceDurationMs: result.audio.durationMs, startMs: entry.finalRangeMs.start, endMs: entry.finalRangeMs.end, gainDb: cue.gainDb ?? 0, pan: cue.pan ?? input.plan.mixProfile.defaultPan, loopIterations: entry.loopIterations ?? 1 })
      const parametersHash = hashCanonicalTtsValue({ cueId: entry.cueId, range: entry.finalRangeMs, gainDb: cue.gainDb ?? 0, pan: cue.pan ?? input.plan.mixProfile.defaultPan, loopIterations: entry.loopIterations ?? 1 })
      transforms.push({ transformId: hashCanonicalTtsValue({ kind: entry.bus === 'ambience' ? 'loop' : 'place', parametersHash }), kind: entry.bus === 'ambience' ? 'loop' : 'place', bus: entry.bus, cueId: entry.cueId, parametersHash, finalRangeMs: entry.finalRangeMs })
    }

    const stemPathByBus = new Map<SoundscapeBus, string>([['dialogue', resolve(input.rootDir, dialogue.path)]])
    for (const bus of ['vocal-reaction', 'action-sfx', 'ambience'] as const) {
      const placements = placementsByBus.get(bus) ?? []
      if (placements.length === 0) continue
      const temporary = join(work, `${bus}.wav`)
      await renderPlacementBus({ bus, placements, outputPath: temporary, durationMs: input.timeline.durationMs, plan: input.plan, cancellation: input.cancellation })
      let finalTemporary = temporary
      if (bus === 'ambience') {
        const drivers = ['dialogue', 'vocal-reaction'].flatMap(candidate => stemPathByBus.get(candidate as SoundscapeBus) ?? [])
        if (drivers.length > 0) {
          const ducked = join(work, 'ambience-ducked.wav')
          await duckAmbience({ ambience: temporary, drivers, output: ducked, plan: input.plan, cancellation: input.cancellation })
          finalTemporary = ducked
          const parametersHash = hashCanonicalTtsValue(input.plan.mixProfile.ambienceDucking)
          transforms.push({ transformId: hashCanonicalTtsValue({ kind: 'duck', parametersHash }), kind: 'duck', bus: 'ambience', parametersHash, finalRangeMs: { start: 0, end: input.timeline.durationMs } })
        }
      }
      const stem = await finishImmutableAudio(input.rootDir, finalTemporary, `${outputRoot}/stems/${bus}.wav`)
      stems.push({ bus, ...stem })
      stemPathByBus.set(bus, resolve(input.rootDir, stem.path))
    }

    const masterTemp = join(work, 'master.wav')
    await masterStems({ stems: stems.map(stem => resolve(input.rootDir, stem.path)), output: masterTemp, plan: input.plan, durationMs: input.timeline.durationMs, cancellation: input.cancellation })
    const master = await finishImmutableAudio(input.rootDir, masterTemp, `${outputRoot}/master.wav`)
    const masterParametersHash = hashCanonicalTtsValue({ stems: stems.map(stem => ({ bus: stem.bus, sha256: stem.sha256 })), profile: input.plan.mixProfileHash, durationMs: input.timeline.durationMs })
    transforms.push({ transformId: hashCanonicalTtsValue({ kind: 'master', masterParametersHash }), kind: 'master', parametersHash: masterParametersHash, finalRangeMs: { start: 0, end: input.timeline.durationMs } })
    const timelineBytes = `${canonicalTtsJson(input.timeline)}\n`
    const timelineRef = await writeImmutableArtifactFile(input.rootDir, `${outputRoot}/resolved-soundscape-timeline.json`, timelineBytes)
    const ledger = { schemaVersion: 1 as const, soundscapePlanId: input.plan.soundscapePlanId, mixIdentity: input.plan.mixIdentity, transforms }
    const ledgerRef = await writeImmutableArtifactFile(input.rootDir, `${outputRoot}/soundscape-transform-ledger.json`, `${canonicalTtsJson(ledger)}\n`)
    const base = {
      schemaVersion: 1 as const,
      dialogueAudioRun: { audioRunId: input.dialogueAudioRun.audioRunId, path: input.dialogueAudioRun.path, sha256: input.dialogueAudioRun.sha256 },
      soundscapePlan: { soundscapePlanId: input.plan.soundscapePlanId, path: input.planRef.path, sha256: input.planRef.sha256 },
      ...(input.renderPlan ? { soundEffectRenderPlan: { renderPlanId: input.renderPlan.value.renderPlanId, path: input.renderPlan.ref.path, sha256: input.renderPlan.ref.sha256 } } : {}),
      ...(input.renderResult ? { soundEffectRenderResult: { resultId: input.renderResult.value.resultId, path: input.renderResult.ref.path, sha256: input.renderResult.ref.sha256 } } : {}),
      resolvedTimeline: { timelineId: input.timeline.timelineId, path: timelineRef.relativePath, sha256: sha256Bytes(timelineBytes) },
      mixProfileHash: input.plan.mixProfileHash,
      mixIdentity: input.plan.mixIdentity,
      transformLedger: { path: ledgerRef.relativePath, sha256: ledgerRef.sha256 },
      transforms,
      stems,
      master,
      createdAt: input.plan.createdAt,
    }
    const audioRun: SoundscapeAudioRun = { ...base, audioRunId: hashCanonicalTtsValue(base) }
    const ref = await writeImmutableArtifactFile(input.rootDir, `${outputRoot}/audio-run.json`, `${canonicalTtsJson(audioRun)}\n`)
    return { audioRun, ref: { path: ref.relativePath, sha256: ref.sha256 } }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}
