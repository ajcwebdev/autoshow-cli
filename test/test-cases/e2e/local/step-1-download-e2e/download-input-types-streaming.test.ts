import { expect } from 'bun:test'

import {
  defineSingleCaseTest,
  setupDownloadInputTypeLifecycle,
} from './download-input-types.shared'
import type { DownloadE2eSingleCase } from '~/types'
import { expectArtifact } from '../../../../test-utils/value-assertions'

const singleCases: DownloadE2eSingleCase[] = [
  {
    name: 'download YouTube video URL input',
    input: 'https://www.youtube.com/watch?v=u1-WHqATSQU',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      expect(metadata.step1?.title).toBeDefined()
      expect(metadata.step1?.channel).toBeDefined()
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      await expectArtifact(audioPath)
    },
  },
  {
    name: 'download Twitch video URL input',
    input: 'https://www.twitch.tv/videos/1844440442',
    checks: async (metadata, outputDir) => {
      expect(metadata.step1?.audioFileName).toBeDefined()
      expect((metadata.step1?.audioFileSize ?? 0) > 0).toBe(true)
      const audioPath = `${outputDir}/${metadata.step1?.audioFileName ?? ''}`
      await expectArtifact(audioPath)
    },
  },
]

setupDownloadInputTypeLifecycle([])

for (const tc of singleCases) {
  defineSingleCaseTest(tc)
}
