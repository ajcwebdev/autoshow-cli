import { buildTtsArtifactMap } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildImageArtifactMap } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { buildVideoArtifactMap } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { buildMusicArtifactMap } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import type { BuildWriteArtifactFilesContext } from '~/types'

export const buildWriteArtifactFiles = (ctx: BuildWriteArtifactFilesContext): Record<string, string> => {
  const { step1Metadata, renderedInternalArtifacts, showNoteInternalArtifacts, step2Entries, successfulSttProviders, step3Results, step4Metadata, step5Metadata, step6Metadata, step7Metadata } = ctx

  const artifactFiles: Record<string, string> = {
    audio: step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    result: 'result.json',
    ...renderedInternalArtifacts,
    ...showNoteInternalArtifacts
  }
  if (step2Entries.some((entry) => entry.transcriptionService === YOUTUBE_CAPTIONS_SERVICE)) {
    artifactFiles['captions'] = 'youtube-captions.vtt'
    artifactFiles['captionMetadata'] = 'youtube-captions.json'
  }
  if (successfulSttProviders.length > 1) {
    for (const provider of successfulSttProviders) {
      if (!provider.relativeDir) {
        continue
      }
      const key = `${provider.metadata.transcriptionService}-${provider.metadata.transcriptionModel}`
      artifactFiles[`transcript-${key}`] = `${provider.relativeDir}/transcription.txt`
      artifactFiles[`result-${key}`] = `${provider.relativeDir}/result.json`
    }
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else if (step3Results.length > 1) {
    for (const r of step3Results) {
      const summaryKey = r.outputFileName.replace(/\.json$/u, '').replace(/^text-/u, 'summary-')
      artifactFiles[summaryKey] = r.outputFileName
    }
  }
  if (step4Metadata) {
    Object.assign(artifactFiles, buildTtsArtifactMap(step4Metadata))
  }
  if (step5Metadata) {
    Object.assign(artifactFiles, buildImageArtifactMap(step5Metadata))
  }
  if (step6Metadata) Object.assign(artifactFiles, buildVideoArtifactMap(step6Metadata))
  if (step7Metadata) Object.assign(artifactFiles, buildMusicArtifactMap(step7Metadata))
  artifactFiles['prompt'] = 'prompt.md'
  artifactFiles['manifest'] = 'manifest.json'

  return artifactFiles
}
