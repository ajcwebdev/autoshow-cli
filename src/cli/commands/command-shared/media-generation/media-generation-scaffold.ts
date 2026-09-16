import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'
import type {
  GenerationModality,
  MediaGenerationContext,
  MediaGenerationDescriptor,
  MediaGenerationRun
} from '~/types'
import { InfraError } from '~/utils/error-handler'
import { requireGenerationCredential } from '../generation-routing/generation-credentials'
import { logGenCompleted, logGenStatus } from '../generation-command-utils'

/**
 * The canonical in-workspace artifact names. The shared target runner renames these per service and
 * model when a run fans out, so adapters never spell `generated-video.mp4` themselves.
 */
export const GENERATION_ARTIFACT_BASENAMES = {
  image: 'generated-image',
  video: 'generated-video',
  music: 'generated-music'
} as const satisfies Record<GenerationModality, string>

const GENERATION_ARTIFACT_EXTENSIONS = {
  image: 'png',
  video: 'mp4',
  music: 'mp3'
} as const satisfies Record<GenerationModality, string>

/** The one spelling of a generation artifact's file name, shared by the adapters and the target renamers. */
export const generationArtifactFileName = (
  modality: GenerationModality,
  extension: string = GENERATION_ARTIFACT_EXTENSIONS[modality],
  index = 0
): string => {
  const normalized = extension === 'jpeg' ? 'jpg' : extension
  const base = GENERATION_ARTIFACT_BASENAMES[modality]
  return `${index === 0 ? base : `${base}-${index + 1}`}.${normalized}`
}

export const buildGenerationArtifactPath = (
  modality: GenerationModality,
  outputDir: string,
  extension?: string | undefined,
  index = 0
): string => `${outputDir}/${generationArtifactFileName(modality, extension, index)}`

/**
 * The generation sequence every image, video and music provider shares: resolve the credential from
 * the registry, build the request, announce the estimate, time the billed call, and stamp the timing
 * and file facts onto the metadata. Provider modules supply only `prepare` and `execute`.
 */
export const runMediaGeneration = async <TPrepared, TMetadata>(
  descriptor: MediaGenerationDescriptor<TPrepared, TMetadata>
): Promise<MediaGenerationRun<TMetadata>> => {
  const { modality, service, model, outputDir } = descriptor
  // Resolved on first use so a rejected flag combination fails before a missing key does.
  let resolvedApiKey: string | undefined
  const readApiKey = (): string => {
    resolvedApiKey ??= descriptor.credential === 'none' ? '' : requireGenerationCredential(modality, service)
    return resolvedApiKey
  }

  const context: MediaGenerationContext = {
    get apiKey () { return readApiKey() },
    outputDir,
    model,
    artifactPath: (extension, index) => buildGenerationArtifactPath(modality, outputDir, extension, index),
    logStatus: (status, detail) => logGenStatus(modality, service, model, status, detail)
  }

  // After `prepare` so an unsupported flag combination fails before anything touches the filesystem.
  const prepared = await descriptor.prepare(context)
  await mkdir(outputDir, { recursive: true })
  descriptor.estimate?.(prepared)
  context.logStatus('started', typeof descriptor.startDetail === 'function' ? descriptor.startDetail(prepared) : descriptor.startDetail)

  const startTime = Date.now()
  const outcome = await descriptor.execute(context, prepared)
  const processingTime = Date.now() - startTime

  const artifactPaths = [...outcome.artifactPaths]
  const primaryPath = artifactPaths[0]
  if (primaryPath === undefined) {
    throw InfraError(`${service} ${modality} generation completed without writing an artifact`, {
      stage: `${modality}:${service}`
    })
  }

  logGenCompleted(modality, service, model, processingTime, artifactPaths, outcome.completionDetail)

  return {
    artifactPaths,
    fileNames: artifactPaths.map(path => basename(path)),
    primaryPath,
    primaryFileSize: Bun.file(primaryPath).size,
    processingTime,
    metadata: outcome.metadata
  }
}
