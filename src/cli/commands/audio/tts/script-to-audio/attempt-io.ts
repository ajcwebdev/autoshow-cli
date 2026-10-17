import { lstat, rename } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { CanonicalAudioProviderProjection, CurrentTtsRecoveredGenerationSlot, ObservedAudioFormat, WrittenJson } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { hasErrorCode } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from './safe-artifact-store'
import { childEnv } from '~/utils/child-env'
import { parseWaveMetadata, wavePcmFormat } from '../tts-utils/wave-metadata'
export { hasErrorCode }

export const contained = (root: string, path: string): string => {
  const value = relative(root, path)
  if (!value || value === '..' || value.startsWith(`..${sep}`)) throw UsageError('TTS evidence escaped its stable provider artifact directory.')
  return value.split(sep).join('/')
}

export const writeJson = async <T>(rootDir: string, path: string, value: T): Promise<WrittenJson<T>> => {
  const bytes = `${canonicalTtsJson(value)}\n`
  const written = await writeImmutableArtifactFile(rootDir, contained(rootDir, path), bytes)
  return { value, path, sha256: written.sha256 }
}

export const writeJsonCreateOnly = writeJson

export const writeJsonReuseCompatibleIdentity = async <T extends object>(
  rootDir: string,
  path: string,
  value: T,
  identityKey: keyof T & string,
  ignoredKeys: readonly (keyof T & string)[]
): Promise<WrittenJson<T>> => {
  try {
    const retained = await readContainedArtifactFile(rootDir, contained(rootDir, path))
    const parsed = JSON.parse(retained.bytes.toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return await writeJson(rootDir, path, value)
    const existing = parsed as Record<string, unknown>
    const withoutIgnored = (record: Record<string, unknown>): Record<string, unknown> => {
      const comparable = { ...record }
      delete comparable[identityKey]
      for (const key of ignoredKeys) delete comparable[key]
      return comparable
    }
    const { [identityKey]: retainedIdentity, ...retainedBase } = existing
    const candidate = value as unknown as Record<string, unknown>
    const { [identityKey]: candidateIdentity, ...candidateBase } = candidate
    if (
      retainedIdentity !== hashCanonicalTtsValue(retainedBase)
      || candidateIdentity !== hashCanonicalTtsValue(candidateBase)
      || canonicalTtsJson(withoutIgnored(existing)) !== canonicalTtsJson(withoutIgnored(candidate))
    ) return await writeJson(rootDir, path, value)
    return { value: existing as unknown as T, path, sha256: retained.sha256 }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
    return await writeJson(rootDir, path, value)
  }
}

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
  const wave = parseWaveMetadata(bytes)
  if (wave) {
    // Retained audio needs only a usable format; a zero byte rate or empty data reports 0 ms.
    if (wave.sampleRate <= 0 || wave.channels <= 0) throw UsageError(`Retained TTS WAV output has no valid audio format metadata: ${path}`)
    return { bytes, format: wavePcmFormat(wave), durationMs: wave.byteRate > 0 ? Math.round(wave.dataBytes / wave.byteRate * 1000) : 0 }
  }

  let bundled = false
  try { await lstat(path) } catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; bundled = true }
  const probe = Bun.spawn([
    getFfprobeBinary(),
    '-v', 'error',
    '-show_entries', `format=format_name,duration,bit_rate:stream=codec_name,sample_rate,channels,bit_rate${bundled ? ':frame=nb_samples' : ''}`,
    ...(bundled ? ['-show_frames', '-select_streams', 'a:0'] : []),
    '-of', 'json',
    bundled ? 'pipe:0' : path
  ], { env: childEnv(), ...(bundled ? { stdin: bytes } : {}), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(probe.stdout).text(),
    new Response(probe.stderr).text(),
    probe.exited
  ])
  if (exitCode !== 0) throw UsageError(`Could not probe retained TTS audio output ${path}: ${stderr.trim() || `ffprobe exited ${exitCode}`}`)
  let parsed: {
    format?: { format_name?: string | undefined, duration?: string | undefined, bit_rate?: string | undefined } | undefined
    streams?: Array<{ codec_name?: string | undefined, sample_rate?: string | undefined, channels?: number | undefined, bit_rate?: string | undefined }> | undefined
    frames?: Array<{ nb_samples?: number }> | undefined
  }
  try {
    parsed = JSON.parse(stdout) as typeof parsed
  } catch {
    throw UsageError(`Could not parse retained TTS audio metadata for ${path}.`)
  }
  const stream = parsed.streams?.find((entry) => Number(entry.sample_rate) > 0 && Number(entry.channels) > 0)
  const codec = stream?.codec_name?.trim()
  const container = parsed.format?.format_name?.split(',').map((entry) => entry.trim()).find(Boolean)
  const sampleRate = Number(stream?.sample_rate)
  const channels = Number(stream?.channels)
  if (!codec || !container || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(channels) || channels <= 0) {
    throw UsageError(`Retained TTS audio output has incomplete observed format metadata: ${path}`)
  }
  const bitRate = Number(stream?.bit_rate ?? parsed.format?.bit_rate)
  const durationSeconds = Number(parsed.format?.duration)
  return {
    bytes,
    format: { codec, container, sampleRate, channels, ...(Number.isFinite(bitRate) && bitRate > 0 ? { bitRate } : {}) },
    durationMs: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000)
      : Math.round((parsed.frames ?? []).reduce((sum, frame) => sum + Number(frame.nb_samples ?? 0), 0) / sampleRate * 1000)
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
    throw UsageError(`${label} could not be read as a contained regular artifact: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  if (retained.sha256 !== expectedSha256) throw UsageError(`${label} checksum does not match retained canonical evidence.`)
  try {
    return JSON.parse(retained.bytes.toString('utf8')) as T
  } catch {
    throw UsageError(`${label} is not valid JSON.`)
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
  const selected = projection.selectedSuccess
  const active = projection.activeWork
  const selectedIsAuthoritative = selected !== undefined && !(
    active?.kind === 'render'
    && (active.renderIdentity !== selected.renderIdentity || active.eventSequence !== selected.eventSequence)
  )
  const protectedRefs = selectedIsAuthoritative
    ? projection.renderHistory
        .filter((render) => render.renderIdentity === selected.renderIdentity)
        .flatMap((render) => render.events.filter((event) => event.sequence === selected.eventSequence))
        .flatMap((event) => event.reportedOutputRefs ?? [])
        .filter((ref) => ref.path === destinationRef)
    : []
  if (protectedRefs.some((ref) => ref.sha256 !== sourceFile.sha256)) {
    throw UsageError(`Reported TTS output ${destinationRef} is checksum-bound to an earlier successful render and cannot be replaced.`)
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
    throw UsageError(`Recovered TTS generation slot ${batch.value.generationSlotId} changed identity during durable result promotion.`)
  }
}

export const createAudioRunArtifactWriter = (rootDir: string, audioRunRoot: string) => ({
  write: async <T>(name: string, value: T) => {
    const file = await writeJsonCreateOnly(rootDir, `${audioRunRoot}/${name}`, value)
    return { ...file, ref: { path: contained(audioRunRoot, file.path), sha256: file.sha256 } }
  },
})
