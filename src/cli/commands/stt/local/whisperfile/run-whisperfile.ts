import type { Step2Metadata, TranscriptionResult, WhisperCppTranscribeOptions } from '~/types'
import { whisperfileBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { runWhisperCppTranscribe } from '../run-whispercpp-core'

export const runWhisperfileTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: WhisperCppTranscribeOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> =>
  await runWhisperCppTranscribe(audioPath, outputDir, options, {
    name: 'whisperfile',
    label: 'Whisperfile',
    tempPrefix: 'autoshow-whisperfile-',
    resolveInvocation: async (modelName, baseArgs) => {
      const whisperfileBinary = whisperfileBinaryPath(modelName)
      return {
        command: 'sh',
        args: [whisperfileBinary, ...baseArgs],
        modelDescriptor: whisperfileBinary
      }
    }
  })
