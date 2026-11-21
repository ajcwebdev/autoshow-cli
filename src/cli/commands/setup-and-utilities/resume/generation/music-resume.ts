import { unlink } from 'node:fs/promises'
import { publishMediaResumeFile } from '~/cli/commands/command-shared/media-resume-artifacts'
import { getGenerationTargetKey } from '~/cli/commands/command-shared/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectMusicTargets, getMusicArtifactFileName } from '~/cli/commands/audio/music/music-targets'
import { runMusicTargets } from '~/cli/commands/audio/music/run-music-gen'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, MUSIC_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildMusicEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import type { EstimateMusicCostOptions, GenerationResumeConfig, GenerationResumeRunContext, MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'

const recordedMusicFiles = (entry: Step7MusicMetadata): string[] => {
  const names = [entry.musicFileName]
  // Single-target providers historically kept the original lyric/part files beside their qualified copies.
  if (entry.generatedTextFileName) names.push(entry.generatedTextFileName, 'generated-music.txt')
  for (const [index, name] of (entry.additionalAudioFileNames ?? []).entries()) {
    names.push(name, `generated-music-part-${index + 2}.mp3`)
  }
  return names
}

export const finalizeMusicResumeArtifacts = async (
  metadata: Step7MusicMetadata[],
  outputDir: string
): Promise<Step7MusicMetadata[]> =>
  await Promise.all(metadata.map(async (entry) => {
    const finalFileName = getMusicArtifactFileName({
      service: entry.musicService,
      model: entry.musicModel
    }, false)
    if (entry.musicFileName === finalFileName) {
      return entry
    }

    const finalPath = `${outputDir}/${finalFileName}`
    const sourcePath = `${outputDir}/${entry.musicFileName}`
    await publishMediaResumeFile(sourcePath, finalPath)
    await unlink(sourcePath)
    return {
      ...entry,
      musicFileName: finalFileName,
      musicFileSize: Bun.file(finalPath).size
    }
  }))

export const musicResumeConfig = {
  kind: 'music' as const,
  metadataKey: 'music',
  stepLabel: 'Music',
  providerFlags: deriveGenerationResumeProviderFlags(MUSIC_GENERATION_SELECTION, 'all-music'),
  selectionMode: 'additive-stored' as const,
  modelFields: deriveGenerationResumeModelFields(MUSIC_GENERATION_SELECTION),
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: MusicGenOptions) => collectMusicTargets(opts),
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: MusicGenOptions,
    context: GenerationResumeRunContext<MusicTarget, Step7MusicMetadata, MusicGenOptions>
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, {
      ...opts,
      mediaResume: {
        recordedFileNames: context.existingEntries.flatMap(recordedMusicFiles),
        useProviderNames: true
      }
    })
    return await finalizeMusicResumeArtifacts(metadata, outputDir)
  },
  buildEstimates: async (opts: EstimateMusicCostOptions) => await buildMusicEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step7MusicMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step7: metadata }),
    computeActualProcessingTimes({ step7: metadata })
  )
} satisfies GenerationResumeConfig<MusicTarget, Step7MusicMetadata, MusicGenOptions>
