import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

export const setupGeminiRestContractFixture = () => {
  const tempDirs = setupContractSuiteLifecycle({
    envKeys: ['GEMINI_API_KEY'],
    tempPrefix: 'autoshow-gemini-rest-'
  })
  const audioBytes = new Uint8Array([1, 2, 3, 4])
  return {
    withTempDir: tempDirs.withDir,
    audioBytes,
    audioBase64: Buffer.from(audioBytes).toString('base64'),
    videoBytes: new Uint8Array([5, 4, 3, 2])
  }
}
