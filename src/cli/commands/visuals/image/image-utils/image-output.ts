import { mkdtemp, rename, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { OpenAIImageResponse } from '~/types'
import { downloadGeneratedFile, imageDownloadHttpError } from '~/utils/polled-job-client/polled-job'
import { buildGenerationArtifactPath } from '~/cli/commands/command-shared/media-generation/media-generation-scaffold'
import { partialImageResponseDirectoryPrefix } from '~/cli/commands/command-shared/media-resume-artifacts'
import { ValidationError } from '~/utils/error-handler'
import { toProjectRelativePath } from '~/utils/project-root'
import { readPngChunks } from '~/utils/lossless-png'

export const mimeToExtension = (mimeType: string | null | undefined, fallback = 'png'): string => {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/svg+xml') return 'svg'
  return fallback
}

const urlToExtension = (url: string, fallback = 'png'): string => {
  try {
    const ext = extname(new URL(url).pathname).slice(1).toLowerCase()
    return ['png', 'jpeg', 'jpg', 'webp'].includes(ext) ? ext : fallback
  } catch {
    return fallback
  }
}

const outputPathForIndex = (outputDir: string, ext: string, index: number): { fileName: string, outputPath: string } => {
  const outputPath = buildGenerationArtifactPath('image', outputDir, ext, index)
  return { fileName: basename(outputPath), outputPath }
}

export const downloadImageUrl = async (
  url: string,
  outputDir: string,
  index: number,
  fallbackExt: string,
  signal?: AbortSignal | undefined
): Promise<string> => {
  let outputPath = ''
  await downloadGeneratedFile({
    url,
    operationName: 'generated-image-download',
    init: {
      headers: { accept: 'image/*,*/*;q=0.8' },
      ...(signal ? { signal } : {})
    },
    outputPath: (response) => {
      const ext = mimeToExtension(response.headers.get('content-type'), urlToExtension(url, fallbackExt))
      outputPath = outputPathForIndex(outputDir, ext, index).outputPath
      return outputPath
    },
    errorFactory: (response) => imageDownloadHttpError(`Generated image download failed (${response.status}): ${url}`, response)
  })

  return outputPath
}

export const writeOpenAIImageResponseData = async (
  response: OpenAIImageResponse,
  outputDir: string,
  fallbackExt: string,
  options: { model: string, recoveryDir: string, expectedCount?: number }
): Promise<string[]> => {
  const data = response.data ?? []
  if (data.length === 0) return []
  // Stage outside the disposable provider workspace so a failed batch or a subsequent resume cannot erase valid outputs.
  const stagingDir = await mkdtemp(join(options.recoveryDir, partialImageResponseDirectoryPrefix(options.model)))
  const validPaths: string[] = []
  const issues: string[] = []

  for (const [index, item] of data.entries()) {
    let path: string | undefined
    try {
      if (item?.b64_json) {
        // Accept standard or URL-safe alphabets, optional padding and whitespace. Reject non-base64 characters.
        const bytes = Uint8Array.fromBase64(item.b64_json, { alphabet: /[-_]/.test(item.b64_json) ? 'base64url' : 'base64' })
        if (!bytes.length) throw ValidationError('empty base64 image', { stage: 'image:output' })
        path = outputPathForIndex(stagingDir, mimeToExtension(item.mime_type, fallbackExt), index).outputPath
        await Bun.write(path, bytes)
      } else if (item?.url) {
        path = await downloadImageUrl(item.url, stagingDir, index, fallbackExt)
      } else {
        throw ValidationError('missing image payload', { stage: 'image:output' })
      }
      const file = Bun.file(path)
      const image = new Bun.Image(file)
      const metadata = await image.metadata()
      const format = metadata.format === 'jpeg' ? 'jpg' : metadata.format
      if (!metadata.width || !metadata.height || !['png', 'jpg', 'webp'].includes(format) || extname(path) !== `.${format}`) {
        throw ValidationError('image encoding does not match the output format', { stage: 'image:output' })
      }
      // Bun can recover pixels from a PNG missing its IEND or carrying a damaged chunk checksum.
      if (format === 'png') readPngChunks(await file.bytes())
      // Re-encoding forces a complete pixel decode. Keep the provider's original encoded bytes for the artifact.
      await image.png().bytes()
      validPaths.push(path)
    } catch (error) {
      if (path) await rm(path, { force: true })
      issues.push(`image ${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (options.expectedCount !== undefined && data.length !== options.expectedCount) {
    issues.push(`expected ${options.expectedCount} images, received ${data.length}`)
  }
  if (issues.length) {
    if (!validPaths.length) await rm(stagingDir, { recursive: true })
    const recovery = validPaths.length ? ` Valid images retained in ${toProjectRelativePath(stagingDir)}.` : ''
    throw ValidationError(`Invalid image response from ${options.model}: ${issues.join('; ')}.${recovery}`, { stage: 'image:output' })
  }
  const paths: string[] = []
  for (const path of validPaths) {
    const finalPath = join(outputDir, basename(path))
    await rename(path, finalPath)
    paths.push(finalPath)
  }
  await rm(stagingDir, { recursive: true })
  return paths
}

export const getImageFileNames = (imagePaths: readonly string[]): string[] =>
  imagePaths.map((imagePath) => basename(imagePath))

export const getFirstRevisedPrompt = (response: OpenAIImageResponse): string | undefined => {
  const dataPrompt = response.data?.find((item) => typeof item.revised_prompt === 'string')?.revised_prompt
  if (dataPrompt) return dataPrompt
  return typeof response.revised_prompt === 'string' ? response.revised_prompt : undefined
}

export const getProviderReturnedModel = (
  requestedModel: string,
  response: OpenAIImageResponse | { model?: string | undefined, modelVersion?: string | undefined }
): string | undefined => {
  const model = 'modelVersion' in response ? response.modelVersion : response.model
  return typeof model === 'string' && model.length > 0 && model !== requestedModel ? model : undefined
}
