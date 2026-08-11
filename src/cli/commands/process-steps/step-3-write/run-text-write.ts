import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AggregatedPriceEstimate, BatchChildRunContext, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, StepTimingCost, TranscriptionResult, VideoMetadata, WriteRuntimeOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { runLLM } from './run-llm'
import {
  buildTextInputPrompt,
  formatTextInputRenderedText,
  getTextInputTitle,
  resolveTextInputSongTitle,
  writeRenderedTextArtifacts,
} from './text-input-utils'
import { buildEstimatedTtsTargets, buildTtsArtifactMap } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildImageArtifactMap, getExpectedImageCount } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { buildVideoArtifactMap } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { buildMusicArtifactMap } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runGenerationStagesForSingleWrite } from './generation-stage-runner'
import { buildProviderStepSummaries } from '~/cli/commands/process-steps/generation-command-utils'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { writeShowNoteArtifacts } from './show-note-artifacts'

const buildTextInputMetadata = (inputPath: string): VideoMetadata => {
  const title = getTextInputTitle(inputPath)

  return {
    title,
    duration: 'Unknown',
    channel: 'Local',
    description: '',
    url: pathToFileURL(resolve(inputPath)).toString(),
  }
}

const buildTextTranscription = (text: string): TranscriptionResult => ({
  text,
  segments: [{
    start: '00:00:00',
    end: '00:00:00',
    text
  }]
})

const buildStepSummaries = (
  step3Results: Step3Metadata[],
  step4Metadata: Step4Metadata[] | null,
  step5Metadata: Step5Metadata[] | null,
  step6Metadata: Step6VideoMetadata[] | null,
  step7Metadata: Step7MusicMetadata[] | null,
  actualCosts: ReturnType<typeof computeActualCosts>['steps']
): StepTimingCost[] => {
  const summaries: StepTimingCost[] = []

  summaries.push(...buildProviderStepSummaries(
    'LLM',
    'llm',
    step3Results,
    actualCosts,
    (entry) => `${entry.llmService}/${entry.llmModel}`,
    (entry) => entry.processingTime
  ))

  if (step4Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'TTS',
      'tts',
      step4Metadata,
      actualCosts,
      (entry) => `${entry.ttsService}/${entry.ttsModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step5Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Image',
      'image',
      step5Metadata,
      actualCosts,
      (entry) => `${entry.imageService}/${entry.imageModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step6Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Video',
      'video',
      step6Metadata,
      actualCosts,
      (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step7Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Music',
      'music',
      step7Metadata,
      actualCosts,
      (entry) => `${entry.musicService}/${entry.musicModel}`,
      (entry) => entry.processingTime
    ))
  }

  return summaries
}

export const runTextWrite = async (
  inputPath: string,
  baseDir: string,
  opts: WriteRuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const sourceText = await Bun.file(inputPath).text()
  if (sourceText.trim().length === 0) {
    throw ValidationError(`Text input is empty: ${inputPath}`, { stage: 'write:text' })
  }

  const title = getTextInputTitle(inputPath)
  const songLyricsTitle = await resolveTextInputSongTitle(inputPath, opts.trackList)
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title,
    fallbackLabel: title
  }) ?? resolveRunDirectory(outputBaseDir, title, 'write-text')
  await ensureDirectory(outputDir)

  const llmConfig = resolveLLMDefaults(opts)
  const metadata = buildTextInputMetadata(inputPath)
  const transcriptionLike = buildTextTranscription(sourceText)

  const step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
    await runLLM(metadata, transcriptionLike, {
      outputDir,
      prompts: opts.prompts,
      promptFile: opts.promptFile,
      ...buildLLMModelOptions(llmConfig),
      llmProviderConcurrency: opts.llmProviderConcurrency,
      llmLocalConcurrency: opts.llmLocalConcurrency,
      structuredContext: {
        songLyricsTitle
      },
      promptBuilder: (instruction: string) =>
        buildTextInputPrompt(sourceText, {
          title,
          sourcePath: inputPath,
          instruction
        })
    })
  )

  const step3Results = step3RunResults.map((result) => result.metadata)
  if (step3Results.length === 0) {
    throw InfraError('No LLM outputs generated for text input write', { stage: 'write:text' })
  }

  const renderedArtifacts = await writeRenderedTextArtifacts({
    outputDir,
    results: step3RunResults,
    writeInternal: opts.renderedText,
    sourcePath: inputPath,
    trackListPath: opts.trackList,
    externalDir: opts.renderedOutDir,
    externalBaseName: title
  })

  if (renderedArtifacts.externalFiles.length > 0) {
    logLocationsTable(l, [{
      artifact: 'renderedOutDir',
      path: opts.renderedOutDir,
      detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
    }])
  }

  const generationResult = await runGenerationStagesForSingleWrite({
    step3Results,
    step3RunResults,
    outputDir,
    generationOptions: opts
  })
  const {
    step4Metadata,
    step5Metadata,
    step6Metadata,
    step7Metadata,
    ttsCharacterCount,
    ttsInputText,
    attemptedTtsTargets,
    attemptedImageTargets,
    attemptedVideoTargets,
    attemptedMusicTargets
  } = generationResult

  const showNoteRunResults = await Promise.all(step3RunResults.map(async (result) => ({
    ...result,
    renderedText: await formatTextInputRenderedText({
      content: result.renderedText,
      sourcePath: inputPath,
      trackListPath: opts.trackList,
      metadata: result.metadata
    })
  })))

  const showNoteArtifacts = await writeShowNoteArtifacts({
    outputDir,
    results: showNoteRunResults,
    sourceText,
    step4Metadata,
    step5Metadata,
    step6Metadata,
    step7Metadata
  })

  const step3Serialized = step3Results.length === 1
    ? step3Results[0]
    : step3Results

  const llmTargets = step3Results.map((item) => ({
    service: item.llmService,
    model: item.llmModel,
    inputTokens: item.inputTokenCount,
    outputTokens: item.outputTokenCount
  }))

  const ttsEstimateTargets = buildEstimatedTtsTargets(attemptedTtsTargets)
  const imageEstimateTargets = attemptedImageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, opts)
  }))

  const priceEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate('write', inputPath, opts)
  const estimated = preflightToEstimated(priceEstimate)

  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    llmTargets,
    skipLLM: false,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    imageTargets: imageEstimateTargets,
    imageSize: opts.imageSize,
    imageQuality: opts.imageQuality,
    videoTargets: attemptedVideoTargets.map((target) => ({
      service: target.service,
      model: target.model,
      ...(opts.videoDuration !== undefined ? { durationSeconds: opts.videoDuration } : {})
    })),
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoAspectRatio: opts.videoAspectRatio,
    videoResolution: opts.videoResolution,
    videoMode: opts.videoMode,
    musicTargets: attemptedMusicTargets.map((entry) => ({
      service: entry.service,
      model: entry.model,
      ...(opts.musicDuration !== undefined ? { durationSeconds: opts.musicDuration } : {})
    })),
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  const actual = computeActualCosts({
    step3: step3Serialized,
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })

  const cost = { estimated, observedEstimate, actual }
  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    llmTargets,
    skipLLM: false,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    ...(ttsInputText !== undefined ? { ttsInputText } : {}),
    ttsChunkConcurrency: opts.ttsChunkConcurrency,
    ...(imageEstimateTargets.length > 0 ? { imageTargets: imageEstimateTargets } : {}),
    ...(attemptedVideoTargets.length > 0
      ? {
          videoTargets: attemptedVideoTargets.map((entry) => ({
            service: entry.service,
            model: entry.model,
            ...(opts.videoDuration !== undefined ? { durationSeconds: opts.videoDuration } : {})
          })),
          ...(opts.videoSize !== undefined ? { videoSize: opts.videoSize } : {}),
          ...(opts.videoAspectRatio !== undefined ? { videoAspectRatio: opts.videoAspectRatio } : {}),
          ...(opts.videoResolution !== undefined ? { videoResolution: opts.videoResolution } : {}),
          ...(opts.videoMode !== undefined ? { videoMode: opts.videoMode } : {})
        }
      : {}),
    ...(attemptedMusicTargets.length > 0
      ? {
          musicTargets: attemptedMusicTargets.map((entry) => ({
            service: entry.service,
            model: entry.model,
            ...(opts.musicDuration !== undefined ? { durationSeconds: opts.musicDuration } : {})
          }))
        }
      : {})
  })
  const estimatedTiming = priceEstimate.timing ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({
    step3: step3Serialized,
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const manifestMetadata = {
    title,
    source: {
      kind: 'text-input',
      inputPath,
      slug: sanitizeTitleSlug(title, 180)
    },
    step3: serializeOneOrMany(step3Results),
    ...(step4Metadata ? { step4: serializeOneOrMany(step4Metadata) } : {}),
    ...(step5Metadata ? { step5: serializeOneOrMany(step5Metadata) } : {}),
    ...(step6Metadata ? { step6: serializeOneOrMany(step6Metadata) } : {}),
    ...(step7Metadata ? { step7: serializeOneOrMany(step7Metadata) } : {}),
    cost,
    ...(timing ? { timing } : {}),
  }

  await writeManifest(outputDir, createManifest('write', 'single', [
    createPipelineItemFromRecord(outputDir, manifestMetadata, { status: 'full' })
  ]))
  logWriteManifestConsoleSummary(outputDir, manifestMetadata, {
    promptArtifact: 'prompt.md',
    ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
      ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
      : {})
  })

  const totalTimeMs = actualTiming.totalProcessingTimeMs
  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    manifest: PIPELINE_MANIFEST_FILE,
    ...renderedArtifacts.internalArtifacts,
    ...showNoteArtifacts.internalArtifacts
  }

  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else {
    for (const step3 of step3Results) {
      const summaryKey = step3.outputFileName.replace(/\.json$/u, '').replace(/^text-/u, 'summary-')
      artifactFiles[summaryKey] = step3.outputFileName
    }
  }
  if (step4Metadata) {
    Object.assign(artifactFiles, buildTtsArtifactMap(step4Metadata))
  }
  if (step5Metadata) {
    Object.assign(artifactFiles, buildImageArtifactMap(step5Metadata))
  }
  if (step6Metadata) {
    Object.assign(artifactFiles, buildVideoArtifactMap(step6Metadata))
  }
  if (step7Metadata) {
    Object.assign(artifactFiles, buildMusicArtifactMap(step7Metadata))
  }

  l.report.complete(outputDir, artifactFiles, {
    steps: buildStepSummaries(step3Results, step4Metadata, step5Metadata, step6Metadata, step7Metadata, actual.steps),
    totalTimeMs,
    totalCost: actual.totalCost
  })

  return { outputDir }
}
