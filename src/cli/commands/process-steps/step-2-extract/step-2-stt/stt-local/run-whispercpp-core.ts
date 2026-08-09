import { mkdir, rm } from 'node:fs/promises'
import type { Step2Metadata, TranscriptionResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { countTokens, formatTranscriptText } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { parseWhisperJson, extractWhisperWords } from './whisper/parse-whisper-output'
import { formatWhisperProgressMessage, parseWhisperProgressPercent } from './whisper/whisper-progress'
import { exec, fileExists } from '~/utils/cli-utils'
import { resolve } from 'node:path'
import { pollUntil } from '~/utils/retries'
import { prepareLocalSttInput } from './local-audio-normalize'
import { InfraError } from '~/utils/error-handler'

const WHISPER_JSON_WAIT_TIMEOUT_MS = 3000
const WHISPER_JSON_WAIT_POLL_MS = 100

export type WhisperCppTranscribeOptions = {
  model: string
  segmentOffsetMinutes: number
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  audioDurationSeconds?: number | undefined
  segmentStartSeconds?: number | undefined
  segmentDurationSeconds?: number | undefined
  totalDurationSeconds?: number | undefined
  preserveJson?: boolean | undefined
}

export type WhisperCppInvocation = {
  command: string
  args: string[]
  modelDescriptor: string
}

export type WhisperCppProvider = {
  name: 'whisper' | 'whisperfile'
  label: string
  tempPrefix: string
  resolveInvocation: (modelName: string, baseArgs: string[]) => Promise<WhisperCppInvocation>
}

const waitForWhisperJson = async (jsonFile: string, providerName: string): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: `${providerName}-json-output`,
      intervalMs: WHISPER_JSON_WAIT_POLL_MS,
      deadlineMs: WHISPER_JSON_WAIT_TIMEOUT_MS,
      pollFn: async () => await fileExists(jsonFile),
      isDone: (exists) => exists
    })
    return true
  } catch {
    return await fileExists(jsonFile)
  }
}

export const runWhisperCppTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: WhisperCppTranscribeOptions,
  provider: WhisperCppProvider
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { name, label, tempPrefix, resolveInvocation } = provider
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
      logSttSegmentLifecycle(l, { provider: name, action: 'started', segmentNumber, totalSegments, model: modelName })
    }
    const startTime = Date.now()
    const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
    const outputDirAbs = resolve(outputDir)
    await mkdir(outputDirAbs, { recursive: true })
    const outputBase = resolve(outputDirAbs, `transcription${segmentSuffix}`)
    preparedInput = await prepareLocalSttInput(audioPath, tempPrefix)
    const baseArgs = [
      '-f', preparedInput.audioPath,
      '-ml', '1',
      '-np',
      '-pp',
      '-of', outputBase,
      '-ojf'
    ]
    const { command, args, modelDescriptor } = await resolveInvocation(modelName, baseArgs)
    let lastLoggedProgress: number | null = null
    l.debug(formatWhisperProgressMessage(0, {
      segmentNumber,
      totalSegments,
      segmentStartSeconds,
      segmentDurationSeconds,
      totalDurationSeconds
    }))
    lastLoggedProgress = 0
    const result = await exec(command, args, {
      onStderrLine: (line) => {
        const progressPercent = parseWhisperProgressPercent(line)
        if (progressPercent === null || progressPercent === lastLoggedProgress) {
          return
        }
        lastLoggedProgress = progressPercent
        l.debug(formatWhisperProgressMessage(progressPercent, {
          segmentNumber,
          totalSegments,
          segmentStartSeconds,
          segmentDurationSeconds,
          totalDurationSeconds
        }))
      },
      retry: { operationName: `${label} transcription` }
    })
    if (result.exitCode !== 0) {
      throw InfraError(`${label} transcription failed: ${result.stderr}`, { stage: `stt:${name}` })
    }
    const jsonFile = `${outputBase}.json`
    const jsonReady = await waitForWhisperJson(jsonFile, name)
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
    let words = extractWhisperWords(jsonText, { maxEndSeconds: maxRelativeEndSeconds })
    await Bun.write(`${outputBase}.words.json`, JSON.stringify(words))
    let { text, segments } = parseWhisperJson(jsonText, { maxEndSeconds: maxRelativeEndSeconds })
    if (segmentOffsetMinutes > 0) {
      const offsetSeconds = segmentOffsetMinutes * 60
      segments = segments.map(seg => {
        const partsS = seg.start.split(':')
        const partsE = seg.end.split(':')
        const s = parseInt(partsS[0]!) * 3600 + parseInt(partsS[1]!) * 60 + parseInt(partsS[2]!) + offsetSeconds
        const e = parseInt(partsE[0]!) * 3600 + parseInt(partsE[1]!) * 60 + parseInt(partsE[2]!) + offsetSeconds
        const sh = Math.floor(s / 3600)
        const sm = Math.floor((s % 3600) / 60)
        const ss = s % 60
        const eh = Math.floor(e / 3600)
        const em = Math.floor((e % 3600) / 60)
        const es = e % 60
        return {
          ...seg,
          start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
          end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:${String(es).padStart(2, '0')}`
        }
      })
      const shiftedWords = words.map(w => ({ ...w, start: w.start + offsetSeconds, end: w.end + offsetSeconds }))
      words = shiftedWords
      await Bun.write(`${outputBase}.words.json`, JSON.stringify(shiftedWords))
    }
    if (!preserveJson) {
      await rm(jsonFile, { force: true })
    }
    const processingTime = Date.now() - startTime
    const tokenCount = countTokens(text)
    if (segmentNumber && totalSegments) {
      logSttSegmentLifecycle(l, { provider: name, action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
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
            timingSource: 'native'
          })),
          capabilities: {
            hasNativeWordTiming: true,
            hasConfidence: false,
            hasSpeakerLabels: false
          },
          timingQuality: 'native_word',
          rawResponse
        }
      },
      metadata
    }
  } catch (error) {
    l.error(`Failed to transcribe audio`, error)
    throw error
  } finally {
    await preparedInput?.cleanup()
  }
}
