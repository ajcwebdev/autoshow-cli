import { rename } from 'node:fs/promises'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectMusicTargets, getMusicArtifactFileName } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicTargets } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, MUSIC_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildMusicEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import type { EstimateMusicCostOptions, GenerationResumeConfig, MusicGenOptions, MusicTarget, Step7MusicMetadata } from '~/types'

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
    await rename(`${outputDir}/${entry.musicFileName}`, finalPath)
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
    opts: MusicGenOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
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
