import type { Step2Metadata, TranscriptionResult } from '~/types'
import { whisperBinaryPath, whisperModelsDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { runWhisperCppTranscribe } from '../run-whispercpp-core'
import type { WhisperCppTranscribeOptions } from '../run-whispercpp-core'

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
      return {
        command: whisperBinaryPath,
        args: ['-m', modelPath, ...baseArgs],
        modelDescriptor: modelPath
      }
    }
  })
