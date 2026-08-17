import { createHash } from 'node:crypto'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DownloadFlowId, DownloadRequest, PartialDownloadMetadata } from '~/types'
import { extractTarGzBuffer } from './tar-gz'
import { withSetupDownloadSlot } from './download-admission'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { InfraError, InternalError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'

// Downloads abort on inactivity, not on elapsed transfer time: a flat total
// deadline made every multi-GB asset fail on any link slower than the deadline
// implied, regardless of connection health.
const DEFAULT_STALL_TIMEOUT_MS = 60_000
const DEFAULT_TOTAL_TIMEOUT_MS = 15 * 60_000
const LARGE_ASSET_TOTAL_TIMEOUT_MS = 60 * 60_000

const TOTAL_TIMEOUT_MS_BY_FLOW: Record<DownloadFlowId, number> = {
  'uv-release': DEFAULT_TOTAL_TIMEOUT_MS,
  'yt-dlp-binary': DEFAULT_TOTAL_TIMEOUT_MS,
  'ffmpeg-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'lame-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'mupdf-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'mupdf-prebuilt': DEFAULT_TOTAL_TIMEOUT_MS,
  'calibre-dmg': LARGE_ASSET_TOTAL_TIMEOUT_MS,
  'leptonica-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'tesseract-source': DEFAULT_TOTAL_TIMEOUT_MS,
  tessdata: DEFAULT_TOTAL_TIMEOUT_MS,
  'libjpeg-turbo-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'qpdf-source': DEFAULT_TOTAL_TIMEOUT_MS,
  'qpdf-prebuilt': DEFAULT_TOTAL_TIMEOUT_MS,
  'whisper-model': LARGE_ASSET_TOTAL_TIMEOUT_MS,
  'whisperfile-binary': LARGE_ASSET_TOTAL_TIMEOUT_MS,
  'whisper-source': DEFAULT_TOTAL_TIMEOUT_MS
}

type DownloadTimeouts = {
  stallTimeoutMs: number
  totalTimeoutMs: number
}

export const resolveDownloadTimeouts = (req: DownloadRequest): DownloadTimeouts => {
  return {
    stallTimeoutMs: req.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS,
    totalTimeoutMs: req.totalTimeoutMs ?? (req.flowId === undefined
      ? DEFAULT_TOTAL_TIMEOUT_MS
      : TOTAL_TIMEOUT_MS_BY_FLOW[req.flowId])
  }
}

const getFileSize = async (path: string): Promise<number | null> => {
  try {
    const s = await stat(path)
    return s.size
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const normalizeSha256 = (value: string): string => value.replace(/^sha256:/i, '').trim().toLowerCase()

const hashFile = async (path: string): Promise<string> => {
  const hash = createHash('sha256')
  const reader = Bun.file(path).stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) hash.update(value)
  }
  return hash.digest('hex')
}

const partFilePath = (destination: string): string => `${destination}.part`
const partMetadataPath = (destination: string): string => `${destination}.part.json`

const discardPartialDownload = async (destination: string): Promise<void> => {
  await Promise.all([
    rm(partFilePath(destination), { force: true }),
    rm(partMetadataPath(destination), { force: true })
  ])
}

const readPartialDownloadMetadata = async (destination: string): Promise<PartialDownloadMetadata | undefined> => {
  try {
    const parsed = JSON.parse(await Bun.file(partMetadataPath(destination)).text()) as PartialDownloadMetadata
    return typeof parsed?.url === 'string' ? parsed : undefined
  } catch {
    return undefined
  }
}

const writePartialDownloadMetadata = async (destination: string, url: string): Promise<void> => {
  await Bun.write(partMetadataPath(destination), JSON.stringify({ url } satisfies PartialDownloadMetadata))
}

// Only resume a partial file we can prove belongs to this exact URL; otherwise a
// leftover fragment from another asset would be silently concatenated.
const resolveResumeOffset = async (req: DownloadRequest): Promise<number> => {
  const size = await getFileSize(partFilePath(req.destination))
  if (size === null || size === 0) {
    await discardPartialDownload(req.destination)
    return 0
  }
  const metadata = await readPartialDownloadMetadata(req.destination)
  if (!metadata || metadata.url !== req.url) {
    await discardPartialDownload(req.destination)
    return 0
  }
  return size
}

type DownloadWatchdog = {
  signal: AbortSignal
  progress: () => void
  stop: () => void
  timeoutMessage: () => string | undefined
}

const createDownloadWatchdog = (timeouts: DownloadTimeouts): DownloadWatchdog => {
  const controller = new AbortController()
  let abortReason: 'stall' | 'deadline' | undefined
  let stallTimer: ReturnType<typeof setTimeout> | undefined

  const armStallTimer = (): void => {
    if (stallTimer) clearTimeout(stallTimer)
    stallTimer = setTimeout(() => {
      abortReason = 'stall'
      controller.abort()
    }, timeouts.stallTimeoutMs)
  }

  const deadlineTimer = setTimeout(() => {
    abortReason = 'deadline'
    controller.abort()
  }, timeouts.totalTimeoutMs)

  armStallTimer()

  return {
    signal: controller.signal,
    progress: armStallTimer,
    stop: () => {
      if (stallTimer) clearTimeout(stallTimer)
      clearTimeout(deadlineTimer)
    },
    // Wording keeps "timed out" so classifyFetchRetry treats this as retryable.
    timeoutMessage: () => {
      if (abortReason === 'stall') {
        return `Download timed out: no data received for ${Math.round(timeouts.stallTimeoutMs / 1000)}s`
      }
      if (abortReason === 'deadline') {
        return `Download timed out after ${Math.round(timeouts.totalTimeoutMs / 1000)}s`
      }
      return undefined
    }
  }
}

const streamResponseToFile = async (
  response: Response,
  path: string,
  append: boolean,
  onProgress: () => void
): Promise<number> => {
  const body = response.body
  if (!body) {
    throw InfraError(`Download response had no body: ${response.url || 'unknown url'}`, { stage: 'setup:download' })
  }

  const handle = await open(path, append ? 'a' : 'w')
  let written = 0
  try {
    const reader = body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      await handle.write(value)
      written += value.byteLength
      onProgress()
    }
  } finally {
    await handle.close()
  }
  return written
}

// Streams to `<destination>.part` so nothing is buffered whole in memory and an
// interrupted transfer can resume from the bytes already on disk.
const fetchToPartFile = async (req: DownloadRequest, timeouts: DownloadTimeouts): Promise<number> => {
  const resumeFrom = await resolveResumeOffset(req)
  const partPath = partFilePath(req.destination)
  const watchdog = createDownloadWatchdog(timeouts)

  try {
    const response = await fetch(req.url, {
      signal: watchdog.signal,
      redirect: 'follow',
      ...(resumeFrom > 0 ? { headers: { range: `bytes=${resumeFrom}-` } } : {})
    })

    if (!response.ok) {
      if (response.status === 416) {
        // The partial file is at or past the full length; restart clean.
        await discardPartialDownload(req.destination)
      }
      throw httpResponseError(`bun-fetch download failed: HTTP ${response.status} ${response.statusText}`, response, {
        stage: 'setup:download'
      })
    }

    watchdog.progress()

    const resumed = resumeFrom > 0 && response.status === 206
    if (resumeFrom > 0 && !resumed) {
      // Server ignored the range request and is replaying from byte 0.
      await rm(partPath, { force: true })
    }

    await writePartialDownloadMetadata(req.destination, req.url)
    const written = await streamResponseToFile(response, partPath, resumed, watchdog.progress)
    return resumed ? resumeFrom + written : written
  } catch (error) {
    const timeoutMessage = watchdog.timeoutMessage()
    if (timeoutMessage) {
      throw InfraError(`${timeoutMessage} (${req.url})`, { stage: 'setup:download' })
    }
    throw error
  } finally {
    watchdog.stop()
  }
}

const extractDownloadedArchive = async (
  archivePath: string,
  req: DownloadRequest,
  mode: 'tar-gz' | 'tar-xz' | 'zip'
): Promise<void> => {
  await mkdir(req.destination, { recursive: true })

  if (mode === 'tar-gz') {
    const buffer = await Bun.file(archivePath).arrayBuffer()
    await extractTarGzBuffer(buffer, {
      destination: req.destination,
      ...(req.stripComponents !== undefined ? { stripComponents: req.stripComponents } : {})
    })
    return
  }

  if (mode === 'tar-xz') {
    const args = ['-xJf', archivePath, '-C', req.destination]
    if (req.stripComponents !== undefined) {
      args.push(`--strip-components=${req.stripComponents}`)
    }
    await runCapture('tar', args)
    return
  }

  if (req.stripComponents !== undefined && req.stripComponents > 0) {
    throw InternalError('zip extraction does not support stripComponents', { stage: 'setup:download' })
  }
  await runCapture('unzip', ['-q', archivePath, '-d', req.destination])
}

export const downloadFile = async (req: DownloadRequest): Promise<void> => {
  const timeouts = resolveDownloadTimeouts(req)
  const mode = req.mode ?? 'file'
  const partPath = partFilePath(req.destination)

  await mkdir(dirname(partPath), { recursive: true })

  // Only the transfer holds a slot: hashing and extraction below are local work,
  // and a 1.5 GB checksum pass must not keep another download queued.
  const bytes = await withSetupDownloadSlot(async () => await fetchToPartFile(req, timeouts))

  // Both guards below mean the bytes on disk are wrong rather than merely
  // incomplete, so the partial file is discarded instead of resumed.
  if (req.sha256) {
    const actual = await hashFile(partPath)
    const expected = normalizeSha256(req.sha256)
    if (actual !== expected) {
      await discardPartialDownload(req.destination)
      throw InfraError(`SHA-256 mismatch for ${req.url}: expected ${expected}, got ${actual}`, { stage: 'setup:download' })
    }
  }

  if (req.expectedMinBytes !== undefined && bytes < req.expectedMinBytes) {
    await discardPartialDownload(req.destination)
    throw InfraError(
      `Downloaded ${mode === 'file' ? 'file' : 'archive'} too small: ${bytes} bytes (expected >= ${req.expectedMinBytes})`,
      { stage: 'setup:download' }
    )
  }

  if (mode === 'file') {
    await rm(req.destination, { recursive: true, force: true })
    await rename(partPath, req.destination)
    await rm(partMetadataPath(req.destination), { force: true })
  } else {
    await extractDownloadedArchive(partPath, req, mode)
    await discardPartialDownload(req.destination)
  }
}
