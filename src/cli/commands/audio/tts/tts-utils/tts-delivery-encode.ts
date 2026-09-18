import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { TtsDeliveryChapter, TtsExportFormat, TtsExportOptions } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError, UsageError } from '~/utils/error-handler'
import { DEFAULT_TTS_EXPORT_BITRATE_KBPS } from './tts-delivery-profile'

const DETERMINISTIC_ARGS = ['-hide_banner', '-nostats', '-loglevel', 'error', '-threads', '1']

export const ttsExportExtension = (format: TtsExportFormat): string => `.${format}`

const escapeFfmetadata = (value: string): string => value.replace(/[=;#\\\n]/gu, (match) => `\\${match}`)

export const buildTtsFfmetadata = (
  metadata: Readonly<Record<string, string>> | undefined,
  chapters: readonly TtsDeliveryChapter[]
): string => [
  ';FFMETADATA1',
  ...Object.entries(metadata ?? {}).map(([key, value]) => `${key}=${escapeFfmetadata(value)}`),
  ...chapters.flatMap((chapter) => [
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    `START=${Math.round(chapter.startMs)}`,
    `END=${Math.round(chapter.endMs)}`,
    `title=${escapeFfmetadata(chapter.title)}`,
  ]),
  '',
].join('\n')

const codecArgs = (format: TtsExportFormat, bitrateKbps: number | undefined): string[] => {
  const bitrate = `${bitrateKbps ?? DEFAULT_TTS_EXPORT_BITRATE_KBPS[format] ?? 128}k`
  switch (format) {
    case 'wav': return ['-c:a', 'pcm_s16le', '-rf64', 'auto', '-f', 'wav']
    case 'flac': return ['-c:a', 'flac', '-compression_level', '8', '-f', 'flac']
    case 'mp3': return ['-c:a', 'libmp3lame', '-b:a', bitrate, '-id3v2_version', '3', '-write_xing', '1', '-f', 'mp3']
    case 'm4a': return ['-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart', '-f', 'ipod']
    case 'm4b': return ['-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart', '-f', 'ipod']
  }
}

// Exports are derived from mastered WAV audio and sit outside render identity: retagging or
// re-encoding never creates a render or a provider request.
export const encodeTtsDelivery = async (input: {
  sourcePaths: readonly string[]
  outputPath: string
  options: Pick<TtsExportOptions, 'format' | 'bitrateKbps' | 'metadata' | 'coverPath'>
  chapters?: readonly TtsDeliveryChapter[] | undefined
  abortSignal?: AbortSignal | undefined
}): Promise<string> => {
  if (input.sourcePaths.length === 0) throw UsageError('TTS delivery export requires at least one mastered audio file.')
  const { format, coverPath } = input.options
  if (coverPath && format === 'wav') throw UsageError('WAV delivery cannot embed cover art.')
  if (coverPath && !(await Bun.file(coverPath).exists())) throw UsageError(`TTS cover image was not found: ${coverPath}`)
  const listPath = `${input.outputPath}.sources.txt`
  const metadataPath = `${input.outputPath}.ffmeta`
  await Bun.write(listPath, `${input.sourcePaths.map((path) => `file '${resolve(path).replace(/'/g, `'\\''`)}'`).join('\n')}\n`)
  await Bun.write(metadataPath, buildTtsFfmetadata(input.options.metadata, input.chapters ?? []))
  const coverInput = coverPath ? ['-i', coverPath] : []
  const coverMapping = coverPath
    ? ['-map', '2:v:0', '-c:v', 'copy', '-disposition:v:0', 'attached_pic', ...(format === 'mp3' ? ['-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)'] : [])]
    : ['-vn']
  try {
    input.abortSignal?.throwIfAborted()
    const result = await exec(getFfmpegBinary(), [
      ...DETERMINISTIC_ARGS,
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-f', 'ffmetadata', '-i', metadataPath,
      ...coverInput,
      '-map', '0:a:0',
      ...coverMapping,
      '-map_metadata', '1',
      '-map_chapters', '1',
      ...codecArgs(format, input.options.bitrateKbps),
      '-bitexact',
      '-y', input.outputPath,
    ], { signal: input.abortSignal })
    if (result.exitCode !== 0) {
      await rm(input.outputPath, { force: true }).catch(() => {})
      throw InfraError(`Failed to export TTS delivery audio as ${format}: ${result.stderr.trim()}`, { stage: 'tts:delivery-encode' })
    }
    return input.outputPath
  } finally {
    await rm(listPath, { force: true }).catch(() => {})
    await rm(metadataPath, { force: true }).catch(() => {})
  }
}
