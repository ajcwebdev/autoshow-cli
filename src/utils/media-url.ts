import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { MaterializedMediaInput } from '~/types'
import { InfraError } from '~/utils/error-handler'

const SAFE_FILE_NAME_PATTERN = /[^A-Za-z0-9._-]+/g

const isHttpMediaUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const fileNameFromUrl = (value: string): string => {
  const url = new URL(value)
  let decoded = url.pathname
  try {
    decoded = decodeURIComponent(url.pathname)
  } catch {
  }
  const name = basename(decoded).replace(SAFE_FILE_NAME_PATTERN, '_').replace(/^_+|_+$/g, '')
  return name || `media-${randomUUID()}`
}

export const materializeMediaInput = async (
  input: string,
  options: {
    accept?: string | undefined
    label?: string | undefined
  } = {}
): Promise<MaterializedMediaInput> => {
  const normalizedInput = input.trim()
  if (!isHttpMediaUrl(normalizedInput)) {
    return {
      input: normalizedInput,
      path: normalizedInput,
      basename: basename(normalizedInput),
      isRemote: false,
      cleanup: async () => {}
    }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-media-url-'))
  const fileName = fileNameFromUrl(normalizedInput)
  const outputPath = join(tempDir, fileName)
  const label = options.label ?? 'media URL'

  try {
    const response = await fetch(normalizedInput, {
      method: 'GET',
      headers: {
        accept: options.accept ?? 'audio/*,video/*,application/octet-stream;q=0.9,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      throw InfraError(`HTTP ${response.status}`, { stage: 'download:media-url', status: response.status })
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw InfraError('downloaded file is empty', { stage: 'download:media-url' })
    }

    await Bun.write(outputPath, bytes)
    return {
      input: normalizedInput,
      path: outputPath,
      basename: fileName,
      isRemote: true,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    const message = error instanceof Error ? error.message : String(error)
    throw InfraError(`Failed to download ${label}: ${message}`, { stage: 'download:media-url', cause: error instanceof Error ? error : undefined })
  }
}
