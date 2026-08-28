import { constants as fsConstants } from 'node:fs'
import { copyFile, link, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { hasYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { materializeNormalizedAudioArtifact, planNormalizedAudioArtifact } from '~/cli/commands/process-steps/step-1-download/audio/audio-normalize'
import { buildMediaStep1Slug, buildVideoMetadataFromInfo, extractLocalFileMetadata, getVideoInfo, isDirectMediaUrl, sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadVideo } from '~/cli/commands/process-steps/step-1-download/audio/yt-utils'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import type { AudioNormalizationProfile, PreparedSttMedia, ResolvedSttSource, Step1Metadata, SttAcquireArtifactOptions, SttTarget, VideoMetadata } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { statPath as stat } from '~/utils/bun-file-io'
import { hasRuntimeTool } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { getAudioDuration } from './stt-utils/audio-splitter'

const DEFAULT_STT_ACQUIRE_CONCURRENCY = 2

const HOSTED_STT_SHARED_SOURCE_MEDIA_SERVICES = new Set<SttTarget['service']>([
  'assemblyai',
  'deepgram',
  'gladia',
  'groq',
  'mistral',
  'soniox',
  'speechmatics'
])

const sourceMediaAcquireQueue: Array<() => void> = []
let activeSourceMediaAcquireCount = 0

const getSourceMediaAcquireConcurrency = (): number => DEFAULT_STT_ACQUIRE_CONCURRENCY

const isHostedSttTarget = (target: SttTarget): boolean =>
  !target.local
  && target.service !== 'youtube-captions'
  && target.service !== 'supadata'
  && target.service !== 'scrapecreators'

const resolveSourceMediaProfile = (targets: SttTarget[]): AudioNormalizationProfile => {
  const hostedTargets = targets.filter(isHostedSttTarget)
  if (hostedTargets.length === 0) {
    return 'default'
  }

  return hostedTargets.every((target) => HOSTED_STT_SHARED_SOURCE_MEDIA_SERVICES.has(target.service))
    ? 'hosted-stt'
    : 'hosted-stt-mp3'
}

const withSourceMediaAcquireSlot = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const maxConcurrency = getSourceMediaAcquireConcurrency()
  if (activeSourceMediaAcquireCount >= maxConcurrency) {
    await new Promise<void>((resolve) => {
      sourceMediaAcquireQueue.push(resolve)
    })
  }

  activeSourceMediaAcquireCount += 1
  try {
    return await fn()
  } finally {
    activeSourceMediaAcquireCount = Math.max(0, activeSourceMediaAcquireCount - 1)
    sourceMediaAcquireQueue.shift()?.()
  }
}

const parseDurationSeconds = (duration: string): number | null => {
  if (!duration || duration === 'Unknown') {
    return null
  }

  const parts = duration.split(':').map((value) => Number.parseInt(value, 10))
  if (parts.some((part) => !Number.isFinite(part))) {
    return null
  }

  if (parts.length === 3) {
    return (parts[0] as number) * 3600 + (parts[1] as number) * 60 + (parts[2] as number)
  }

  if (parts.length === 2) {
    return (parts[0] as number) * 60 + (parts[1] as number)
  }

  return null
}

const ensureMediaTooling = async (needsYtDlp: boolean): Promise<void> => {
  if (!hasRuntimeTool('ffmpeg') || !hasRuntimeTool('ffprobe') || (needsYtDlp && !hasYtDlpBinary())) {
    await setupYtDependencies()
  }
}

const fetchDirectMedia = async (url: string, outputPath: string): Promise<void> => {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw InfraError(`Failed to download ${url}: HTTP ${response.status}`, { stage: 'stt:media-acquisition', status: response.status })
  }
  const bytes = await response.arrayBuffer()
  await Bun.write(outputPath, bytes)
}

const stageSourceMediaArtifact = async (
  source: { url?: string, filePath?: string },
  workspaceDir: string,
  profile: AudioNormalizationProfile
): Promise<string> => {
  const materializeFromSourcePath = async (
    sourcePath: string,
    options: { removeOriginal?: boolean } = {}
  ): Promise<string> => {
    const { plan } = await planNormalizedAudioArtifact(sourcePath, profile)
    const stagedPath = join(workspaceDir, `source_media${plan.outputExtension}`)
    await materializeNormalizedAudioArtifact(sourcePath, stagedPath, plan)
    if (options.removeOriginal && sourcePath !== stagedPath) {
      await rm(sourcePath, { force: true })
    }
    return stagedPath
  }

  if (source.filePath) {
    const absoluteFilePath = resolve(source.filePath)
    return await materializeFromSourcePath(absoluteFilePath)
  }

  const url = source.url as string
  if (isDirectMediaUrl(url)) {
    const pathname = new URL(url).pathname
    const directSuffix = extname(pathname).toLowerCase() || '.bin'
    const downloadedPath = join(workspaceDir, `downloaded${directSuffix}`)
    await fetchDirectMedia(url, downloadedPath)
    return await materializeFromSourcePath(downloadedPath, { removeOriginal: true })
  }

  await ensureMediaTooling(true)
  const downloadedPath = await downloadVideo(url, workspaceDir)
  return await materializeFromSourcePath(downloadedPath, { removeOriginal: true })
}

const resolveSttSource = async (
  source: { url?: string, filePath?: string }
): Promise<ResolvedSttSource> => {
  if (source.filePath) {
    const absoluteFilePath = resolve(source.filePath)
    return { metadata: await extractLocalFileMetadata(absoluteFilePath) }
  }

  const url = source.url as string

  if (isDirectMediaUrl(url)) {
    return {
      metadata: {
        title: basename(new URL(url).pathname).replace(/\.[^/.]+$/, '') || 'audio',
        duration: 'Unknown',
        channel: 'Unknown',
        description: '',
        url,
        publishDate: undefined,
        thumbnail: undefined,
        channelURL: undefined
      }
    }
  }

  const videoInfo = await getVideoInfo(url)
  const metadata = videoInfo ? buildVideoMetadataFromInfo(url, videoInfo) : {
    title: 'unknown',
    duration: 'Unknown',
    channel: 'Unknown',
    description: '',
    url,
    publishDate: undefined,
    thumbnail: undefined,
    channelURL: undefined
  } satisfies VideoMetadata

  return {
    metadata,
    ...(videoInfo ? { sourceVideoInfo: videoInfo } : {})
  }
}

export const resolveSttSourceMetadata = async (
  source: { url?: string, filePath?: string }
): Promise<VideoMetadata> => (await resolveSttSource(source)).metadata

const buildPrimaryOutputPaths = (
  metadata: VideoMetadata,
  outputDir: string | undefined,
  sourceMediaExecutionPath: string
): {
  sourceMediaPath: string
  primaryFilePath: string
} => {
  const slugTitle = sanitizeTitleSlug(metadata.title, 180)
  const datePrefix = metadata.publishDate ? `${metadata.publishDate}-` : ''
  const baseName = `${datePrefix}${slugTitle}`

  if (!outputDir) {
    return {
      primaryFilePath: sourceMediaExecutionPath,
      sourceMediaPath: sourceMediaExecutionPath
    }
  }

  const sourceMediaPath = join(outputDir, `${baseName}${extname(sourceMediaExecutionPath)}`)

  return {
    primaryFilePath: sourceMediaPath,
    sourceMediaPath
  }
}

const materializeOutputArtifact = async (
  sourcePath: string,
  destinationPath: string
): Promise<void> => {
  await ensureDirectory(dirname(destinationPath))
  await rm(destinationPath, { force: true })

  try {
    await link(sourcePath, destinationPath)
    return
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as Error & { code?: string }).code
      : undefined
    if (code !== 'EXDEV' && code !== 'EMLINK' && code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') {
      throw error
    }
  }

  try {
    await copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_FICLONE)
  } catch {
    await copyFile(sourcePath, destinationPath)
  }
}

const probeDurationSeconds = async (
  preferredPath: string | undefined,
  metadata: VideoMetadata
): Promise<number> => {
  const fromMetadata = parseDurationSeconds(metadata.duration)
  if (fromMetadata !== null && fromMetadata > 0) {
    return fromMetadata
  }

  if (!preferredPath) {
    return 0
  }

  const probed = await getAudioDuration(preferredPath)
  return Number.isFinite(probed) && probed > 0 ? probed : 0
}

export const prepareSttMedia = async (
  options: SttAcquireArtifactOptions
): Promise<PreparedSttMedia> => {
  const { source, targets, outputDir } = options
  const sourceMediaProfile = resolveSourceMediaProfile(targets)
  const resolvedSource = await resolveSttSource(source)
  const workspaceDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-acquire-'))
  const timings: PreparedSttMedia['timings'] = {}

  try {
    const sourceMediaExecutionPath = await withSourceMediaAcquireSlot(async () => {
      await ensureMediaTooling(!source.filePath && !isDirectMediaUrl(source.url ?? ''))

      const startedAt = Date.now()
      const stagedPath = await stageSourceMediaArtifact(source, workspaceDir, sourceMediaProfile)
      timings.sourceMediaMs = Date.now() - startedAt
      return stagedPath
    })

    const outputPaths = buildPrimaryOutputPaths(
      resolvedSource.metadata,
      outputDir,
      sourceMediaExecutionPath
    )

    if (outputPaths.sourceMediaPath !== sourceMediaExecutionPath) {
      await materializeOutputArtifact(sourceMediaExecutionPath, outputPaths.sourceMediaPath)
    }

    const primaryStats = await stat(outputPaths.primaryFilePath)
    const durationSeconds = await probeDurationSeconds(sourceMediaExecutionPath, resolvedSource.metadata)
    const step1Metadata: Step1Metadata = {
      ...resolvedSource.metadata,
      slug: buildMediaStep1Slug(source, resolvedSource.metadata),
      audioFileName: basename(outputPaths.primaryFilePath),
      audioFileSize: primaryStats.size,
      durationSeconds
    }

    return {
      metadata: resolvedSource.metadata,
      ...(resolvedSource.sourceVideoInfo ? { sourceVideoInfo: resolvedSource.sourceVideoInfo } : {}),
      step1Metadata,
      durationSeconds,
      executionArtifacts: {
        sourceMediaPath: sourceMediaExecutionPath
      },
      outputArtifacts: {
        sourceMediaPath: outputPaths.sourceMediaPath
      },
      timings,
      cleanup: async () => {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(workspaceDir, { recursive: true, force: true })
    throw error
  }
}
