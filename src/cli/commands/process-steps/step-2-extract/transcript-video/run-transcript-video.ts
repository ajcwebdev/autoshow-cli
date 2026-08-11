import { isRecord } from '~/utils/rest-client'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { getOutputRoot, getOutputRootAbsolute } from '~/cli/commands/process-steps/output-root'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { parseStoredTranscriptionResult } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import { formatCaptionTimestamp, formatSrt, formatVtt, hmsPartsToSeconds } from '~/cli/commands/process-steps/step-7-music/lyrics-video/captions'
import { TRANSCRIPT_CUE_LIMITS, buildTranscriptionCues } from '~/cli/commands/process-steps/step-7-music/lyrics-video/cue-builder'
import { buildTranscriptAss, extractTitle, findMatchingImage, FIXED_RENDER_FPS, FIXED_RENDER_HEIGHT, FIXED_RENDER_WIDTH, formatSpeakerDisplayLabel, renderLyricsVideo, TRANSCRIPT_OVERLAY_TEXT_LAYOUT } from '~/cli/commands/process-steps/step-7-music/lyrics-video/render'
import type { CaptionCue, LoadedTranscription, PipelineManifestItem, TranscriptCue, TranscriptCueSource, TranscriptionResult, TranscriptVideoSource } from '~/types'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { materializeMediaInput } from '~/utils/media-url'
import { PROJECT_ROOT, baseStem, resolveUserPath, toProjectDisplayPath } from '~/utils/runtime-paths'

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'])
const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/
const MAX_TRANSCRIPT_WORDS_PER_CUE = 12
const MAX_TRANSCRIPT_CHARACTERS_PER_CUE = 78


const materializeAudioInput = async (
  value: string
): Promise<{ audioPath: string, audioDisplayPath?: string | undefined, cleanup: () => Promise<void> }> => {
  const materialized = await materializeMediaInput(value, {
    accept: 'audio/*,video/*,application/octet-stream;q=0.9,*/*;q=0.8',
    label: 'transcript-video audio'
  })

  if (materialized.isRemote) {
    return {
      audioPath: materialized.path,
      audioDisplayPath: materialized.input,
      cleanup: materialized.cleanup
    }
  }

  return {
    audioPath: resolveUserPath(materialized.path),
    cleanup: materialized.cleanup
  }
}

const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim()

const splitTranscriptText = (text: string): string[] => {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return []
  }

  const chunks: string[] = []
  let currentWords: string[] = []

  const flush = (): void => {
    if (currentWords.length === 0) {
      return
    }
    chunks.push(currentWords.join(' '))
    currentWords = []
  }

  for (const word of words) {
    const projected = currentWords.length === 0 ? word : `${currentWords.join(' ')} ${word}`
    if (
      currentWords.length > 0
      && (
        currentWords.length >= MAX_TRANSCRIPT_WORDS_PER_CUE
        || projected.length > MAX_TRANSCRIPT_CHARACTERS_PER_CUE
      )
    ) {
      flush()
    }

    currentWords.push(word)

    if (
      currentWords.length >= 6
      && (
        /[.!?]$/.test(word)
        || (currentWords.length >= 8 && /[,;:]$/.test(word))
      )
    ) {
      flush()
    }
  }

  flush()
  return chunks
}

const splitTranscriptCue = (cue: TranscriptCue): TranscriptCue[] => {
  const chunks = splitTranscriptText(cue.text)
  if (chunks.length <= 1) {
    return [{
      ...cue,
      text: chunks[0] ?? cue.text
    }]
  }

  const cueDuration = Math.max(cue.end - cue.start, 0.1)
  const weights = chunks.map((chunk) => Math.max(1, chunk.split(/\s+/).filter(Boolean).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let elapsedWeight = 0

  return chunks.map((chunk, index) => {
    const startWeight = elapsedWeight
    elapsedWeight += weights[index] ?? 1
    return {
      ...cue,
      index: 0,
      start: cue.start + (cueDuration * startWeight / totalWeight),
      end: cue.start + (cueDuration * elapsedWeight / totalWeight),
      text: chunk
    }
  })
}

const expandTranscriptCues = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] =>
  repairCueDurations(cues, audioDurationSeconds)
    .flatMap(splitTranscriptCue)
    .map((cue, index) => ({ ...cue, index }))

const parseTimestampToSeconds = (timestamp: string): number => {
  const match = timestamp.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:([.,])(\d{1,3}))?$/)
  if (!match) {
    return Number.NaN
  }

  return hmsPartsToSeconds(match[1]!, match[2]!, match[3]!, match[5]?.padEnd(3, '0') ?? '0')
}

const repairCueDurations = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] => cues.map((cue, index) => {
  const nextCue = cues[index + 1]
  let end = cue.end

  if (!Number.isFinite(end) || end <= cue.start) {
    if (nextCue && nextCue.start > cue.start) {
      end = nextCue.start
    } else if (audioDurationSeconds !== undefined && audioDurationSeconds > cue.start) {
      end = audioDurationSeconds
    } else {
      end = cue.start + 2.5
    }
  }

  return {
    ...cue,
    end: Math.max(end, cue.start + 0.1)
  }
}).filter((cue) => cue.end > cue.start)

const buildCuesFromTranscriptionResult = (
  result: TranscriptionResult
): { cues: TranscriptCue[], cueSource: TranscriptCueSource } => {
  // Native per-word timings are exact. Segment stamps only bound a whole utterance, so splitting them
  // into displayed lines has to interpolate, which drifts by up to a second on long segments.
  if ((result.evidence?.words?.length ?? 0) > 0) {
    const { cues } = buildTranscriptionCues(result, TRANSCRIPT_CUE_LIMITS)
    const wordCues = cues.map((cue, index) => ({
      index,
      start: cue.start,
      end: cue.end,
      text: cue.text,
      ...(cue.speaker ? { speaker: cue.speaker } : {})
    }))

    if (wordCues.length > 0) {
      return { cues: wordCues, cueSource: 'extract-evidence-words' }
    }
  }

  const evidenceSegments = result.evidence?.segments ?? []
  if (evidenceSegments.length > 0) {
    const cues = evidenceSegments
      .map((segment) => ({
        index: 0,
        start: segment.startSeconds,
        end: segment.endSeconds,
        text: normalizeText(segment.text),
        ...(segment.speaker ? { speaker: segment.speaker } : {})
      }))
      .filter((cue) =>
        Number.isFinite(cue.start)
        && Number.isFinite(cue.end)
        && cue.text.length > 0
      )
      .sort((left, right) => left.start - right.start || left.end - right.end)
      .map((cue, index) => ({ ...cue, index }))

    if (cues.length > 0) {
      return { cues: expandTranscriptCues(cues), cueSource: 'extract-evidence-segments' }
    }
  }

  const cues = result.segments
    .map((segment) => ({
      index: 0,
      start: parseTimestampToSeconds(segment.start),
      end: parseTimestampToSeconds(segment.end),
      text: normalizeText(segment.text),
      ...(segment.speaker ? { speaker: segment.speaker } : {})
    }))
    .filter((cue) =>
      Number.isFinite(cue.start)
      && Number.isFinite(cue.end)
      && cue.text.length > 0
    )
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((cue, index) => ({ ...cue, index }))

  return { cues: expandTranscriptCues(cues), cueSource: 'extract-result-segments' }
}

const buildCuesFromTranscriptText = (
  transcriptText: string,
  audioDurationSeconds?: number | undefined
): { result: TranscriptionResult, cues: TranscriptCue[] } => {
  const parsed: Array<Omit<TranscriptCue, 'index' | 'end'> & { end?: number | undefined }> = []

  for (const rawLine of transcriptText.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const text = normalizeText(match[3] ?? '')
    const start = parseTimestampToSeconds(match[1]!)
    if (!Number.isFinite(start) || text.length === 0) {
      continue
    }

    parsed.push({
      start,
      text,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0 ? { speaker: match[2].trim() } : {})
    })
  }

  if (parsed.length === 0) {
    throw ValidationError('Transcript text contained no timestamped lines in [HH:MM:SS] format', { stage: 'video:transcript' })
  }

  const cues = parsed.map((cue, index) => ({
    ...cue,
    index,
    end: parsed[index + 1]?.start ?? audioDurationSeconds ?? cue.start + 2.5
  }))

  const repaired = expandTranscriptCues(cues, audioDurationSeconds)
  return {
    result: {
      text: repaired.map((cue) => cue.text).join(' ').trim(),
      segments: repaired.map((cue) => ({
        start: formatCaptionTimestamp(cue.start, '.'),
        end: formatCaptionTimestamp(cue.end, '.'),
        text: cue.text,
        ...(cue.speaker ? { speaker: cue.speaker } : {})
      }))
    },
    cues: repaired
  }
}

// Captions carry the speaker inline because .vtt/.srt have no second line to attribute with; the
// rendered video instead draws the label as its own coloured chip.
const toCaptionCuesWithSpeakerLabels = (cues: TranscriptCue[]): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.speaker ? `${formatSpeakerDisplayLabel(cue.speaker)}: ${cue.text}` : cue.text
  }))

// The rendered video keeps the label out of the text so it can be drawn as its own coloured chip on
// the active line only; context lines above and below stay unlabelled.
const toRenderCues = (cues: TranscriptCue[]): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.text,
    ...(cue.speaker ? { speaker: cue.speaker } : {})
  }))

const collectSpeakerInventory = (cues: TranscriptCue[]): string[] => {
  const speakers: string[] = []
  const seen = new Set<string>()
  for (const cue of cues) {
    if (!cue.speaker || seen.has(cue.speaker)) {
      continue
    }
    seen.add(cue.speaker)
    speakers.push(cue.speaker)
  }
  return speakers
}

const loadTranscriptionResultJson = async (resultPath: string): Promise<LoadedTranscription> => {
  const raw = await Bun.file(resultPath).json() as unknown
  const parsed = parseStoredTranscriptionResult(raw)
  if (!parsed) {
    throw ValidationError(`Transcript result file is not a supported STT result: ${toProjectDisplayPath(resultPath)}`, { stage: 'video:transcript' })
  }

  return {
    result: parsed,
    source: 'result-json',
    sourcePath: resultPath
  }
}

const loadTranscriptText = async (
  transcriptPath: string,
  audioDurationSeconds?: number | undefined
): Promise<{ transcription: LoadedTranscription, cues: TranscriptCue[] }> => {
  const raw = await Bun.file(transcriptPath).text()
  const { result, cues } = buildCuesFromTranscriptText(raw, audioDurationSeconds)
  return {
    transcription: {
      result,
      source: 'transcript-text',
      sourcePath: transcriptPath
    },
    cues
  }
}

const resolveAudioFromExtractRun = async (
  runDir: string,
  item: PipelineManifestItem
): Promise<string> => {
  const step1 = isRecord(item.metadata['step1']) ? item.metadata['step1'] : undefined
  const fileNames = [
    typeof step1?.['audioFileName'] === 'string' ? step1['audioFileName'] : undefined,
    typeof step1?.['mediaFileName'] === 'string' ? step1['mediaFileName'] : undefined
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  for (const fileName of fileNames) {
    const candidate = join(runDir, fileName)
    if (await fileExists(candidate)) {
      return candidate
    }
  }

  const entries = await readdir(runDir, { withFileTypes: true })
  const audioFiles = entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(runDir, entry.name))
    .sort()

  if (audioFiles.length === 1) {
    return audioFiles[0]!
  }

  throw CLIUsageError(`Could not infer extract audio file from ${toProjectDisplayPath(runDir)}. Pass --audio explicitly.`)
}

const getProviderStateResultCandidates = async (
  runDir: string,
  item: PipelineManifestItem
): Promise<string[]> => {
  const candidates: string[] = []
  for (const state of item.providers) {
    if (state.status !== 'succeeded') {
      continue
    }
    const candidate = join(runDir, state.artifactDir, 'result.json')
    if (await fileExists(candidate)) {
      candidates.push(candidate)
    }
  }

  return [...new Set(candidates)].sort()
}

const resolveResultFromExtractRun = async (
  runDir: string,
  item: PipelineManifestItem
): Promise<string> => {
  const candidates = await getProviderStateResultCandidates(runDir, item)
  if (candidates.length === 1) {
    return candidates[0]!
  }

  if (candidates.length > 1) {
    throw CLIUsageError(`Multiple STT result files found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result to choose one.`)
  }

  throw CLIUsageError(`No STT result.json found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result or --transcript-text explicitly.`)
}

const resolveTitleFromExtractRun = (item: PipelineManifestItem, audioPath: string): string => {
  const step1 = isRecord(item.metadata['step1']) ? item.metadata['step1'] : undefined
  const title = typeof step1?.['title'] === 'string' && step1['title'].trim().length > 0
    ? step1['title'].trim()
    : undefined
  return title ?? extractTitle(audioPath)
}

const resolveExtractRunSource = async (
  inputPath: string,
  flags: Record<string, unknown>
): Promise<TranscriptVideoSource> => {
  const runDir = resolveUserPath(inputPath)
  const manifest = await readManifest(runDir)
  const item = manifest?.items[0]
  if (!manifest || manifest.command !== 'extract' || manifest.scope !== 'single' || !item || item.extractRoute !== 'media') {
    throw CLIUsageError(`Transcript video input must be a media extract output directory: ${toProjectDisplayPath(runDir)}`)
  }

  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const resultFlag = typeof flags['transcript-result'] === 'string' ? flags['transcript-result'] : undefined
  const textFlag = typeof flags['transcript-text'] === 'string' ? flags['transcript-text'] : undefined
  if (resultFlag && textFlag) {
    throw CLIUsageError('Use only one of --transcript-result or --transcript-text')
  }

  const audioInput = audioFlag ? await materializeAudioInput(audioFlag) : undefined
  const audioPath = audioInput?.audioPath ?? await resolveAudioFromExtractRun(runDir, item)
  if (!await fileExists(audioPath)) {
    throw InfraError(`Audio file not found: ${toProjectDisplayPath(audioPath)}`, { stage: 'video:transcript' })
  }

  if (textFlag) {
    const transcriptPath = resolveUserPath(textFlag)
    if (!await fileExists(transcriptPath)) {
      throw InfraError(`Transcript text file not found: ${toProjectDisplayPath(transcriptPath)}`, { stage: 'video:transcript' })
    }
    const audioDurationSeconds = await getAudioDuration(audioPath).catch(() => undefined)
    const loaded = await loadTranscriptText(transcriptPath, audioDurationSeconds)
    return {
      audioPath,
      ...(audioInput?.audioDisplayPath ? { audioDisplayPath: audioInput.audioDisplayPath } : {}),
      transcription: loaded.transcription,
      title: resolveTitleFromExtractRun(item, audioPath),
      label: baseStem(transcriptPath),
      extractRunDir: runDir,
      ...(audioInput ? { cleanup: audioInput.cleanup } : {})
    }
  }

  const resultPath = resultFlag ? resolveUserPath(resultFlag) : await resolveResultFromExtractRun(runDir, item)
  if (!await fileExists(resultPath)) {
    throw InfraError(`Transcript result file not found: ${toProjectDisplayPath(resultPath)}`, { stage: 'video:transcript' })
  }

  return {
    audioPath,
    ...(audioInput?.audioDisplayPath ? { audioDisplayPath: audioInput.audioDisplayPath } : {}),
    transcription: await loadTranscriptionResultJson(resultPath),
    title: resolveTitleFromExtractRun(item, audioPath),
    label: baseStem(audioPath),
    extractRunDir: runDir,
    ...(audioInput ? { cleanup: audioInput.cleanup } : {})
  }
}

const resolveManualSource = async (flags: Record<string, unknown>): Promise<TranscriptVideoSource> => {
  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const resultFlag = typeof flags['transcript-result'] === 'string' ? flags['transcript-result'] : undefined
  const textFlag = typeof flags['transcript-text'] === 'string' ? flags['transcript-text'] : undefined

  if (!audioFlag) {
    throw CLIUsageError('Manual transcript-video mode requires --audio')
  }
  if ((resultFlag ? 1 : 0) + (textFlag ? 1 : 0) !== 1) {
    throw CLIUsageError('Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text')
  }

  const audioInput = await materializeAudioInput(audioFlag)
  const audioPath = audioInput.audioPath
  if (!await fileExists(audioPath)) {
    throw InfraError(`Audio file not found: ${toProjectDisplayPath(audioPath)}`, { stage: 'video:transcript' })
  }

  if (textFlag) {
    const transcriptPath = resolveUserPath(textFlag)
    if (!await fileExists(transcriptPath)) {
      throw InfraError(`Transcript text file not found: ${toProjectDisplayPath(transcriptPath)}`, { stage: 'video:transcript' })
    }
    const audioDurationSeconds = await getAudioDuration(audioPath).catch(() => undefined)
    const loaded = await loadTranscriptText(transcriptPath, audioDurationSeconds)
    return {
      audioPath,
      ...(audioInput.audioDisplayPath ? { audioDisplayPath: audioInput.audioDisplayPath } : {}),
      transcription: loaded.transcription,
      title: extractTitle(audioPath),
      label: baseStem(transcriptPath),
      cleanup: audioInput.cleanup
    }
  }

  const resultPath = resolveUserPath(resultFlag!)
  if (!await fileExists(resultPath)) {
    throw InfraError(`Transcript result file not found: ${toProjectDisplayPath(resultPath)}`, { stage: 'video:transcript' })
  }

  return {
    audioPath,
    ...(audioInput.audioDisplayPath ? { audioDisplayPath: audioInput.audioDisplayPath } : {}),
    transcription: await loadTranscriptionResultJson(resultPath),
    title: extractTitle(audioPath),
    label: baseStem(audioPath),
    cleanup: audioInput.cleanup
  }
}

const resolveTranscriptVideoSource = async (
  inputPath: string | undefined,
  flags: Record<string, unknown>
): Promise<TranscriptVideoSource> =>
  inputPath
    ? await resolveExtractRunSource(inputPath, flags)
    : await resolveManualSource(flags)

const processTranscriptVideoRun = async (
  source: TranscriptVideoSource,
  options: {
    outputDirAbsolute: string
    outputDirRelative: string
    font: string
    keepTmp: boolean
  }
): Promise<void> => {
  const startedAt = Date.now()
  const tempDir = join(options.outputDirAbsolute, '.transcript-video-tmp')
  const assPath = join(tempDir, 'transcript.ass')
  const renderedVideoPath = join(tempDir, 'out.mp4')
  const videoFileName = `${source.label}.mp4`
  const vttFileName = `${source.label}.vtt`
  const srtFileName = `${source.label}.srt`
  const videoPath = join(options.outputDirAbsolute, videoFileName)
  const imagePath = await findMatchingImage(source.audioPath, dirname(source.audioPath))

  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  try {
    const cueBuildStartedAt = Date.now()
    const built = buildCuesFromTranscriptionResult(source.transcription.result)
    const cues = built.cues
    const cueSource = source.transcription.source === 'transcript-text' ? 'transcript-text' : built.cueSource
    if (cues.length === 0) {
      throw ValidationError('Transcript contained no usable timestamped cues', { stage: 'video:transcript' })
    }
    const cueBuildMs = Date.now() - cueBuildStartedAt

    const captionCues = toCaptionCuesWithSpeakerLabels(cues)
    const captionWriteStartedAt = Date.now()
    await Promise.all([
      Bun.write(join(options.outputDirAbsolute, vttFileName), formatVtt(captionCues)),
      Bun.write(join(options.outputDirAbsolute, srtFileName), formatSrt(captionCues))
    ])
    const captionsWriteMs = Date.now() - captionWriteStartedAt

    await Bun.write(assPath, buildTranscriptAss({
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      font: options.font,
      title: source.title
    }, cues))

    let backgroundRelativePath: string | undefined
    if (imagePath) {
      backgroundRelativePath = `background${extname(imagePath).toLowerCase()}`
      await copyFile(imagePath, join(tempDir, backgroundRelativePath))
    }

    const renderStartedAt = Date.now()
    const renderSummary = await renderLyricsVideo({
      audioPath: source.audioPath,
      assRelativePath: 'transcript.ass',
      outputRelativePath: 'out.mp4',
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      fps: FIXED_RENDER_FPS,
      workingDirectory: tempDir,
      cues: toRenderCues(cues),
      title: source.title,
      font: options.font,
      includeContext: true,
      textLayout: TRANSCRIPT_OVERLAY_TEXT_LAYOUT,
      ...(backgroundRelativePath ? { imageRelativePath: backgroundRelativePath } : {})
    })
    const renderMs = Date.now() - renderStartedAt

    await copyFile(renderedVideoPath, videoPath)

    const totalMs = Date.now() - startedAt
    const manifestMetadata = {
      mode: 'transcript-video',
      source: {
        audioPath: source.audioDisplayPath ?? toProjectDisplayPath(source.audioPath),
        transcriptPath: toProjectDisplayPath(source.transcription.sourcePath),
        transcriptSource: source.transcription.source,
        ...(source.extractRunDir ? { extractRunDir: toProjectDisplayPath(source.extractRunDir) } : {}),
        ...(source.transcription.provider ? { provider: source.transcription.provider } : {}),
        ...(source.transcription.model ? { model: source.transcription.model } : {})
      },
      transcript: {
        cueSource,
        cueCount: cues.length,
        speakerCount: collectSpeakerInventory(cues).length,
        speakers: collectSpeakerInventory(cues)
      },
      render: {
        width: FIXED_RENDER_WIDTH,
        height: FIXED_RENDER_HEIGHT,
        fps: FIXED_RENDER_FPS,
        font: options.font,
        title: source.title,
        encoder: renderSummary.encoder,
        backgroundMode: renderSummary.backgroundMode,
        ...(imagePath ? { backgroundPath: toProjectDisplayPath(imagePath) } : {})
      },
      artifacts: {
        video: videoFileName,
        vtt: vttFileName,
        srt: srtFileName,
        manifest: PIPELINE_MANIFEST_FILE,
        tempDirKept: options.keepTmp
      },
      timing: {
        totalMs,
        cueBuildMs,
        captionsWriteMs,
        renderMs
      }
    }
    await writeManifest(options.outputDirAbsolute, createManifest('video', 'single', [
      createManifestItem(options.outputDirAbsolute, { status: 'full', metadata: manifestMetadata })
    ]))

    l.report.complete(options.outputDirRelative, {
      video: videoFileName,
      vtt: vttFileName,
      srt: srtFileName,
      manifest: PIPELINE_MANIFEST_FILE
    }, {
      metrics: {
        cueCount: cues.length,
        cueSource,
        speakers: collectSpeakerInventory(cues).length,
        background: imagePath ? 'image' : 'spectrogram',
        encoder: renderSummary.encoder
      }
    })
  } finally {
    if (!options.keepTmp) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export const runExtractTranscriptVideo = async (
  inputPath: string | undefined,
  flags: Record<string, unknown>
): Promise<void> => {
  const source = await resolveTranscriptVideoSource(inputPath, flags)
  try {
    const font = typeof flags['font'] === 'string' && flags['font'].trim().length > 0 ? flags['font'] : 'DejaVu Sans'
    const keepTmp = flags['keep-tmp'] === true
    const outputDirRelative = resolveRunDirectory(getOutputRoot(), `transcript-video-${source.label}`, 'transcript-video')
    const outputDirAbsolute = resolve(PROJECT_ROOT, outputDirRelative)
    await ensureDirectory(getOutputRootAbsolute(PROJECT_ROOT))
    await ensureDirectory(outputDirAbsolute)

    await processTranscriptVideoRun(source, {
      outputDirAbsolute,
      outputDirRelative,
      font,
      keepTmp
    })
  } finally {
    await source.cleanup?.()
  }
}
