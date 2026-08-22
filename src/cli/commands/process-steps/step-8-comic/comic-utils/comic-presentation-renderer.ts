import { link, mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  ComicPresentationAudioTransform,
  ComicPresentationEncoderProfile,
  ComicPresentationPlan,
  ComicPresentationRun,
  CompactPresentation,
  DialogueSlice,
  FfmpegCommand,
  ObservedAudioFormat,
  ResolvedPanelTimeline,
} from '~/types'
import { UsageError, hasErrorCode, InfraError } from '~/utils/error-handler'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { inspectSoundscapeAudio } from '../../step-4-tts/soundscape/soundscape-audio'
import { hardlinkContainedArtifact, isMissingArtifactError, readContainedArtifactFile, removeContainedDirectory, writeReplaceableArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'

export const PRESENTATION_ARCHIVE_PATH = 'presentation/presentation.json'
export const PRESENTATION_FINAL_WAV = 'presentation/final/slideshow.wav'
export const PRESENTATION_FINAL_MP4 = 'presentation/final/slideshow.mp4'

const seconds = (milliseconds: number): string => (milliseconds / 1000).toFixed(6)

const audioLayout = (channels: number): 'mono' | 'stereo' => channels === 1 ? 'mono' : 'stereo'

const delayFilter = (milliseconds: number, channels: number): string =>
  `adelay=${channels === 1 ? String(milliseconds) : `${milliseconds}|${milliseconds}`}`

const constantPowerPan = (pan: number, channels: number): string => {
  if (channels === 1) return 'aformat=channel_layouts=mono'
  const angle = (pan + 1) * Math.PI / 4
  return `aformat=channel_layouts=mono,pan=stereo|c0=${Math.cos(angle).toFixed(9)}*c0|c1=${Math.sin(angle).toFixed(9)}*c0`
}

const mergeDialogueSlices = (timeline: ResolvedPanelTimeline): DialogueSlice[] => {
  const result: DialogueSlice[] = []
  for (const panel of timeline.panels) {
    const events = timeline.events
      .filter(event => event.panelNumber === panel.panelNumber && event.kind === 'dialogue')
      .sort((left, right) => left.sourceRangeMs.start - right.sourceRangeMs.start || left.sourceRangeMs.end - right.sourceRangeMs.end)
    for (const event of events) {
      const prior = result.at(-1)
      const offset = event.presentationRangeMs.start - event.sourceRangeMs.start
      const priorOffset = prior ? prior.finalRangeMs.start - prior.sourceRangeMs.start : undefined
      if (prior && prior.panelNumber === panel.panelNumber && event.sourceRangeMs.start <= prior.sourceRangeMs.end && offset === priorOffset) {
        prior.sourceRangeMs.end = Math.max(prior.sourceRangeMs.end, event.sourceRangeMs.end)
        prior.finalRangeMs.end = prior.finalRangeMs.start + prior.sourceRangeMs.end - prior.sourceRangeMs.start
        prior.turnIds.push(...event.sourceIds)
      } else {
        result.push({ panelNumber: panel.panelNumber, turnIds: [...event.sourceIds], sourceRangeMs: { ...event.sourceRangeMs }, finalRangeMs: { ...event.presentationRangeMs } })
      }
    }
  }
  return result
}

export const buildPresentationAudioCommand = (input: {
  sceneRunDir: string
  plan: ComicPresentationPlan
  timeline: ResolvedPanelTimeline
  outputPath: string
}): { command: FfmpegCommand, transforms: ComicPresentationAudioTransform[], format: ObservedAudioFormat } => {
  const sourceFormat = input.plan.inputs.dialogueAudio.format
  const sampleRate = sourceFormat.sampleRate
  const channels = sourceFormat.channels === 1 ? 1 : 2
  const codec = sourceFormat.codec === 'pcm_s24le' ? 'pcm_s24le' : 'pcm_s16le'
  const format: ObservedAudioFormat = { codec, container: 'wav', sampleRate, channels }
  const args = ['-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1']
  args.push('-f', 'lavfi', '-i', `anullsrc=r=${sampleRate}:cl=${audioLayout(channels)}`)
  const filters: string[] = [`[0:a]atrim=0:${seconds(input.timeline.durationMs)},asetpts=PTS-STARTPTS[silence]`]
  const labels = ['[silence]']
  const transforms: ComicPresentationAudioTransform[] = []
  let inputIndex = 1

  for (const slice of mergeDialogueSlices(input.timeline)) {
    const sourceRef = { path: input.plan.inputs.dialogueAudio.path, sha256: input.plan.inputs.dialogueAudio.sha256 }
    args.push('-i', resolve(input.sceneRunDir, sourceRef.path))
    const label = `dialogue${inputIndex}`
    const durationMs = slice.sourceRangeMs.end - slice.sourceRangeMs.start
    filters.push([
      `[${inputIndex}:a]atrim=start=${seconds(slice.sourceRangeMs.start)}:end=${seconds(slice.sourceRangeMs.end)}`,
      'asetpts=PTS-STARTPTS',
      `aresample=${sampleRate}`,
      `aformat=sample_fmts=fltp:channel_layouts=${audioLayout(channels)}`,
      `${delayFilter(slice.finalRangeMs.start, channels)}[${label}]`,
    ].join(','))
    labels.push(`[${label}]`)
    const parametersHash = hashCanonicalTtsValue({ sampleRate, channels, sourceRangeMs: slice.sourceRangeMs, finalRangeMs: slice.finalRangeMs })
    transforms.push({
      transformId: hashCanonicalTtsValue({ kind: 'dialogue-range', sourceRef, sourceIds: slice.turnIds, parametersHash }),
      kind: 'dialogue-range', sourceRef, sourceIds: slice.turnIds, sourceRangeMs: slice.sourceRangeMs,
      finalRangeMs: { start: slice.finalRangeMs.start, end: slice.finalRangeMs.start + durationMs }, parametersHash,
    })
    inputIndex += 1
  }

  for (const event of input.timeline.events.filter(candidate => candidate.kind !== 'dialogue')) {
    const cueId = event.sourceIds[0] as string
    const binding = input.plan.soundBindings.find(candidate => candidate.cueId === cueId)
    if (!binding) throw UsageError(`Resolved presentation event ${event.eventId} has no sound binding.`)
    args.push('-i', resolve(input.sceneRunDir, binding.sourceAudio.path))
    const label = `sound${inputIndex}`
    const durationMs = event.presentationRangeMs.end - event.presentationRangeMs.start
    filters.push([
      `[${inputIndex}:a]atrim=0:${seconds(durationMs)}`,
      'asetpts=PTS-STARTPTS',
      `aresample=${sampleRate}`,
      constantPowerPan(binding.pan, channels),
      `volume=${binding.gainDb.toFixed(4)}dB`,
      `${delayFilter(event.presentationRangeMs.start, channels)}[${label}]`,
    ].join(','))
    labels.push(`[${label}]`)
    const sourceRef = { path: binding.sourceAudio.path, sha256: binding.sourceAudio.sha256 }
    const parametersHash = hashCanonicalTtsValue({ sampleRate, channels, gainDb: binding.gainDb, pan: binding.pan, finalRangeMs: event.presentationRangeMs })
    transforms.push({
      transformId: hashCanonicalTtsValue({ kind: 'sound-effect-placement', sourceRef, cueId, parametersHash }),
      kind: 'sound-effect-placement', sourceRef, sourceIds: [cueId], sourceRangeMs: event.sourceRangeMs, finalRangeMs: event.presentationRangeMs, parametersHash,
    })
    inputIndex += 1
  }

  for (const ambience of input.plan.ambience) {
    args.push('-stream_loop', '-1', '-i', resolve(input.sceneRunDir, ambience.sourceAudio.path))
    const label = `ambience${inputIndex}`
    filters.push([
      `[${inputIndex}:a]atrim=duration=${seconds(input.timeline.durationMs)}`,
      'asetpts=PTS-STARTPTS',
      `aresample=${sampleRate}`,
      constantPowerPan(ambience.pan, channels),
      `volume=${ambience.gainDb.toFixed(4)}dB[${label}]`,
    ].join(','))
    labels.push(`[${label}]`)
    const sourceRef = { path: ambience.sourceAudio.path, sha256: ambience.sourceAudio.sha256 }
    const parametersHash = hashCanonicalTtsValue({ sampleRate, channels, gainDb: ambience.gainDb, pan: ambience.pan, loop: true, durationMs: input.timeline.durationMs })
    transforms.push({
      transformId: hashCanonicalTtsValue({ kind: 'ambience-loop', sourceRef, cueId: ambience.cueId, parametersHash }),
      kind: 'ambience-loop', sourceRef, sourceIds: [ambience.cueId], sourceRangeMs: { start: 0, end: ambience.sourceAudio.durationMs }, finalRangeMs: { start: 0, end: input.timeline.durationMs }, parametersHash,
    })
    inputIndex += 1
  }
  if (input.plan.ambience.length === 0) {
    const parametersHash = hashCanonicalTtsValue({ sampleRate, channels, durationMs: input.timeline.durationMs })
    transforms.push({ transformId: hashCanonicalTtsValue({ kind: 'digital-silence', parametersHash }), kind: 'digital-silence', sourceIds: [], finalRangeMs: { start: 0, end: input.timeline.durationMs }, parametersHash })
  }
  const mixParametersHash = hashCanonicalTtsValue({ inputCount: labels.length, sampleRate, channels, codec, durationMs: input.timeline.durationMs })
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=0.950000,atrim=0:${seconds(input.timeline.durationMs)},aresample=${sampleRate}[presentation]`)
  transforms.push({ transformId: hashCanonicalTtsValue({ kind: 'mix', mixParametersHash }), kind: 'mix', sourceIds: transforms.flatMap(transform => transform.sourceIds), finalRangeMs: { start: 0, end: input.timeline.durationMs }, parametersHash: mixParametersHash })
  args.push('-filter_complex', filters.join(';'), '-map', '[presentation]', '-ar', String(sampleRate), '-ac', String(channels), '-c:a', codec, '-bitexact', '-t', seconds(input.timeline.durationMs), '-y', input.outputPath)
  return { command: { tool: 'ffmpeg', args }, transforms, format }
}

const ffconcatPath = (path: string): string => `'${path.replaceAll("'", "'\\''")}'`

const writePresentationConcatFile = async (path: string, sceneRunDir: string, timeline: ResolvedPanelTimeline): Promise<void> => {
  const lines = ['ffconcat version 1.0']
  for (const panel of timeline.panels) {
    lines.push(`file ${ffconcatPath(resolve(sceneRunDir, panel.image.path))}`)
    lines.push(`duration ${seconds(panel.durationMs)}`)
  }
  const last = timeline.panels.at(-1)
  if (!last) throw UsageError('Cannot render a slideshow without panels.')
  lines.push(`file ${ffconcatPath(resolve(sceneRunDir, last.image.path))}`)
  await Bun.write(path, `${lines.join('\n')}\n`)
}

const buildPresentationVideoCommand = (input: {
  concatPath: string
  wavPath: string
  outputPath: string
  timeline: ResolvedPanelTimeline
  encoderProfile: ComicPresentationEncoderProfile
}): FfmpegCommand => {
  const encoderArgs = input.encoderProfile.videoEncoder === 'libx264'
    ? ['-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage']
    : input.encoderProfile.videoEncoder === 'h264_videotoolbox'
      ? ['-c:v', 'h264_videotoolbox', '-b:v', '8M', '-profile:v', 'high', '-allow_sw', '1']
      : input.encoderProfile.videoEncoder === 'h264_nvenc'
        ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23', '-b:v', '0', '-profile:v', 'high']
        : ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '23']
  return {
    tool: 'ffmpeg',
    args: [
    '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1',
    '-f', 'concat', '-safe', '0', '-i', input.concatPath,
    '-i', input.wavPath,
    '-map', '0:v:0', '-map', '1:a:0',
    ...encoderArgs,
    '-vf', `fps=${input.encoderProfile.fps}`, '-pix_fmt', input.encoderProfile.pixelFormat, '-fps_mode', 'cfr',
    '-c:a', input.encoderProfile.audioCodec, '-b:a', input.encoderProfile.audioBitrate,
    '-movflags', '+faststart', '-t', seconds(input.timeline.durationMs), '-y', input.outputPath,
    ],
  }
}

const executeFfmpeg = async (command: FfmpegCommand, label: string): Promise<void> => {
  const result = await exec(getFfmpegBinary(), command.args)
  if (result.exitCode !== 0) throw InfraError(`Failed to render comic presentation ${label}: ${result.stderr.trim() || `ffmpeg exited ${result.exitCode}`}`, { stage: 'comic:generate-slideshow' })
}

export const selectPresentationVideoEncoder = async (): Promise<ComicPresentationEncoderProfile['videoEncoder']> => {
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-encoders'])
  if (result.exitCode !== 0) throw InfraError(`Could not inspect FFmpeg H.264 encoders: ${result.stderr.trim() || `ffmpeg exited ${result.exitCode}`}`, { stage: 'comic:generate-slideshow' })
  const available = result.stdout
  for (const encoder of ['libx264', 'h264_videotoolbox', 'h264_nvenc', 'h264_amf'] as const) {
    if (available.includes(encoder)) return encoder
  }
  throw InfraError('Comic slideshow rendering requires an FFmpeg build with libx264 or a supported H.264 hardware encoder.', { stage: 'comic:generate-slideshow' })
}

const publishStagedImmutable = async (sceneRunDir: string, stagedPath: string, relativePath: string): Promise<{ path: string, sha256: string }> => {
  const destination = resolve(sceneRunDir, relativePath)
  await mkdir(dirname(destination), { recursive: true })
  const stagedBytes = new Uint8Array(await Bun.file(stagedPath).arrayBuffer())
  const sha256 = sha256Bytes(stagedBytes)
  try {
    await link(stagedPath, destination)
  } catch (error) {
    if (!hasErrorCode(error, 'EEXIST')) throw error
    const existing = await readContainedArtifactFile(sceneRunDir, relativePath)
    if (existing.sha256 !== sha256) throw UsageError(
        `Immutable comic presentation artifact conflicts with existing bytes: ${relativePath}`,
        undefined,
        error instanceof Error ? { cause: error } : {}
      )
  }
  await rm(stagedPath, { force: true })
  return { path: relativePath, sha256 }
}

const existingRef = async (sceneRunDir: string, relativePath: string): Promise<{ path: string, sha256: string } | undefined> => {
  try {
    const stored = await readContainedArtifactFile(sceneRunDir, relativePath)
    return { path: relativePath, sha256: stored.sha256 }
  } catch (error) {
    if (isMissingArtifactError(error)) return undefined
    throw error
  }
}

const inspectPresentationVideo = async (path: string): Promise<{ durationMs: number, width: number, height: number, videoCodec: string, pixelFormat: string, audioCodec: string }> => {
  const result = await exec(getFfprobeBinary(), ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,pix_fmt,width,height', '-of', 'json', path])
  if (result.exitCode !== 0) throw UsageError(`Could not inspect rendered comic slideshow: ${result.stderr.trim() || `ffprobe exited ${result.exitCode}`}`)
  const parsed = JSON.parse(result.stdout) as { format?: { duration?: string }, streams?: Array<{ codec_type?: string, codec_name?: string, pix_fmt?: string, width?: number, height?: number }> }
  const video = parsed.streams?.find(stream => stream.codec_type === 'video')
  const audio = parsed.streams?.find(stream => stream.codec_type === 'audio')
  const durationMs = Math.round(Number(parsed.format?.duration) * 1000)
  if (!video?.codec_name || !audio?.codec_name || !Number.isFinite(durationMs) || durationMs <= 0 || !video.width || !video.height || !video.pix_fmt) throw UsageError('Rendered comic slideshow has incomplete codec, dimension, or duration evidence.')
  return { durationMs, width: video.width, height: video.height, videoCodec: video.codec_name, pixelFormat: video.pix_fmt, audioCodec: audio.codec_name }
}

export const presentationRunAsArchive = (presentation: CompactPresentation, archiveSha256: string): ComicPresentationRun => {
  const archiveRef = { path: PRESENTATION_ARCHIVE_PATH, sha256: archiveSha256 }
  const base = {
    schemaVersion: 1 as const,
    presentationId: presentation.presentationId,
    plan: archiveRef,
    resolvedTimeline: { ...archiveRef, timelineId: presentation.timeline.timelineId },
    audioTransforms: presentation.audioTransforms,
    encoderProfile: presentation.encoderProfile,
    commands: presentation.commands,
    outputs: presentation.outputs,
    createdAt: presentation.createdAt,
  }
  return { ...base, presentationRunId: hashCanonicalTtsValue(base) }
}

export const validateCompactPresentation = (value: CompactPresentation): CompactPresentation => {
  if (value.schemaVersion !== 1 || value.presentationId !== value.plan.presentationId || value.timeline.presentationId !== value.plan.presentationId) {
    throw UsageError('Compact presentation has invalid identity.')
  }
  return value
}

export const validateComicPresentationRun = (run: ComicPresentationRun): ComicPresentationRun => {
  const { presentationRunId: _presentationRunId, ...base } = run
  if (run.schemaVersion !== 1 || run.presentationRunId !== hashCanonicalTtsValue(base)) throw UsageError('ComicPresentationRun has invalid content identity.')
  return run
}

export const loadCompactPresentation = async (sceneRunDir: string, presentationId?: string): Promise<{ presentation: CompactPresentation, ref: { path: string, sha256: string } } | undefined> => {
  let stored: Awaited<ReturnType<typeof readContainedArtifactFile>>
  try { stored = await readContainedArtifactFile(sceneRunDir, PRESENTATION_ARCHIVE_PATH) }
  catch (error) {
    if (isMissingArtifactError(error)) return undefined
    throw error
  }
  let presentation: CompactPresentation
  try { presentation = validateCompactPresentation(JSON.parse(stored.bytes.toString('utf8')) as CompactPresentation) }
  catch { throw UsageError('Retained presentation.json is not valid JSON.') }
  if (presentationId && presentation.presentationId !== presentationId) return undefined
  for (const output of [presentation.outputs.wav, presentation.outputs.mp4]) {
    const artifact = await readContainedArtifactFile(sceneRunDir, output.path)
    if (artifact.sha256 !== output.sha256) throw UsageError(`Retained presentation output checksum is stale: ${output.path}`)
  }
  return { presentation, ref: { path: stored.relativePath, sha256: stored.sha256 } }
}

const compactSucceededPresentation = async (sceneRunDir: string, presentation: CompactPresentation, runRoot: string): Promise<{ presentation: CompactPresentation, run: ComicPresentationRun, runRef: { path: string, sha256: string } }> => {
  const written = await writeReplaceableArtifactFile(sceneRunDir, PRESENTATION_ARCHIVE_PATH, `${canonicalTtsJson(presentation)}\n`)
  await removeContainedDirectory(sceneRunDir, runRoot)
  await removeContainedDirectory(sceneRunDir, 'presentation/runs')
  const run = validateComicPresentationRun(presentationRunAsArchive(presentation, written.sha256))
  return { presentation, run, runRef: { path: written.relativePath, sha256: written.sha256 } }
}

export const renderComicPresentation = async (input: {
  sceneRunDir: string
  plan: ComicPresentationPlan
  planRef?: { path: string, sha256: string } | undefined
  timeline: ResolvedPanelTimeline
  timelineRef?: { path: string, sha256: string } | undefined
}): Promise<{ run: ComicPresentationRun, runRef: { path: string, sha256: string }, presentation: CompactPresentation }> => {
  const existing = await loadCompactPresentation(input.sceneRunDir, input.plan.presentationId)
  if (existing) {
    return { presentation: existing.presentation, run: validateComicPresentationRun(presentationRunAsArchive(existing.presentation, existing.ref.sha256)), runRef: existing.ref }
  }
  const runRoot = `presentation/runs/${input.plan.presentationId}`
  const stagingRoot = join(input.sceneRunDir, runRoot, '.staging')
  await mkdir(stagingRoot, { recursive: true })
  const wavRelative = `${runRoot}/presentation.wav`
  const mp4Relative = `${runRoot}/slideshow.mp4`
  const concatPath = join(stagingRoot, 'panels.ffconcat')
  const stagedWav = join(stagingRoot, 'presentation.part.wav')
  const stagedMp4 = join(stagingRoot, 'slideshow.part.mp4')
  const audioBuild = buildPresentationAudioCommand({ sceneRunDir: input.sceneRunDir, plan: input.plan, timeline: input.timeline, outputPath: stagedWav })
  const firstPanel = input.plan.inputs.panels[0] as NonNullable<typeof input.plan.inputs.panels[number]>
  const videoEncoder = await selectPresentationVideoEncoder()
  const encoderProfile: ComicPresentationEncoderProfile = {
    schemaVersion: 1, videoCodec: 'h264', videoEncoder, pixelFormat: 'yuv420p', fps: input.plan.options.fps,
    stillImageTuning: videoEncoder === 'libx264' ? 'libx264-stillimage' : 'static-source',
    audioCodec: 'aac', audioBitrate: '192k', fastStart: true, transitions: 'hard-cuts', width: firstPanel.width, height: firstPanel.height,
  }
  const videoCommand = buildPresentationVideoCommand({ concatPath, wavPath: resolve(input.sceneRunDir, wavRelative), outputPath: stagedMp4, timeline: input.timeline, encoderProfile })
  let wavRef = await existingRef(input.sceneRunDir, wavRelative)
  if (!wavRef) {
    await executeFfmpeg(audioBuild.command, 'WAV')
    wavRef = await publishStagedImmutable(input.sceneRunDir, stagedWav, wavRelative)
  }
  const wavPath = resolve(input.sceneRunDir, wavRelative)
  const wav = await inspectSoundscapeAudio(wavPath)
  if (Math.abs(wav.durationMs - input.timeline.durationMs) > 1 || wav.format.sampleRate !== audioBuild.format.sampleRate || wav.format.channels !== audioBuild.format.channels || wav.format.codec !== audioBuild.format.codec) throw UsageError('Presentation WAV does not match its resolved duration and PCM profile.')
  await writePresentationConcatFile(concatPath, input.sceneRunDir, input.timeline)
  let mp4Ref = await existingRef(input.sceneRunDir, mp4Relative)
  if (!mp4Ref) {
    await executeFfmpeg(videoCommand, 'MP4')
    mp4Ref = await publishStagedImmutable(input.sceneRunDir, stagedMp4, mp4Relative)
  }
  const video = await inspectPresentationVideo(resolve(input.sceneRunDir, mp4Relative))
  const frameMs = 1000 / encoderProfile.fps
  if (Math.abs(video.durationMs - input.timeline.durationMs) > frameMs + 1 || video.width !== encoderProfile.width || video.height !== encoderProfile.height || video.videoCodec !== 'h264' || video.pixelFormat !== encoderProfile.pixelFormat || video.audioCodec !== 'aac') throw UsageError('Presentation MP4 does not match its timeline, source dimensions, H.264/yuv420p video, or AAC audio contract.')
  const finalWav = await hardlinkContainedArtifact(input.sceneRunDir, wavRef.path, PRESENTATION_FINAL_WAV)
  const finalMp4 = await hardlinkContainedArtifact(input.sceneRunDir, mp4Ref.path, PRESENTATION_FINAL_MP4)
  if (finalWav.sha256 !== wavRef.sha256 || finalMp4.sha256 !== mp4Ref.sha256) throw UsageError('Published presentation finals do not match their rendered media.')
  const presentation: CompactPresentation = {
    schemaVersion: 1,
    presentationId: input.plan.presentationId,
    plan: input.plan,
    timeline: input.timeline,
    encoderProfile,
    audioTransforms: audioBuild.transforms,
    commands: [audioBuild.command, videoCommand],
    outputs: {
      wav: { path: PRESENTATION_FINAL_WAV, sha256: finalWav.sha256, format: wav.format, durationMs: wav.durationMs },
      mp4: { path: PRESENTATION_FINAL_MP4, sha256: finalMp4.sha256, durationMs: video.durationMs },
    },
    createdAt: input.plan.createdAt,
  }
  return await compactSucceededPresentation(input.sceneRunDir, presentation, runRoot)
}

export const publishComicPresentationFinal = async (sceneRunDir: string, run: ComicPresentationRun): Promise<Array<{ path: string, sha256: string }>> => {
  const publish = async (source: { path: string, sha256: string }, relativePath: string): Promise<{ path: string, sha256: string }> => {
    const sourceFile = await readContainedArtifactFile(sceneRunDir, source.path)
    if (sourceFile.sha256 !== source.sha256) throw UsageError(`Comic presentation output checksum changed before publication: ${source.path}`)
    const published = await hardlinkContainedArtifact(sceneRunDir, source.path, relativePath)
    if (published.sha256 !== source.sha256) throw UsageError(`Published comic presentation output checksum does not match: ${relativePath}`)
    return { path: relativePath, sha256: source.sha256 }
  }
  return [
    await publish(run.outputs.wav, PRESENTATION_FINAL_WAV),
    await publish(run.outputs.mp4, PRESENTATION_FINAL_MP4),
  ]
}
