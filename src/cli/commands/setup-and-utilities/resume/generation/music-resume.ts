import { rename } from 'node:fs/promises'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectMusicTargets, getMusicArtifactFileName } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicTargets } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildMusicEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { GenerationResumeConfig, MusicTarget, RuntimeOptions, Step7MusicMetadata } from '~/types'

const MUSIC_PROVIDER_FLAGS = [
  'all-music',
  'elevenlabs-music',
  'minimax-music',
  'gemini-music'
] as const

const MUSIC_MODEL_FIELDS = {
  elevenlabs: ['elevenlabsMusicModels', 'elevenlabsMusicModel'],
  minimax: ['minimaxMusicModels', 'minimaxMusicModel'],
  gemini: ['geminiMusicModels', 'geminiMusicModel']
} as const

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
  providerFlags: MUSIC_PROVIDER_FLAGS,
  modelFields: MUSIC_MODEL_FIELDS,
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: RuntimeOptions) => collectMusicTargets(opts),
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
    return await finalizeMusicResumeArtifacts(metadata, outputDir)
  },
  buildEstimates: async (opts: RuntimeOptions) => await buildMusicEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step7MusicMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step7: metadata }),
    computeActualProcessingTimes({ step7: metadata })
  )
} satisfies GenerationResumeConfig<MusicTarget, Step7MusicMetadata>
