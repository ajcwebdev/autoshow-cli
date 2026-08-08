import { rename } from 'node:fs/promises'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildGenerationPriceOptions, buildUpdatedGenerationCostTiming, collectGenerationTargetsForProviders, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectMusicTargets, getMusicArtifactFileName } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicTargets } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildMusicEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { AggregatedPriceEstimate, MusicTarget, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step7MusicMetadata } from '~/types'

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

const collectMusicTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): MusicTarget[] =>
  collectGenerationTargetsForProviders(providers, opts, MUSIC_MODEL_FIELDS, collectMusicTargets)

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

const priceMusicTargets = async (
  targets: MusicTarget[],
  _input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildGenerationPriceOptions(targets, opts, MUSIC_MODEL_FIELDS)
  return aggregateExplicitPriceEstimate(await buildMusicEstimates(priceOpts), priceOpts)
}

const musicResumeConfig = {
  kind: 'music' as const,
  metadataKey: 'music',
  stepLabel: 'Music',
  providerFlags: MUSIC_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: RuntimeOptions) => collectMusicTargets(opts),
  collectTargetsForProviders: collectMusicTargetsForProviders,
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
    return await finalizeMusicResumeArtifacts(metadata, outputDir)
  },
  priceTargets: priceMusicTargets,
  rebuildRunMetadata: (
    metadata: Step7MusicMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step7: metadata }),
    computeActualProcessingTimes({ step7: metadata })
  )
}

export const hasResumableMusicWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, musicResumeConfig, opts, explicitFlags)

export const resumeMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> =>
  await resumeGenerationTarget(target, musicResumeConfig, opts, explicitFlags, displayOptions)

export const priceMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(target, musicResumeConfig, opts, explicitFlags)
