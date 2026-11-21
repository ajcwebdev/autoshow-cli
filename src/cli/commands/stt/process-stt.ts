import { basename, resolve } from 'node:path'
import type { AggregatedPriceEstimate, PreparedSttMedia, ProcessSttRunOptions, Step1Metadata, SttExtractionOptions, SttTarget } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { statPath } from '~/utils/bun-file-io'
import { readSinglePipelineItemRecord } from '../command-shared/pipeline-manifest'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '../command-shared/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/command-shared/run-dir'
import { collectSttTargetsForSource, getSttTargetKey } from './stt-targets'
import { prepareSttMedia, resolveSttSourceMetadata } from './media'
import { createMistralSttPassController } from './diarization/stt-mistral/mistral-stt-pass-controller'
import { logSttAcquireSummary } from './stt-logging'
import { logSpeakerCountHintSummary } from './stt-provider-pool'
import { completeYoutubeCaptionStt } from '~/cli/commands/text/url/url-services/youtube-captions/youtube-caption-completion'
import { completeSingleProviderStt } from './process-stt/single-provider-completion'
import { runMultiProviderSttBatch } from './process-stt/multi-provider-batch'

// A resume that keeps at least one stored successful provider must not re-derive the canonical source
// record: its step1 (title, duration, audio path, size) is what every stored cost, timing and transcript
// was computed against. The stored step1 is reused only while its audio still exists at the recorded
// path (inside the run or a catalogued relative path such as ../../sources/x.mp3) with the recorded size;
// otherwise the source is acquired and step1 re-derived as for a fresh run.
const readReusableStoredStep1 = async (
  outputDir: string,
  requestedTargets: readonly SttTarget[],
  targetsToRunKeys: ReadonlySet<string>
): Promise<{ step1: Step1Metadata, audioPath: string } | undefined> => {
  const record = await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'media' }).catch(() => undefined)
  if (!isRecord(record) || !isRecord(record['step1'])) return undefined
  const keptKeys = new Set(requestedTargets.map(getSttTargetKey).filter((key) => !targetsToRunKeys.has(key)))
  const storedStates = Array.isArray(record['providerStates']) ? record['providerStates'].filter(isRecord) : []
  if (!storedStates.some((state) => state['status'] === 'succeeded' && keptKeys.has(`${String(state['service'])}:${String(state['model'])}`))) {
    return undefined
  }
  const step1 = record['step1']
  if (
    typeof step1['audioFileName'] !== 'string'
    || typeof step1['slug'] !== 'string'
    || typeof step1['audioFileSize'] !== 'number'
    || typeof step1['durationSeconds'] !== 'number'
    || !(step1['durationSeconds'] > 0)
  ) {
    return undefined
  }
  const audioPath = resolve(outputDir, step1['audioFileName'])
  const stats = await statPath(audioPath).catch(() => undefined)
  if (!stats?.isFile() || stats.size !== step1['audioFileSize']) return undefined
  return { step1: step1 as Step1Metadata, audioPath }
}

const withStoredStep1 = (prepared: PreparedSttMedia, stored: { step1: Step1Metadata, audioPath: string }): PreparedSttMedia => {
  const { slug: _slug, audioFileName: _audioFileName, audioFileSize: _audioFileSize, durationSeconds: _durationSeconds, mediaFileName: _mediaFileName, mediaFileSize: _mediaFileSize, mediaKind: _mediaKind, ...metadata } = stored.step1
  return {
    ...prepared,
    metadata: { ...prepared.metadata, ...metadata },
    step1Metadata: stored.step1,
    durationSeconds: stored.step1.durationSeconds as number,
    outputArtifacts: { sourceMediaPath: stored.audioPath }
  }
}

export const processStt = async (
  source: { url?: string, filePath?: string },
  baseDir: string,
  options: SttExtractionOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions: ProcessSttRunOptions = {}
): Promise<string> => {
  if (options.captionExportFlags) options = { ...options, captionExportFlags: { ...options.captionExportFlags, 'caption-video-source': source.filePath } }
  const processStart = Date.now()
  const requestedTargets = runOptions.requestedTargets ?? collectSttTargetsForSource(options, source)
  const mistralPassController = runOptions.mistralPassController
    ?? (requestedTargets.some((target) => target.service === 'mistral')
      ? createMistralSttPassController()
      : undefined)
  const targetsToRun = runOptions.targetsToRun ?? requestedTargets
  const targetsToRunKeys = new Set(targetsToRun.map((target) => getSttTargetKey(target)))
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : options.outputRootDir
  const outputDir = runOptions.outputDir ?? await (async () => {
    // Source metadata only names a new run directory; a resumed run already has one.
    const metadata = await resolveSttSourceMetadata(source)
    return await reserveBatchChildOutputDir(runOptions.batchChildContext, {
      title: metadata.title,
      publishedAt: metadata.publishDate,
      fallbackLabel: metadata.title
    }) ?? resolveRunDirectory(outputBaseDir, metadata.title, 'extract')
  })()
  await ensureDirectory(outputDir)

  let prepared: Awaited<ReturnType<typeof prepareSttMedia>> | undefined

  try {
    const acquisitionStartedAt = Date.now()
    const storedStep1 = runOptions.outputDir ? await readReusableStoredStep1(outputDir, requestedTargets, targetsToRunKeys) : undefined
    prepared = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        // Stage newly dispatched providers from the stored audio rather than re-acquiring a URL or YouTube
        // source; the lossless profile still needs the original stream and its timeline.
        source: storedStep1 && options.sttAudioProfile !== 'lossless' ? { filePath: storedStep1.audioPath } : source,
        targets: requestedTargets,
        audioProfile: options.sttAudioProfile,
        // A reused step1 already names the canonical media; do not materialize another copy in the run.
        outputDir: storedStep1 ? undefined : outputDir
      })
    )
    if (storedStep1) {
      prepared = withStoredStep1(prepared, storedStep1)
    }
    const acquisitionTimeMs = Date.now() - acquisitionStartedAt
    logSttAcquireSummary( {
      item: prepared.step1Metadata.slug,
      sourceMedia: basename(prepared.outputArtifacts.sourceMediaPath),
      elapsedMs: acquisitionTimeMs,
      sourceMediaMs: prepared.timings.sourceMediaMs
    })
    logSpeakerCountHintSummary(requestedTargets, options.diarizationSpeakerCount, options.diarization)

    const youtubeCaptionOutputDir = await completeYoutubeCaptionStt({
      sourceUrl: source.url,
      outputDir,
      requestedTargets,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart
    })
    if (youtubeCaptionOutputDir) {
      return youtubeCaptionOutputDir
    }

    const singleProviderOutputDir = await completeSingleProviderStt({
      outputDir,
      requestedTargets,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart,
      mistralPassController
    })
    if (singleProviderOutputDir) {
      return singleProviderOutputDir
    }

    return await runMultiProviderSttBatch({
      outputDir,
      requestedTargets,
      targetsToRunKeys,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart,
      runOptions,
      mistralPassController
    })
  } finally {
    await prepared?.cleanup?.()
  }
}
