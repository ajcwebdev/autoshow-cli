import type { Step2Metadata, TranscriptionResult } from '~/types'
import { whisperfileBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { runWhisperCppTranscribe } from '../run-whispercpp-core'
import type { WhisperCppTranscribeOptions } from '../run-whispercpp-core'

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
        // Weights are embedded in the packaged whisperfile, so no -m flag is passed.
        // whisperfiles are Cosmopolitan APE binaries; macOS posix_spawn cannot exec
        // them directly, so launch through a shell that reads the self-extracting
        // script (see whisperfile troubleshooting docs).
        command: 'sh',
        args: [whisperfileBinary, ...baseArgs],
        modelDescriptor: whisperfileBinary
      }
    }
  })
