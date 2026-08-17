import { ensureDirectory, fileExists, pick } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { processVideo } from './process-video'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { buildMediaStep1Slug, extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { STT_MODEL_KEYS } from '~/cli/options/option-resolution/stt-options'
import { TTS_MODEL_KEYS } from '~/cli/options/option-resolution/tts-options'
import { IMAGE_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { VIDEO_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { MUSIC_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItem, BatchItemProcessResult, BatchRuntimeOptions, DownloadAudioOptions, DownloadRuntimeOptions, MetadataOutputOptions, PipelineItemRecord, ProcessingOptions, ProcessingSource, SharedPipelineOptions, VideoMetadata, WebArticleMetadata, WriteRuntimeOptions } from '~/types'

type DownloadMediaRuntimeOptions = Pick<BatchRuntimeOptions, 'keepOriginalMedia' | 'bestQuality' | 'flatBatch'>
  & DownloadRuntimeOptions
  & Pick<SharedPipelineOptions, 'outputRootDir'>

export const buildProcessingOptions = (
  source: ProcessingSource,
  outputDir: string,
  runtimeOptions: WriteRuntimeOptions
): ProcessingOptions => {
  return {
    ...source,
    concurrencyMode: runtimeOptions.concurrencyMode,
    hostedConcurrencyCoordinator: runtimeOptions.hostedConcurrencyCoordinator,
    configPath: runtimeOptions.configPath,
    step2SelectionOrigins: runtimeOptions.step2SelectionOrigins,
    ...pick(runtimeOptions, STT_MODEL_KEYS),
    youtubeCaptions: runtimeOptions.youtubeCaptions,
    happyscribeOrganizationId: runtimeOptions.happyscribeOrganizationId,
    supadataLang: runtimeOptions.supadataLang,
    scrapecreatorsLang: runtimeOptions.scrapecreatorsLang,
    diarizationSpeakerCount: runtimeOptions.diarizationSpeakerCount,
    split: runtimeOptions.split,
    ...buildLLMModelOptions(resolveLLMDefaults(runtimeOptions)),
    llmProviderConcurrency: runtimeOptions.llmProviderConcurrency,
    llmLocalConcurrency: runtimeOptions.llmLocalConcurrency,
    ttsProviderConcurrency: runtimeOptions.ttsProviderConcurrency,
    ttsLocalConcurrency: runtimeOptions.ttsLocalConcurrency,
    ttsChunkConcurrency: runtimeOptions.ttsChunkConcurrency,
    ...pick(runtimeOptions, TTS_MODEL_KEYS),
    groqVoiceId: runtimeOptions.groqVoiceId,
    grokTtsVoice: runtimeOptions.grokTtsVoice,
    grokTtsLanguage: runtimeOptions.grokTtsLanguage,
    grokTtsTextNormalization: runtimeOptions.grokTtsTextNormalization,
    mistralTtsVoice: runtimeOptions.mistralTtsVoice,
    ttsDialogueFormat: runtimeOptions.ttsDialogueFormat,
    ttsSpeakers: runtimeOptions.ttsSpeakers,
    openaiVoiceId: runtimeOptions.openaiVoiceId,
    openaiTtsInstructions: runtimeOptions.openaiTtsInstructions,
    openaiTtsSpeed: runtimeOptions.openaiTtsSpeed,
    geminiVoiceId: runtimeOptions.geminiVoiceId,
    elevenlabsVoiceId: runtimeOptions.elevenlabsVoiceId,
    elevenlabsTtsLanguageCode: runtimeOptions.elevenlabsTtsLanguageCode,
    elevenlabsTtsStability: runtimeOptions.elevenlabsTtsStability,
    elevenlabsTtsSimilarityBoost: runtimeOptions.elevenlabsTtsSimilarityBoost,
    elevenlabsTtsStyle: runtimeOptions.elevenlabsTtsStyle,
    elevenlabsTtsUseSpeakerBoost: runtimeOptions.elevenlabsTtsUseSpeakerBoost,
    elevenlabsTtsSpeed: runtimeOptions.elevenlabsTtsSpeed,
    elevenlabsTtsSeed: runtimeOptions.elevenlabsTtsSeed,
    elevenlabsTtsTextNormalization: runtimeOptions.elevenlabsTtsTextNormalization,
    elevenlabsTtsPronunciationDictionaryLocators: runtimeOptions.elevenlabsTtsPronunciationDictionaryLocators,
    deepgramVoiceId: runtimeOptions.deepgramVoiceId,
    deepgramTtsSpeed: runtimeOptions.deepgramTtsSpeed,
    minimaxTtsVoice: runtimeOptions.minimaxTtsVoice,
    minimaxTtsLanguageBoost: runtimeOptions.minimaxTtsLanguageBoost,
    minimaxTtsSpeed: runtimeOptions.minimaxTtsSpeed,
    minimaxTtsVolume: runtimeOptions.minimaxTtsVolume,
    minimaxTtsPitch: runtimeOptions.minimaxTtsPitch,
    minimaxTtsEmotion: runtimeOptions.minimaxTtsEmotion,
    minimaxTtsEnglishNormalization: runtimeOptions.minimaxTtsEnglishNormalization,
    minimaxTtsPronunciations: runtimeOptions.minimaxTtsPronunciations,
    speechifyVoice: runtimeOptions.speechifyVoice,
    speechifyTtsLanguage: runtimeOptions.speechifyTtsLanguage,
    humeTtsVoice: runtimeOptions.humeTtsVoice,
    cartesiaTtsVoice: runtimeOptions.cartesiaTtsVoice,
    cartesiaTtsLanguage: runtimeOptions.cartesiaTtsLanguage,
    ...pick(runtimeOptions, IMAGE_PRICING_MODEL_KEYS),
    imageProviderConcurrency: runtimeOptions.imageProviderConcurrency,
    imageLocalConcurrency: runtimeOptions.imageLocalConcurrency,
    imageAspectRatio: runtimeOptions.imageAspectRatio,
    imageSize: runtimeOptions.imageSize,
    imageQuality: runtimeOptions.imageQuality,
    imageFormat: runtimeOptions.imageFormat,
    imageBackground: runtimeOptions.imageBackground,
    imageCount: runtimeOptions.imageCount,
    imageInputs: runtimeOptions.imageInputs,
    imageMask: runtimeOptions.imageMask,
    imageResponseMode: runtimeOptions.imageResponseMode,
    geminiSearchGrounding: runtimeOptions.geminiSearchGrounding,
    imageCompression: runtimeOptions.imageCompression,
    ...pick(runtimeOptions, VIDEO_PRICING_MODEL_KEYS),
    videoProviderConcurrency: runtimeOptions.videoProviderConcurrency,
    videoLocalConcurrency: runtimeOptions.videoLocalConcurrency,
    allVideo: runtimeOptions.allVideo,
    videoDuration: runtimeOptions.videoDuration,
    videoAspectRatio: runtimeOptions.videoAspectRatio,
    videoResolution: runtimeOptions.videoResolution,
    videoMode: runtimeOptions.videoMode,
    videoInputImage: runtimeOptions.videoInputImage,
    videoLastFrame: runtimeOptions.videoLastFrame,
    videoReferenceImages: runtimeOptions.videoReferenceImages,
    videoInputVideo: runtimeOptions.videoInputVideo,
    replicateVideoSeed: runtimeOptions.replicateVideoSeed,
    videoGenerateAudio: runtimeOptions.videoGenerateAudio,
    videoReferenceVideos: runtimeOptions.videoReferenceVideos,
    videoReferenceAudios: runtimeOptions.videoReferenceAudios,
    replicateVideoNegativePrompt: runtimeOptions.replicateVideoNegativePrompt,
    replicateVideoMultiPrompt: runtimeOptions.replicateVideoMultiPrompt,
    replicateVideoMultiClip: runtimeOptions.replicateVideoMultiClip,
    ...pick(runtimeOptions, MUSIC_PRICING_MODEL_KEYS),
    musicProviderConcurrency: runtimeOptions.musicProviderConcurrency,
    musicLocalConcurrency: runtimeOptions.musicLocalConcurrency,
    musicDuration: runtimeOptions.musicDuration,
    musicLyricsFile: runtimeOptions.musicLyricsFile,
    musicInstrumental: runtimeOptions.musicInstrumental,
    skipLLM: runtimeOptions.skipLLM,
    prompts: runtimeOptions.prompts,
    promptFile: runtimeOptions.promptFile,
    renderedText: runtimeOptions.renderedText,
    renderedOutDir: runtimeOptions.renderedOutDir,
    trackList: runtimeOptions.trackList,
    promptMd: runtimeOptions.promptMd,
    outputDir
  }
}

export const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: WriteRuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelURL?: string, publishDate?: string, duration: string } }> => {
  if (llmDefaults.split) {
    l.write('info', 'Audio will be split into 30-minute segments for transcription')
  }

  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)
  const srcUrl = isUrl ? target : exists ? `file://${target}` : target

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = await extractSourceMetadata(src)
  const batchOutputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  })

  const source: ProcessingSource = isUrl
    ? { url: target }
    : exists
      ? { filePath: target }
      : { url: target }
  const options = buildProcessingOptions(source, baseDir, llmDefaults)

  const outDir = await processVideo(options, meta, preflightEstimate, {
    ...(batchOutputDir ? { outputDir: batchOutputDir } : {}),
    outputRootDir: llmDefaults.outputRootDir,
    sttProviderConcurrency: llmDefaults.sttProviderConcurrency,
    sttLocalConcurrency: llmDefaults.sttLocalConcurrency,
    sttSegmentConcurrency: llmDefaults.sttSegmentConcurrency,
  })
  const baseInfo: { url: string, title: string, channel: string, duration: string, channelURL?: string, publishDate?: string } = {
    url: srcUrl,
    title: meta.title,
    channel: meta.channel,
    duration: meta.duration
  }

  if (meta.channelURL) {
    baseInfo.channelURL = meta.channelURL
  }
  if (meta.publishDate) {
    baseInfo.publishDate = meta.publishDate
  }

  return { outputDir: outDir, info: baseInfo }
}

const normalizeBatchItemDuration = (duration?: string): string | undefined => {
  if (!duration || duration.length === 0) {
    return undefined
  }

  if (duration.includes(':')) {
    return duration
  }

  if (!/^\d+$/.test(duration)) {
    return duration
  }

  const totalSeconds = Number.parseInt(duration, 10)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return duration
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const mergeBatchItemMetadata = (
  meta: VideoMetadata,
  batchItem?: BatchItem
): VideoMetadata => {
  if (!batchItem) {
    return meta
  }

  const publishDate = normalizeBatchChildPublishedAt(batchItem.publishedAt)
  const duration = normalizeBatchItemDuration(batchItem.duration)

  return {
    ...meta,
    ...(batchItem.title ? { title: batchItem.title } : {}),
    ...(batchItem.author ? { channel: batchItem.author } : {}),
    ...(duration ? { duration } : {}),
    ...(publishDate ? { publishDate } : {})
  }
}

const hasYtDlpPassthroughArgs = (
  opts: DownloadRuntimeOptions
): opts is DownloadRuntimeOptions & { ytDlpPassthroughArgs: string[] } =>
  Array.isArray(opts.ytDlpPassthroughArgs) && opts.ytDlpPassthroughArgs.length > 0

export const buildDownloadMediaOptions = (
  target: string,
  outputDir: string,
  opts: Pick<DownloadMediaRuntimeOptions, 'keepOriginalMedia' | 'bestQuality' | 'ytDlpPassthroughArgs'>,
  options: {
    isUrl: boolean
    exists: boolean
    batchItem?: BatchItem | undefined
  }
): DownloadAudioOptions => {
  const hasPassthrough = hasYtDlpPassthroughArgs(opts)
  return {
    ...(options.isUrl ? { url: target } : options.exists ? { filePath: target } : { url: target }),
    outputDir,
    ...(!hasPassthrough && options.batchItem?.directDownload ? { directDownload: true } : {}),
    keepOriginalMedia: opts.keepOriginalMedia,
    bestQuality: opts.bestQuality,
    ...(hasPassthrough ? { ytDlpPassthroughArgs: opts.ytDlpPassthroughArgs } : {})
  }
}

const buildDownloadItemRecord = (
  step1Metadata: Record<string, unknown>,
  web?: WebArticleMetadata
): PipelineItemRecord => ({
  step1: step1Metadata,
  ...(web ? { web } : {}),
  cost: {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }
})

export const processMetadataMedia = async (
  target: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'> & MetadataOutputOptions,
  baseDir: string,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) src.url = target
  if (!isUrl && exists) src.filePath = target

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const slug = buildMediaStep1Slug(src, meta)

  const metadata = {
    title: meta.title,
    slug,
    duration: meta.duration,
    channel: meta.channel,
    url: meta.url,
    ...(meta.publishDate ? { publishDate: meta.publishDate } : {}),
    ...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
    ...(meta.channelURL ? { channelURL: meta.channelURL } : {}),
    ...(meta.chapters?.length ? { chapters: meta.chapters } : {}),
    ...(meta.description?.length ? { description: meta.description } : {})
  }

  writeMetadataTerminalOutput(metadata, opts.markdown)

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  }) ?? resolveRunDirectory(effectiveBaseDir, meta.title, 'metadata')
  await ensureDirectory(outputDir)
  await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
  return { outputDir }
}

export const processDownloadMedia = async (
  target: string,
  baseDir: string,
  opts: DownloadMediaRuntimeOptions,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const useFlatBatchOutput = opts.flatBatch && batchChildContext !== undefined
  const outputDir = useFlatBatchOutput
    ? effectiveBaseDir
    : await reserveBatchChildOutputDir(batchChildContext, {
        title: meta.title,
        publishedAt: meta.publishDate,
        fallbackLabel: meta.title
      }) ?? resolveRunDirectory(effectiveBaseDir, meta.title, 'download')
  await ensureDirectory(outputDir)

  const dlOpts = buildDownloadMediaOptions(target, outputDir, opts, { isUrl, exists, batchItem })

  const { metadata: step1Metadata } = await downloadAudio(dlOpts, meta)
  const itemRecord = buildDownloadItemRecord(step1Metadata)

  if (useFlatBatchOutput) {
    l.write('info', `Saved media file: ${step1Metadata.audioFileName}`)
    return { itemRecord }
  }

  await writeManifest(outputDir, createManifest('download', 'single', [
    createPipelineItemFromRecord(outputDir, itemRecord, { status: 'full' })
  ]))

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, manifest: PIPELINE_MANIFEST_FILE })

  return { outputDir }
}
