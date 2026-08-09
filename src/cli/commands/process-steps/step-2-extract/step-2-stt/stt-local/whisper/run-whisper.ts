import type { Step2Metadata, TranscriptionResult } from '~/types'
import { fileExists } from '~/utils/cli-utils'
import { whisperBinaryPath, whisperModelsDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { runWhisperCppTranscribe } from '../run-whispercpp-core'
import type { WhisperCppTranscribeOptions } from '../run-whispercpp-core'

const coremlEncoderLookupCache = new Map<string, Promise<string | null>>()

const detectCoreMLEncoder = async (modelName: string): Promise<string | null> => {
  const cached = coremlEncoderLookupCache.get(modelName)
  if (cached) {
    return await cached
  }

  const modelsDir = whisperModelsDir
  const candidates = [
    `${modelsDir}/ggml-${modelName}-encoder.mlmodelc`,
    `${modelsDir}/ggml-${modelName}-encoder.mlpackage`
  ]
  const lookup = Promise.all(candidates.map(p => fileExists(p))).then(checks => {
    const idx = checks.findIndex(ok => ok)
    return idx >= 0 ? candidates[idx]! : null
  })
  coremlEncoderLookupCache.set(modelName, lookup)
  return await lookup
}

export const runWhisperTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: WhisperCppTranscribeOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> =>
  await runWhisperCppTranscribe(audioPath, outputDir, options, {
    name: 'whisper',
    label: 'Whisper',
    tempPrefix: 'autoshow-whisper-',
    resolveInvocation: async (modelName, baseArgs) => {
      const modelPath = `${whisperModelsDir}/ggml-${modelName}.bin`
      const coreMLEncoderPath = await detectCoreMLEncoder(modelName)
      const descriptorParts = [modelPath]
      if (coreMLEncoderPath) descriptorParts.push(`coreml:${coreMLEncoderPath}`)
      return {
        command: whisperBinaryPath,
        args: ['-m', modelPath, ...baseArgs],
        modelDescriptor: descriptorParts.join(' | ')
      }
    }
  })
