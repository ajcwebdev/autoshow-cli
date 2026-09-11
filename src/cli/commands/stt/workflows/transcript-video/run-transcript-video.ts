import { copyFileExact } from '~/utils/bun-file-io'
import { writeTranscriptVideoAss, writeTranscriptVideoCaptions, writeTranscriptVideoManifest } from './transcript-video-artifacts'
import { resolveCaptionWordCoverage } from '../captions/caption-word-coverage'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { resolveRunDirectory } from '~/cli/commands/command-shared/run-dir'
import { getOutputRoot, getOutputRootAbsolute } from '~/cli/commands/command-shared/output-root'
import { findMatchingImage, FIXED_RENDER_FPS, FIXED_RENDER_HEIGHT, FIXED_RENDER_WIDTH, renderLyricsVideo, TRANSCRIPT_OVERLAY_TEXT_LAYOUT } from '~/cli/commands/audio/music/lyrics-video/render'
import type { TranscriptVideoSource } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { ValidationError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { resolveTranscriptVideoSource } from './transcript-video-source'
import { toCaptionCuesWithSpeakerLabels, buildCuesFromTranscriptionResult, toRenderCues, collectSpeakerInventory } from './transcript-video-cues'

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
    const coverage = resolveCaptionWordCoverage(source.transcription.result)
    const built = buildCuesFromTranscriptionResult(source.transcription.result)
    const cues = built.cues
    const cueSource = source.transcription.source === 'transcript-text' ? 'transcript-text' : built.cueSource
    if (cues.length === 0) {
      throw ValidationError('Transcript contained no usable timestamped cues', { stage: 'video:transcript' })
    }
    const cueBuildMs = Date.now() - cueBuildStartedAt

    const captionCues = toCaptionCuesWithSpeakerLabels(cues)
    const captionWriteStartedAt = Date.now()
    await writeTranscriptVideoCaptions(options.outputDirAbsolute, { vttFileName, srtFileName }, captionCues)
    const captionsWriteMs = Date.now() - captionWriteStartedAt

    await writeTranscriptVideoAss(assPath, options.font, source.title, cues)

    let backgroundRelativePath: string | undefined
    if (imagePath) {
      backgroundRelativePath = `background${extname(imagePath).toLowerCase()}`
      await copyFileExact(imagePath, join(tempDir, backgroundRelativePath))
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

    await copyFileExact(renderedVideoPath, videoPath)

    const totalMs = Date.now() - startedAt
    await writeTranscriptVideoManifest({
      source, options, coverage, cues, cueSource, renderSummary, imagePath,
      videoFileName, vttFileName, srtFileName,
      timing: { totalMs, cueBuildMs, captionsWriteMs, renderMs }
    })

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
