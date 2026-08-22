import { rename } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { CanonicalAudioProviderProjection, CurrentTtsRecoveredGenerationSlot, ObservedAudioFormat, WrittenJson } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { hasErrorCode } from '~/utils/error-handler'
import { canonicalTtsJson, sha256Bytes } from './contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from './safe-artifact-store'
import { childEnv } from '~/utils/child-env'
// Canonical definition lives in error-handler; re-exported so the existing sibling
// imports in this directory keep working.
export { hasErrorCode }

export const contained = (root: string, path: string): string => {
  const value = relative(root, path)
  if (!value || value === '..' || value.startsWith(`..${sep}`)) throw CLIUsageError('TTS evidence escaped its stable provider artifact directory.')
  return value.split(sep).join('/')
}

export const writeJson = async <T>(rootDir: string, path: string, value: T): Promise<WrittenJson<T>> => {
  const bytes = `${canonicalTtsJson(value)}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { value, path, sha256: written.sha256 }
}

export const writeJsonCreateOnly = writeJson

export const writeJsonReplace = async <T>(rootDir: string, path: string, value: T): Promise<WrittenJson<T>> => {
  const bytes = `${canonicalTtsJson(value)}\n`
  const destinationRef = contained(rootDir, path)
  try {
    const existing = await readContainedArtifactFile(rootDir, destinationRef)
    if (existing.sha256 === sha256Bytes(bytes)) return { value, path, sha256: existing.sha256 }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  const temporaryRef = join(dirname(destinationRef), `.archive-${crypto.randomUUID()}.tmp`)
  const temporary = await writeImmutableArtifactFile(rootDir, temporaryRef, bytes)
  try {
    await rename(temporary.path, resolve(rootDir, destinationRef))
  } finally {
    await unlink(temporary.path).catch(() => undefined)
  }
  return { value, path, sha256: temporary.sha256 }
}

export const writeTextCreateOnly = async (rootDir: string, path: string, value: string): Promise<{ path: string, sha256: string }> => {
  const bytes = value.endsWith('\n') ? value : `${value}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { path, sha256: written.sha256 }
}

export const readObservedAudio = async (rootDir: string, path: string): Promise<{ bytes: Buffer, format: ObservedAudioFormat, durationMs: number }> => {
  const bytes = (await readContainedArtifactFile(rootDir, contained(rootDir, path))).bytes
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 16
  let byteRate = 0
  let dataBytes = 0
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', offset, offset + 4)
      const size = bytes.readUInt32LE(offset + 4)
      const content = offset + 8
      if (kind === 'fmt ' && content + 16 <= bytes.length) {
        channels = bytes.readUInt16LE(content + 2)
        sampleRate = bytes.readUInt32LE(content + 4)
        byteRate = bytes.readUInt32LE(content + 8)
        bitsPerSample = bytes.readUInt16LE(content + 14)
      } else if (kind === 'data') dataBytes += Math.min(size, Math.max(0, bytes.length - content))
      offset = content + size + (size % 2)
    }
    if (sampleRate <= 0 || channels <= 0) throw CLIUsageError(`Retained TTS WAV output has no valid audio format metadata: ${path}`)
    return { bytes, format: { codec: bitsPerSample === 24 ? 'pcm_s24le' : 'pcm_s16le', container: 'wav', sampleRate, channels }, durationMs: byteRate > 0 ? Math.round(dataBytes / byteRate * 1000) : 0 }
  }

  const probe = Bun.spawn([
    getFfprobeBinary(),
    '-v', 'error',
    '-show_entries', 'format=format_name,duration,bit_rate:stream=codec_name,sample_rate,channels,bit_rate',
    '-of', 'json',
    path
  ], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(probe.stdout).text(),
    new Response(probe.stderr).text(),
    probe.exited
  ])
  if (exitCode !== 0) throw CLIUsageError(`Could not probe retained TTS audio output ${path}: ${stderr.trim() || `ffprobe exited ${exitCode}`}`)
  let parsed: {
    format?: { format_name?: string | undefined, duration?: string | undefined, bit_rate?: string | undefined } | undefined
    streams?: Array<{ codec_name?: string | undefined, sample_rate?: string | undefined, channels?: number | undefined, bit_rate?: string | undefined }> | undefined
  }
  try {
    parsed = JSON.parse(stdout) as typeof parsed
  } catch {
    throw CLIUsageError(`Could not parse retained TTS audio metadata for ${path}.`)
  }
  const stream = parsed.streams?.find((entry) => Number(entry.sample_rate) > 0 && Number(entry.channels) > 0)
  const codec = stream?.codec_name?.trim()
  const container = parsed.format?.format_name?.split(',').map((entry) => entry.trim()).find(Boolean)
  sampleRate = Number(stream?.sample_rate)
  channels = Number(stream?.channels)
  if (!codec || !container || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(channels) || channels <= 0) {
    throw CLIUsageError(`Retained TTS audio output has incomplete observed format metadata: ${path}`)
  }
  const bitRate = Number(stream?.bit_rate ?? parsed.format?.bit_rate)
  const durationSeconds = Number(parsed.format?.duration)
  return {
    bytes,
    format: { codec, container, sampleRate, channels, ...(Number.isFinite(bitRate) && bitRate > 0 ? { bitRate } : {}) },
    durationMs: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : 0
  }
}

export const copyCreateOnly = async (rootDir: string, source: string, destination: string): Promise<void> => {
  const sourceFile = await readContainedArtifactFile(rootDir, contained(rootDir, source))
  await writeImmutableArtifactFile(rootDir, contained(rootDir, destination), sourceFile.bytes)
}

export const readVerifiedJson = async <T>(rootDir: string, path: string, expectedSha256: string, label: string): Promise<T> => {
  let retained
  try {
    retained = await readContainedArtifactFile(rootDir, contained(rootDir, path))
  } catch (error) {
    throw CLIUsageError(`${label} could not be read as a contained regular artifact: ${error instanceof Error ? error.message : String(error)}`, undefined, error instanceof Error ? { cause: error } : {})
  }
  if (retained.sha256 !== expectedSha256) throw CLIUsageError(`${label} checksum does not match retained canonical evidence.`)
  try {
    return JSON.parse(retained.bytes.toString('utf8')) as T
  } catch {
    throw CLIUsageError(`${label} is not valid JSON.`)
  }
}

export const publishReportedOutput = async (
  rootDir: string,
  source: string,
  destination: string,
  projection: CanonicalAudioProviderProjection
): Promise<string> => {
  const sourceFile = await readContainedArtifactFile(rootDir, contained(rootDir, source))
  const destinationRef = contained(rootDir, destination)
  const protectedRefs = projection.renderHistory
    .flatMap((render) => render.events)
    .flatMap((event) => event.reportedOutputRefs ?? [])
    .filter((ref) => ref.path === destinationRef)
  if (protectedRefs.some((ref) => ref.sha256 !== sourceFile.sha256)) {
    throw CLIUsageError(`Reported TTS output ${destinationRef} is checksum-bound to an earlier successful render and cannot be replaced.`)
  }
  try {
    const existing = await readContainedArtifactFile(rootDir, destinationRef)
    if (existing.sha256 === sourceFile.sha256) return sourceFile.sha256
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }

  const temporaryRef = join(dirname(destinationRef), `.reported-output-${crypto.randomUUID()}.tmp`)
  const temporary = await writeImmutableArtifactFile(rootDir, temporaryRef, sourceFile.bytes)
  try {
    await rename(temporary.path, resolve(rootDir, destinationRef))
  } finally {
    await unlink(temporary.path).catch(() => undefined)
  }
  return sourceFile.sha256
}

export const materializeRecoveredBatch = async (
  rootDir: string,
  batch: CurrentTtsRecoveredGenerationSlot
): Promise<void> => {
  if (!batch.requiresMaterialization) return
  const file = await writeJson(rootDir, batch.path, batch.value)
  if (file.sha256 !== batch.sha256) {
    throw CLIUsageError(`Recovered TTS generation slot ${batch.value.generationSlotId} changed identity during durable result promotion.`)
  }
}
