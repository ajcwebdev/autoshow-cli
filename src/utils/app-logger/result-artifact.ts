import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { AppInfrastructureError, UsageError } from '~/utils/error-handler'
import { sanitizeLogText, serializeResultArtifact } from './redaction'

const SUMMARY_MAX_BYTES = 8192
const boundedText = (value: unknown, length = 256): string => sanitizeLogText(String(value ?? '')).slice(0, length)

export const openResultArtifact = (path: string) => {
  if (!path.trim() || path.length > 4096) throw UsageError('--result-file requires a non-empty path of at most 4096 characters.')
  if (/[\u0000-\u001f\u007f]/u.test(path)) throw UsageError('--result-file paths cannot contain control characters.')
  const resolved = resolve(path)
  if (Buffer.byteLength(JSON.stringify(relative(process.cwd(), resolved))) > 2048) throw UsageError('--result-file JSON-encoded display path must fit within 2048 bytes.')
  try {
    mkdirSync(dirname(resolved), { recursive: true, mode: 0o700 })
    const descriptor = openSync(resolved, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    return { path: resolved, descriptor }
  } catch (cause) {
    throw UsageError('Cannot create --result-file; choose a new writable path. Existing files and symlinks are never overwritten.', {
      stage: 'cli:result-artifact', cause
    })
  }
}

export const closeResultArtifact = (target: ReturnType<typeof openResultArtifact>): void => { closeSync(target.descriptor) }

const summarizeData = (data: unknown): Record<string, unknown> => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}
  const entries = Object.entries(data)
  const counts: Record<string, number> = {}
  const errors: string[] = []
  for (const [key, value] of entries) {
    if (Object.keys(counts).length < 16 && typeof value === 'number' && Number.isFinite(value)) counts[boundedText(key, 48)] = value
    if (Array.isArray(value)) {
      if (Object.keys(counts).length < 16) counts[`${boundedText(key, 42)}Length`] = value.length
      if (/error|failure/i.test(key)) {
        for (const error of value.slice(0, 3 - errors.length)) {
          const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : typeof error === 'string' ? error : undefined
          if (message !== undefined) errors.push(boundedText(message))
        }
      }
    }
  }
  const safeCounts = Object.fromEntries(Object.entries(JSON.parse(serializeResultArtifact(counts)) as Record<string, unknown>).filter(([, value]) => typeof value === 'number'))
  return {
    keys: entries.slice(0, 16).map(([key]) => boundedText(key, 48)),
    keyCount: entries.length,
    ...(Object.keys(safeCounts).length ? { counts: safeCounts } : {}),
    ...(errors.length ? { representativeErrors: errors } : {})
  }
}

/** The artifact owns full sanitized data; stdout is an explicitly bounded projection. */
export const writeResultArtifact = (
  target: ReturnType<typeof openResultArtifact>,
  envelope: Record<string, unknown>
): string => {
  try {
    const opened = fstatSync(target.descriptor)
    const current = lstatSync(target.path)
    if (!current.isFile() || current.ino !== opened.ino || current.dev !== opened.dev) {
      throw new AppInfrastructureError('The result artifact path changed during the command.', { stage: 'cli:result-artifact' })
    }
    const body = `${serializeResultArtifact(envelope)}\n`
    writeFileSync(target.descriptor, body, { encoding: 'utf8' })
    fsyncSync(target.descriptor)
    const error = typeof envelope['error'] === 'object' && envelope['error'] !== null ? envelope['error'] as Record<string, unknown> : undefined
    const summary = {
      schemaVersion: envelope['schemaVersion'], type: 'result', resultMode: 'summary',
      timestamp: envelope['timestamp'], runId: boundedText(envelope['runId'], 128),
      ...(envelope['command'] ? { command: boundedText(envelope['command'], 128) } : {}),
      status: envelope['status'], exitCode: envelope['exitCode'], durationMs: envelope['durationMs'],
      message: boundedText(envelope['message'], 512),
      data: summarizeData(envelope['data']),
      ...(error ? { error: { kind: boundedText(error['kind'], 64), message: boundedText(error['message'], 512), stage: boundedText(error['stage'], 128) } } : {}),
      ...(Array.isArray(envelope['hints']) ? { hints: envelope['hints'].slice(0, 3).map(hint => boundedText(hint)) } : {}),
      artifact: { path: relative(process.cwd(), target.path).replace(/\\/g, '/'), bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') }
    }
    const output = `${JSON.stringify(summary)}\n`
    if (Buffer.byteLength(output) > SUMMARY_MAX_BYTES) {
      // The path and multibyte text may expand beyond the normal projection budget.
      const fallback = `${JSON.stringify({ ...summary, message: 'Result saved; read the artifact for details.', data: {}, error: undefined, hints: undefined })}\n`
      if (Buffer.byteLength(fallback) > SUMMARY_MAX_BYTES) throw new AppInfrastructureError('Result artifact summary exceeded its byte limit.', { stage: 'cli:result-artifact' })
      return fallback
    }
    return output
  } catch (cause) {
    throw new AppInfrastructureError('Could not save the terminal result artifact.', { stage: 'cli:result-artifact', cause })
  }
}
