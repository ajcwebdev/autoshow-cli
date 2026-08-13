import { resolve } from 'node:path'
import type { KittenTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { TtsScriptOutputSchema } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { exec } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import { kittenTtsUvEnvDir } from './kitten-tts'
import {
  resolveKittenTtsModelId
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { InfraError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

const SCRIPT_PATH = resolve(import.meta.dir, 'kitten-scripts/run-kitten-tts.py')
const KITTEN_TTS_CHUNK_CHARS = TTS_CHUNK_CHARACTER_LIMITS.kitten

export const runKittenTts = async (
  text: string,
  outputDir: string,
  options: { model: KittenTtsModel, speaker: string, maxChunkChars?: number | undefined, abortSignal?: AbortSignal | undefined, requestEvidence?: TtsRequestEvidenceScope | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  options.abortSignal?.throwIfAborted()
  const hfModelId = resolveKittenTtsModelId(options.model)
  const audioPath = `${outputDir}/speech.wav`
  const textPath = `${outputDir}/tts-input.txt`
  const pythonPath = `${kittenTtsUvEnvDir}/bin/python`
  const maxChunkChars = options.maxChunkChars ?? KITTEN_TTS_CHUNK_CHARS

  logTtsConfig('Kitten', [
    { label: 'model', value: hfModelId },
    { label: 'voice', value: options.speaker },
    { label: 'chunk size', value: maxChunkChars }
  ])

  await Bun.write(textPath, text)

  const startTime = Date.now()

  logMediaGenerationStatus(l, {
    mediaType: 'tts',
    provider: 'kitten',
    model: options.model,
    status: 'started',
    detail: `speaker: ${options.speaker}`
  })
  const commandArgs = [
    SCRIPT_PATH,
    '--model', hfModelId,
    '--input', textPath,
    '--output', audioPath,
    '--voice', options.speaker,
    '--max-chunk-chars', String(maxChunkChars)
  ]
  const result = await dispatchTtsProviderRequest(options.requestEvidence, {
    chunkIndex: 1,
    endpointKind: 'local-runner',
    serializerVersion: 'kitten.tts.phase-0-v1',
    serializedRequest: { executable: pythonPath, args: commandArgs },
    providerText: text,
    voiceField: 'argv.--voice',
    voices: [{ kind: 'local-model-voice', value: options.speaker }],
    requestControls: { maxChunkChars },
    continuation: { kind: 'none' }
  }, { attempt: 1 }, async () => {
    const execution = await exec(pythonPath, commandArgs, {
      retry: { operationName: 'Kitten TTS synthesis' },
      signal: options.abortSignal
    })
    if (execution.exitCode !== 0) {
      const stderr = execution.stderr.trim()
      if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
        throw InfraError(
          `Kitten TTS not installed. Run: bun autoshow setup\n${stderr}`,
          { stage: 'tts:kitten', hints: ["Run 'bun autoshow setup' to install Kitten TTS and other dependencies"] }
        )
      }
      throw InfraError(`Kitten TTS exited with code ${execution.exitCode}: ${stderr}`, { stage: 'tts:kitten' })
    }
    return execution
  })
  options.abortSignal?.throwIfAborted()

  if (result.stderr) {
    const stderrLines = result.stderr.split('\n').filter((line: string) => line.trim())
    for (const line of stderrLines) {
      if (
        line.includes('ERROR') ||
        line.includes('Traceback') ||
        line.includes('File "') ||
        line.includes('Error:')
      ) {
        l.error(`TTS stderr: ${line}`)
      } else if (line.startsWith('[kitten-tts]')) {
        l.debug(line)
      }
    }
  }

  if (result.stdout && result.stdout.includes('Traceback')) {
    l.error(`Python error in TTS stdout`)
    result.stdout.split('\n').forEach((line: string) => {
      if (line.trim()) l.error(line)
    })
    throw InfraError('Kitten TTS failed with a Python error', { stage: 'tts:kitten' })
  }

  await options.requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
  await options.requestEvidence?.complete({ chunkIndex: 1 })

  const lastLine = result.stdout.trim().split('\n').pop() ?? ''
  let chunkCount = 1
  if (lastLine.startsWith('{')) {
    try {
      const scriptOutput = validateData(TtsScriptOutputSchema, JSON.parse(lastLine), 'TTS script output')
      chunkCount = scriptOutput.chunkCount
      l.debug(`Generated ${scriptOutput.durationSeconds}s of audio in ${scriptOutput.chunkCount} chunk(s)`)
    } catch {
      l.warn('Could not parse Kitten TTS script metadata from stdout')
    }
  }

  return finalizeTtsRun({
    service: 'kitten',
    model: options.model,
    speaker: options.speaker,
    audioPath,
    chunkCount,
    startTime
  })
}
