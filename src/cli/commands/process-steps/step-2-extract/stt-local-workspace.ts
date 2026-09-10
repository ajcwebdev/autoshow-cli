import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getOutputRootAbsolute } from '../output-root'
import { resolveRunDirectory } from '../run-dir'
import { parseStoredTranscriptionResult } from './step-2-stt/stt-utils/stt-result-artifacts'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { exec } from '~/utils/cli-utils'

export const requireLocalTimingFile = async (input: string | undefined): Promise<string> => {
  if (!input || /^https?:/i.test(input) || !(await stat(input).catch(() => undefined))?.isFile()) throw UsageError('This timing operation requires an existing local file.')
  return resolve(input)
}

export const readLocalTimingResult = async (input: string | undefined) => {
  const source = await requireLocalTimingFile(input)
  const raw = await Bun.file(source).text()
  const data: unknown = JSON.parse(raw)
  const result = parseStoredTranscriptionResult(data)
  if (!result) throw ValidationError(`Invalid saved transcription result: ${source}`)
  return { source, result, data, sha256: new Bun.CryptoHasher('sha256').update(raw).digest('hex') }
}

export const localTimingOutput = (label: string): string => resolve(resolveRunDirectory(getOutputRootAbsolute(), label, label))

export const hashLocalTimingFile = async (path: string): Promise<string> => {
  const hash = new Bun.CryptoHasher('sha256')
  for await (const bytes of Bun.file(path).stream()) hash.update(bytes)
  return hash.digest('hex')
}

export const writeLocalTimingFiles = async (output: string, artifacts: Record<string, unknown>): Promise<Record<string, string>> => {
  const entries = Object.entries(artifacts)
  for (const [name] of entries) if (await stat(join(output, name)).catch(() => undefined)) throw ValidationError(`Refusing to overwrite ${join(output, name)}; choose a new --output-dir.`)
  await mkdir(output, { recursive: true })
  for (const [name, value] of entries) await writeFile(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' })
  return Object.fromEntries(entries.map(([name]) => [name, name]))
}

export const runTimingCommand = async (command: string, args: string[], maxBufferBytes = 8 * 1024 * 1024): Promise<string> => {
  const result = await exec(command, args, { signal: AbortSignal.timeout(10 * 60_000), maxBufferBytes })
  if (result.exitCode !== 0) throw ValidationError(`Local timing command failed (${result.exitCode}): ${result.stderr.trim().slice(-4000)}`)
  return result.stdout
}
