import type { CaptionCue, TranscriptCue, TranscriptCueSource, TranscriptVideoSource } from '~/types'
import { join } from 'node:path'
import type { resolveCaptionWordCoverage } from '../captions/caption-word-coverage'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { formatSrt, formatVtt } from '~/cli/commands/audio/music/lyrics-video/captions'
import { buildTranscriptAss, FIXED_RENDER_FPS, FIXED_RENDER_HEIGHT, FIXED_RENDER_WIDTH } from '~/cli/commands/audio/music/lyrics-video/render'
import type { renderLyricsVideo } from '~/cli/commands/audio/music/lyrics-video/render'
import { toProjectDisplayPath } from '~/utils/runtime-paths'
import { collectSpeakerInventory } from './transcript-video-cues'

export const writeTranscriptVideoCaptions = async (
  outputDir: string,
  files: { vttFileName: string, srtFileName: string },
  captionCues: CaptionCue[]
): Promise<void> => {
  await Promise.all([
    Bun.write(join(outputDir, files.vttFileName), formatVtt(captionCues)),
    Bun.write(join(outputDir, files.srtFileName), formatSrt(captionCues))
  ])
}

export const writeTranscriptVideoAss = async (assPath: string, font: string, title: string, cues: TranscriptCue[]): Promise<void> => {
  await Bun.write(assPath, buildTranscriptAss({ width: FIXED_RENDER_WIDTH, height: FIXED_RENDER_HEIGHT, font, title }, cues))
}

export type TranscriptVideoArtifactContext = {
  source: TranscriptVideoSource
  options: { outputDirAbsolute: string, font: string, keepTmp: boolean }
  coverage: ReturnType<typeof resolveCaptionWordCoverage>
  cues: TranscriptCue[]
  cueSource: TranscriptCueSource
  renderSummary: Awaited<ReturnType<typeof renderLyricsVideo>>
  imagePath: string | undefined
  videoFileName: string
  vttFileName: string
  srtFileName: string
  timing: { totalMs: number, cueBuildMs: number, captionsWriteMs: number, renderMs: number }
}

const buildTranscriptVideoMetadata = ({
  source, options, coverage, cues, cueSource, renderSummary, imagePath,
  videoFileName, vttFileName, srtFileName, timing
}: TranscriptVideoArtifactContext) => {
  return {
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
      timingQuality: source.transcription.result.evidence?.timingQuality === 'generated' ? 'generated' : coverage.inferredWords > 0 ? 'mixed' : source.transcription.result.evidence?.timingQuality ?? 'coarse',
      inferredWordCount: coverage.inferredWords,
      invalidWordCount: coverage.invalidWords,
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
    timing
  }
}

export const writeTranscriptVideoManifest = async (context: TranscriptVideoArtifactContext): Promise<void> => {
  const directory = context.options.outputDirAbsolute
  await writeManifest(directory, createManifest('video', 'single', [
    createManifestItem(directory, { status: 'full', metadata: buildTranscriptVideoMetadata(context) })
  ]))
}
