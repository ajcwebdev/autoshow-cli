import { ProcessingOptionsSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { processVideo } from './process-video'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { buildMediaStep1Slug, extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { buildLLMModelOptions, resolveLLMDefaults } from '../options/model-option-llm-defaults'
import { writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItem, BatchItemProcessResult, DownloadAudioOptions, ProcessingOptions, RuntimeOptions, VideoMetadata, WebArticleMetadata } from '~/types'

type ProcessingOptionSourceKey = keyof RuntimeOptions & keyof ProcessingOptions
type ProcessingSpecialKey = 'url' | 'filePath' | 'outputDir' | 'directDownload' | keyof ReturnType<typeof buildLLMModelOptions>

const PROCESSING_FORWARD_KEYS = [
  'configPath', 'whisperModels', 'whisperModel',
  'whisperfileModels', 'whisperfileModel', 'youtubeCaptions',
  'deepinfraSttModels', 'deepinfraSttModel', 'groqSttModels',
  'groqSttModel', 'grokSttModels', 'grokSttModel',
  'deepgramSttModels', 'deepgramSttModel', 'sonioxSttModels',
  'sonioxSttModel', 'speechmaticsSttModels', 'speechmaticsSttModel',
  'revSttModels', 'revSttModel', 'mistralSttModels',
  'mistralSttModel', 'assemblyaiSttModels', 'assemblyaiSttModel',
  'gladiaSttModels', 'gladiaSttModel', 'happyscribeSttModels',
  'happyscribeSttModel', 'happyscribeOrganizationId', 'supadataSttModels',
  'supadataSttModel', 'scrapecreatorsSttModels', 'scrapecreatorsSttModel',
  'geminiSttModels', 'geminiSttModel', 'togetherSttModels',
  'togetherSttModel', 'supadataLang', 'scrapecreatorsLang',
  'diarizationSpeakerCount', 'llmProviderConcurrency', 'llmLocalConcurrency',
  'ttsProviderConcurrency', 'ttsLocalConcurrency', 'ttsChunkConcurrency',
  'imageProviderConcurrency', 'imageLocalConcurrency', 'videoProviderConcurrency',
  'videoLocalConcurrency', 'musicProviderConcurrency', 'musicLocalConcurrency',
  'useReverb', 'reverbVerbatimicity', 'split',
  'skipLLM', 'prompts', 'promptFile',
  'renderedText', 'renderedOutDir', 'trackList',
  'promptMd', 'ttsSpeaker', 'kittenTtsModels',
  'kittenTtsModel', 'groqTtsModels', 'groqTtsModel',
  'groqVoiceId', 'grokTtsModels', 'grokTtsModel',
  'grokTtsVoice', 'grokTtsLanguage', 'grokTtsTextNormalization',
  'mistralTtsModels', 'mistralTtsModel', 'mistralTtsVoice',
  'mistralTtsRefAudio', 'mistralTtsVoiceName', 'ttsDialogueFormat',
  'ttsSpeakers', 'openaiTtsModels', 'openaiTtsModel',
  'openaiVoiceId', 'openaiTtsInstructions', 'openaiTtsSpeed',
  'geminiTtsModels', 'geminiTtsModel', 'geminiVoiceId',
  'elevenlabsTtsModels', 'elevenlabsTtsModel', 'elevenlabsVoiceId',
  'elevenlabsTtsRefAudio', 'elevenlabsTtsVoiceName', 'elevenlabsTtsCloneRemoveBackgroundNoise',
  'elevenlabsTtsOutputFormat', 'elevenlabsTtsLanguageCode', 'elevenlabsTtsStability',
  'elevenlabsTtsSimilarityBoost', 'elevenlabsTtsStyle', 'elevenlabsTtsUseSpeakerBoost',
  'elevenlabsTtsSpeed', 'elevenlabsTtsSeed', 'elevenlabsTtsTextNormalization',
  'elevenlabsTtsPronunciationDictionaryLocators', 'elevenlabsTtsOptimizeStreamingLatency', 'minimaxTtsModels',
  'minimaxTtsModel', 'minimaxTtsVoice', 'minimaxTtsLanguageBoost',
  'minimaxTtsSpeed', 'minimaxTtsVolume', 'minimaxTtsPitch',
  'minimaxTtsEmotion', 'minimaxTtsEnglishNormalization', 'minimaxTtsPronunciations',
  'deepgramTtsModels', 'deepgramTtsModel', 'deepgramVoiceId',
  'deepgramTtsEncoding', 'deepgramTtsContainer', 'deepgramTtsBitRate',
  'deepgramTtsSampleRate', 'deepgramTtsSpeed', 'speechifyTtsModels',
  'speechifyTtsModel', 'speechifyVoice', 'speechifyTtsAudioFormat',
  'speechifyTtsLanguage', 'speechifyTtsRefAudio', 'speechifyTtsVoiceName',
  'speechifyTtsConsentName', 'speechifyTtsConsentEmail', 'speechifyTtsVoiceLocale',
  'speechifyTtsVoiceGender', 'humeTtsModels', 'humeTtsModel',
  'humeTtsVoice', 'humeTtsVoiceProvider', 'cartesiaTtsModels',
  'cartesiaTtsModel', 'cartesiaTtsVoice', 'cartesiaTtsLanguage',
  'geminiImageModels', 'geminiImageModel', 'openaiImageModels',
  'openaiImageModel', 'grokImageModels', 'grokImageModel',
  'bflImageModels', 'bflImageModel', 'recraftImageModels',
  'recraftImageModel', 'replicateImageModels', 'replicateImageModel',
  'lumalabsImageModels', 'lumalabsImageModel', 'falImageModels',
  'falImageModel', 'imageAspectRatio', 'imageSize',
  'imageQuality', 'imageFormat', 'imageBackground',
  'imageCount', 'imageInputs', 'imageMask',
  'imageResponseMode', 'geminiSearchGrounding', 'imageCompression',
  'elevenlabsMusicModels', 'elevenlabsMusicModel', 'minimaxMusicModels',
  'minimaxMusicModel', 'geminiMusicModels', 'geminiMusicModel',
  'musicDuration', 'musicLyricsFile', 'musicInstrumental',
  'geminiVideoModels', 'geminiVideoModel', 'minimaxVideoModels',
  'minimaxVideoModel', 'glmVideoModels', 'glmVideoModel',
  'grokVideoModels', 'grokVideoModel', 'runwayVideoModels',
  'runwayVideoModel', 'ltxVideoModels', 'ltxVideoModel',
  'replicateVideoModels', 'replicateVideoModel', 'lumalabsVideoModels',
  'lumalabsVideoModel', 'falVideoModels', 'falVideoModel',
  'allVideo', 'videoDuration', 'videoSize',
  'videoAspectRatio', 'videoResolution', 'videoMode',
  'videoInputImage', 'videoLastFrame', 'videoReferenceImages',
  'videoInputVideo', 'replicateVideoSeed', 'replicateVideoGenerateAudio',
  'replicateVideoReferenceVideos', 'replicateVideoReferenceAudios', 'replicateVideoNegativePrompt',
  'replicateVideoAudio', 'replicateVideoPromptExpansion', 'replicateVideoMultiPrompt',
  'replicateVideoMultiClip', 'falVideoGenerateAudio', 'falVideoReferenceVideos',
  'falVideoReferenceAudios', 'grokVideoStorageFilename', 'grokVideoStorageExpiresAfter',
] as const satisfies readonly ProcessingOptionSourceKey[]

type ProcessingForwardKey = typeof PROCESSING_FORWARD_KEYS[number]
type MissingProcessingForwardKey = Exclude<keyof ProcessingOptions, ProcessingForwardKey | ProcessingSpecialKey>

const pickProcessingForwardOptions = (
  options: RuntimeOptions,
  keys: MissingProcessingForwardKey extends never ? typeof PROCESSING_FORWARD_KEYS : never = PROCESSING_FORWARD_KEYS
): Pick<RuntimeOptions, ProcessingForwardKey> =>
  Object.fromEntries(keys.map(key => [key, options[key]])) as Pick<RuntimeOptions, ProcessingForwardKey>

export const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelURL?: string, publishDate?: string, duration: string } }> => {
  const llmConfig = resolveLLMDefaults(llmDefaults)

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

  const baseOptions: Record<string, unknown> = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    ...pickProcessingForwardOptions(llmDefaults),
    ...buildLLMModelOptions(llmConfig),
    outputDir: baseDir
  }

  const options: ProcessingOptions = validateData(ProcessingOptionsSchema, baseOptions, 'processing options')

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
  opts: Pick<RuntimeOptions, 'ytDlpPassthroughArgs'>
): opts is Pick<RuntimeOptions, 'ytDlpPassthroughArgs'> & { ytDlpPassthroughArgs: string[] } =>
  Array.isArray(opts.ytDlpPassthroughArgs) && opts.ytDlpPassthroughArgs.length > 0

export const buildDownloadMediaOptions = (
  target: string,
  outputDir: string,
  opts: Pick<RuntimeOptions, 'keepOriginalMedia' | 'bestQuality' | 'ytDlpPassthroughArgs'>,
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

const buildDownloadManifestEntry = (
  step1Metadata: Record<string, unknown>,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  step1: step1Metadata,
  ...(web ? { web } : {}),
  cost: {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }
})

export const processMetadataMedia = async (
  target: string,
  opts: RuntimeOptions,
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
  opts: RuntimeOptions,
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
  const manifestEntry = buildDownloadManifestEntry(step1Metadata)

  if (useFlatBatchOutput) {
    l.write('info', `Saved media file: ${step1Metadata.audioFileName}`)
    return { manifestEntry }
  }

  await writeRunManifest(outputDir, 'download', manifestEntry)

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, run: 'run.json' })

  return { outputDir }
}
