import { whisperfileBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { toTimestamp } from '../../stt-utils/stt-utils'
import { mkdir, rm, rename } from 'node:fs/promises'
import type { Step2Metadata, TranscriptionResult, WhisperfileTranscribeOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logSttSegmentLifecycle } from '~/cli/commands/stt/stt-logging'
import { countTokens, formatTranscriptText } from '~/cli/commands/stt/stt-utils/stt-utils'
import { parseWhisperfileJson, extractWhisperfileWords } from './parse-whisperfile-output'
import { formatWhisperfileProgressMessage, parseWhisperfileProgressPercent } from './whisperfile-progress'
import { exec, fileExists } from '~/utils/cli-utils'
import { resolve } from 'node:path'
import { pollUntil } from '~/utils/retries'
import { prepareLocalSttInput } from '../local-audio-normalize'
import { InfraError, ValidationError, isRetryExhaustedError } from '~/utils/error-handler'

export const selectWhisperfileCaptionArgs = (help: string, nativeSubtitles = false): string[] => [
  ...(help.includes('-sow') || help.includes('--split-on-word') ? ['-sow'] : []),
  ...(nativeSubtitles ? ['-osrt', '-ovtt', '-olrc'].filter(flag => help.includes(flag)) : [])
]

const WHISPERFILE_JSON_WAIT_TIMEOUT_MS = 3000
const WHISPERFILE_JSON_WAIT_POLL_MS = 100

const waitForWhisperfileJson = async (jsonFile: string, providerName: string): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: `${providerName}-json-output`,
      intervalMs: WHISPERFILE_JSON_WAIT_POLL_MS,
      deadlineMs: WHISPERFILE_JSON_WAIT_TIMEOUT_MS,
      pollFn: async () => await fileExists(jsonFile),
      isDone: (exists) => exists
    })
    return true
  } catch (error) {
    if (!isRetryExhaustedError(error)) throw error
    return await fileExists(jsonFile)
  }
}

export const transcribeWhisperfile = async (
  audioPath: string,
  outputDir: string,
  options: WhisperfileTranscribeOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const name = 'whisperfile'
  const label = 'Whisperfile'
  const tempPrefix = 'autoshow-whisperfile-'
  const resolveInvocation = async (model: string, args: string[]) => ({ command: 'sh', args: [whisperfileBinaryPath(model), ...args], modelDescriptor: whisperfileBinaryPath(model) })
  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    segmentStartSeconds,
    segmentDurationSeconds,
    totalDurationSeconds,
    preserveJson = false
  } = options
  let preparedInput: Awaited<ReturnType<typeof prepareLocalSttInput>> | undefined

  try {
    if (segmentNumber && totalSegments) {
      logSttSegmentLifecycle( { provider: name, action: 'started', segmentNumber, totalSegments, model: modelName })
    }
    const startTime = Date.now()
    const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
    const outputDirAbs = resolve(outputDir)
    await mkdir(outputDirAbs, { recursive: true })
    const outputBase = resolve(outputDirAbs, `transcription${segmentSuffix}`)
    const helpInvocation = await resolveInvocation(modelName, ['--help'])
    const helpOutput = await exec(helpInvocation.command, helpInvocation.args, { signal: AbortSignal.timeout(15_000), maxBufferBytes: 128 * 1024 })
      .then(result => result.stdout + result.stderr)
      .catch(() => '')
    const captionArgs = selectWhisperfileCaptionArgs(helpOutput, options.nativeSubtitles)
    if (options.dtwPreset && !/(?:^|\s)(?:-dtw|--dtw)(?:\s|$)/m.test(helpOutput)) throw ValidationError(`${label} does not advertise DTW support in its installed help output.`)
    preparedInput = await prepareLocalSttInput(audioPath, tempPrefix, {
      passthroughExtensions: ['.wav', '.mp3', '.flac', '.ogg'],
      convertFormat: 'mp3'
    })
    const baseArgs = [
      '-f', preparedInput.audioPath,
      '-ml', '1',
      '-np',
      '-pp',
      '-of', outputBase,
      '-ojf',
      ...(options.dtwPreset ? ['--dtw', options.dtwPreset] : []),
      ...captionArgs
    ]
    const { command, args, modelDescriptor } = await resolveInvocation(modelName, baseArgs)
    await Bun.write(outputBase + '.engine.json', JSON.stringify({ provider: name, model: modelName, modelDescriptor, command, args, captionArgs, help: helpOutput }, null, 2) + '\n')
    let lastLoggedProgress: number | null = null
    l.debug(formatWhisperfileProgressMessage(0, {
      segmentNumber,
      totalSegments,
      segmentStartSeconds,
      segmentDurationSeconds,
      totalDurationSeconds
    }), { category: 'pipeline' })
    lastLoggedProgress = 0
    const result = await exec(command, args, {
      onStderrLine: (line) => {
        const progressPercent = parseWhisperfileProgressPercent(line)
        if (progressPercent === null || progressPercent === lastLoggedProgress) {
          return
        }
        lastLoggedProgress = progressPercent
        l.debug(formatWhisperfileProgressMessage(progressPercent, {
          segmentNumber,
          totalSegments,
          segmentStartSeconds,
          segmentDurationSeconds,
          totalDurationSeconds
        }), { category: 'pipeline' })
      }
    })
    if (result.exitCode !== 0) {
      throw InfraError(`${label} transcription failed: ${result.stderr}`, { stage: `stt:${name}` })
    }
    const jsonFile = `${outputBase}.json`
    const jsonReady = await waitForWhisperfileJson(jsonFile, name)
    if (!jsonReady) {
      const commandOutput = result.stderr.trim() || result.stdout.trim()
      const outputDirExists = await fileExists(outputDirAbs)
      throw InfraError(
        commandOutput.length > 0
          ? `${label} transcription completed but no JSON output was produced at ${jsonFile} (output dir exists: ${outputDirExists}). Command output:\n${commandOutput}`
          : `${label} transcription completed but no JSON output was produced at ${jsonFile} (output dir exists: ${outputDirExists})`,
        { stage: `stt:${name}` }
      )
    }
    const jsonText = await Bun.file(jsonFile).text()
    const rawResponse = JSON.parse(jsonText) as unknown
    const maxRelativeEndSeconds = segmentDurationSeconds ?? audioDurationSeconds ?? totalDurationSeconds
    let words = extractWhisperfileWords(jsonText, { maxEndSeconds: maxRelativeEndSeconds })
    await Bun.write(`${outputBase}.words.json`, JSON.stringify(words))
    let { text, segments } = parseWhisperfileJson(jsonText, { maxEndSeconds: maxRelativeEndSeconds })
    if (segmentOffsetMinutes > 0) {
      const offsetSeconds = segmentOffsetMinutes * 60
      segments = segments.map(seg => {
        const toSeconds = (stamp: string): number => {
          const [hours, minutes, seconds] = stamp.replace(',', '.').split(':').map(Number)
          return hours! * 3600 + minutes! * 60 + seconds!
        }
        return { ...seg, start: toTimestamp(toSeconds(seg.start) + offsetSeconds), end: toTimestamp(toSeconds(seg.end) + offsetSeconds) }

      })
      const shiftedWords = words.map(w => ({ ...w, start: w.start + offsetSeconds, end: w.end + offsetSeconds }))
      words = shiftedWords
      await Bun.write(`${outputBase}.words.json`, JSON.stringify(shiftedWords))
    }
    if (!preserveJson) {
      await rm(jsonFile, { force: true })
    }
    if (options.nativeSubtitles) for (const format of ['srt', 'vtt', 'lrc']) {
      if (await fileExists(outputBase + '.' + format)) await rename(outputBase + '.' + format, outputBase + '.native.' + format)
    }
    const processingTime = Date.now() - startTime
    const tokenCount = countTokens(text)
    if (segmentNumber && totalSegments) {
      logSttSegmentLifecycle( { provider: name, action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
    }
    await Bun.write(`${outputBase}.txt`, formatTranscriptText(segments))
    const metadata: Step2Metadata = {
      transcriptionService: name,
      transcriptionModel: modelDescriptor,
      processingTime,
      tokenCount
    }
    return {
      result: {
        text,
        segments,
        evidence: {
          words: words.map((word) => ({
            startSeconds: word.start,
            endSeconds: word.end,
            text: word.word,
            normalized: word.word.toLowerCase(),
            ...(word.confidence !== undefined ? { confidence: word.confidence } : {}),
            timingSource: word.repaired ? 'repaired' : 'token_derived'
          })),
          capabilities: {
            hasNativeWordTiming: words.some(word => !word.repaired && word.end > word.start),
            hasConfidence: words.some(word => word.confidence !== undefined),
            hasSpeakerLabels: false
          },
          timingQuality: words.some(word => word.repaired) ? 'mixed' : words.length > 0 ? 'native_word' : 'coarse',
          rawResponse
        }
      },
      metadata
    }
  } finally {
    await preparedInput?.cleanup()
  }
}
