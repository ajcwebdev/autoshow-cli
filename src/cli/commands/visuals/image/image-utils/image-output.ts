import { basename, extname } from 'node:path'
import type { OpenAIImageResponse } from '~/types'
import { downloadGeneratedFile, imageDownloadHttpError } from '~/utils/polled-job-client/polled-job'
import { buildGenerationArtifactPath } from '~/cli/commands/command-shared/media-generation/media-generation-scaffold'

const mimeToExtension = (mimeType: string | null | undefined, fallback = 'png'): string => {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/svg+xml') return 'svg'
  return fallback
}

const urlToExtension = (url: string, fallback = 'png'): string => {
  try {
    return extname(new URL(url).pathname).replace(/^\./, '') || fallback
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
  let contentType: string | null = null
  const bytes = await downloadGeneratedFile({
    url,
    operationName: 'generated-image-download',
    init: {
      headers: { accept: 'image/*,*/*;q=0.8' },
      ...(signal ? { signal } : {})
    },
    inspectResponse: (response) => { contentType = response.headers.get('content-type') },
    errorFactory: (response) => imageDownloadHttpError(`Generated image download failed (${response.status}): ${url}`, response)
  })

  const ext = mimeToExtension(contentType, urlToExtension(url, fallbackExt))
  const { outputPath } = outputPathForIndex(outputDir, ext, index)
  await Bun.write(outputPath, bytes)
  return outputPath
}

export const writeOpenAIImageResponseData = async (
  response: OpenAIImageResponse,
  outputDir: string,
  fallbackExt: string
): Promise<string[]> => {
  const data = response.data ?? []
  const imagePaths: string[] = []

  for (const [index, item] of data.entries()) {
    if (item.b64_json) {
      const ext = mimeToExtension(item.mime_type, fallbackExt)
      const { outputPath } = outputPathForIndex(outputDir, ext, index)
      await Bun.write(outputPath, Buffer.from(item.b64_json, 'base64'))
      imagePaths.push(outputPath)
      continue
    }

    if (item.url) {
      imagePaths.push(await downloadImageUrl(item.url, outputDir, index, fallbackExt))
    }
  }

  return imagePaths
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
