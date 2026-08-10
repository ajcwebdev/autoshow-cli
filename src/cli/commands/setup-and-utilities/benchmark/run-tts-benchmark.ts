import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CLIUsageError, isCLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { loadTtsManifestMetadata } from './tts-eval-lib'
import { writeVoiceQualityReport } from '~/cli/commands/setup-and-utilities/benchmark/tts-voice-quality-report/report-writing'
import type { BenchmarkFlags, ContentType, TtsInputTextSource, TtsManifestMetadata, VoiceQualityReportMode, VoiceQualityReportOptions } from '~/types'
const DEFAULT_AUDIO_JUDGE_MODEL = 'gpt-audio'

const readTextFlagValue = async (value: string): Promise<TtsInputTextSource> => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw CLIUsageError('--tts-input-text cannot be empty')
  }

  const candidatePath = resolve(value)
  try {
    const fileStat = await stat(candidatePath)
    if (fileStat.isFile()) {
      return {
        inputTextPath: candidatePath,
        inputTextLabel: candidatePath,
      }
    }
  } catch {
  }

  return {
    inputText: value,
    inputTextLabel: '--tts-input-text',
  }
}

const resolveTtsInputText = async (
  manifestMetadata: TtsManifestMetadata,
  flags: BenchmarkFlags
): Promise<TtsInputTextSource> => {
  if (flags['tts-input-text']) {
    return await readTextFlagValue(flags['tts-input-text'])
  }

  const metadataInput = manifestMetadata.input?.trim()
  if (metadataInput) {
    return {
      inputText: metadataInput,
      inputTextLabel: 'metadata.input',
    }
  }

  throw CLIUsageError(
    'TTS benchmark source text is missing. manifest.json does not contain item metadata.input; pass --tts-input-text with the original text or a text file path.'
  )
}

const resolveTtsMode = (value: string | undefined): VoiceQualityReportMode => {
  const mode = value ?? 'full'
  if (mode !== 'local' && mode !== 'full') {
    throw CLIUsageError(`Invalid --tts-mode value "${mode}". Expected "local" or "full".`)
  }
  return mode
}

const loadBenchmarkTtsManifest = async (runDir: string): Promise<TtsManifestMetadata> => {
  try {
    const dirStat = await stat(runDir)
    if (!dirStat.isDirectory()) {
      throw CLIUsageError(`TTS benchmark input must be a run directory: ${runDir}`)
    }
  } catch (error) {
    if (isCLIUsageError(error)) {
      throw error
    }
    throw CLIUsageError(`TTS run directory not found: ${runDir}`)
  }

  try {
    return await loadTtsManifestMetadata(runDir)
  } catch (error) {
    throw CLIUsageError(error instanceof Error ? error.message : String(error))
  }
}

export const runTtsBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('TTS run directory is required. Usage: bun autoshow benchmark <tts-run-dir> --tts')
  }

  const runDir = resolve(input)
  const manifestMetadata = await loadBenchmarkTtsManifest(runDir)
  const mode = resolveTtsMode(flags['tts-mode'])
  const contentType: ContentType = 'default'
  const inputTextSource = await resolveTtsInputText(manifestMetadata, flags)

  const options: VoiceQualityReportOptions = {
    runDir,
    ...('inputTextPath' in inputTextSource ? { inputTextPath: inputTextSource.inputTextPath } : {}),
    ...('inputText' in inputTextSource ? { inputText: inputTextSource.inputText } : {}),
    inputTextLabel: inputTextSource.inputTextLabel,
    mode,
    allowPaid: mode === 'full',
    metricFixturesPath: flags['tts-metric-fixtures'] ? resolve(flags['tts-metric-fixtures']) : null,
    roundtripDir: flags['tts-roundtrip-dir'] ? resolve(flags['tts-roundtrip-dir']) : null,
    markdownOut: null,
    jsonOut: null,
    keepTemp: flags['tts-keep-temp'] === true,
    audioJudgeModel: flags['tts-audio-judge-model'] ?? DEFAULT_AUDIO_JUDGE_MODEL,
    contentType,
  }

  const { jsonOut, markdownOut, warnings } = await writeVoiceQualityReport(options)

  l.write('info', 'TTS Benchmark Report', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['mode', mode],
      ['providers', manifestMetadata.tts.length],
      ['json', jsonOut],
      ['markdown', markdownOut],
      ['warnings', warnings.length],
    ]),
    metadata: {
      runDir,
      mode,
      providerCount: manifestMetadata.tts.length,
      jsonOut,
      markdownOut,
      warningCount: warnings.length,
    },
  })
}
