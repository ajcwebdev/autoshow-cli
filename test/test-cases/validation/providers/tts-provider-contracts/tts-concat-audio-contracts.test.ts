import {
describe,
expect,
test
} from 'bun:test'
import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { configureBinDir,getConfiguredBinDir } from '~/utils/runtime-paths'
import {
setupTtsContractLifecycle
} from './shared'

const { makeTempDir } = setupTtsContractLifecycle()

describe('TTS provider service contracts', () => {
  test('concat cleanup removes the temporary list when ffmpeg fails', async () => {
      const outputDir = await makeTempDir('concat-failure-')
      const fakeFfmpegPath = join(outputDir, 'ffmpeg')
      const concatListPath = join(outputDir, 'speech-testprovider-chunks.txt')
      const previousBinDir = getConfiguredBinDir()
      await Bun.write(fakeFfmpegPath, '#!/bin/sh\nprintf "forced concat failure" >&2\nexit 7\n')
      await chmod(fakeFfmpegPath, 0o755)
      configureBinDir(outputDir)

      try {
        await expect(concatAndConvertToWav([
          join(outputDir, 'chunk-1.mp3'),
          join(outputDir, 'chunk-2.mp3')
        ], outputDir, 'TestProvider')).rejects.toThrow(
          'Failed to concatenate TestProvider audio chunks: forced concat failure'
        )
        expect(await Bun.file(concatListPath).exists()).toBe(false)
      } finally {
        configureBinDir(previousBinDir ?? '')
      }
    })
})
