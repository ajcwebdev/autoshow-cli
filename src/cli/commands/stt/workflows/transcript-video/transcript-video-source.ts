import { isRecord } from '~/utils/rest-client'
import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { getAudioDuration } from '~/cli/commands/stt/stt-utils/audio-splitter'
import { parseStoredTranscriptionResult } from '~/cli/commands/stt/stt-utils/stt-result-artifacts'
import { extractTitle } from '~/cli/commands/audio/music/lyrics-video/render'
import type { LoadedTranscription, PipelineManifestItem, TranscriptCue, TranscriptVideoSource } from '~/types'
import { fileExists } from '~/utils/cli-utils'
import { UsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { materializeMediaInput } from '~/utils/media-url'
import { baseStem, resolveUserPath, toProjectDisplayPath } from '~/utils/runtime-paths'
import { buildCuesFromTranscriptText } from './transcript-video-cues'

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'])

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

  throw UsageError(`Could not infer extract audio file from ${toProjectDisplayPath(runDir)}. Pass --audio explicitly.`)
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
    throw UsageError(`Multiple STT result files found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result to choose one.`)
  }

  throw UsageError(`No STT result.json found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result or --transcript-text explicitly.`)
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
    throw UsageError(`Transcript video input must be a media extract output directory: ${toProjectDisplayPath(runDir)}`)
  }

  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const resultFlag = typeof flags['transcript-result'] === 'string' ? flags['transcript-result'] : undefined
  const textFlag = typeof flags['transcript-text'] === 'string' ? flags['transcript-text'] : undefined
  if (resultFlag && textFlag) {
    throw UsageError('Use only one of --transcript-result or --transcript-text')
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
    throw UsageError('Manual transcript-video mode requires --audio')
  }
  if ((resultFlag ? 1 : 0) + (textFlag ? 1 : 0) !== 1) {
    throw UsageError('Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text')
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

export const resolveTranscriptVideoSource = async (
  inputPath: string | undefined,
  flags: Record<string, unknown>
): Promise<TranscriptVideoSource> =>
  inputPath
    ? await resolveExtractRunSource(inputPath, flags)
    : await resolveManualSource(flags)
