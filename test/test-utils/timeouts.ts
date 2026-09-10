export const VALIDATION_TEST_TIMEOUT_MS = 10 * 60_000
const HOSTED_E2E_TEST_TIMEOUT_MS = 20 * 60_000
export const LONG_E2E_TEST_TIMEOUT_MS = 2 * 60 * 60_000
export const E2E_TEST_TIMEOUT_MS = HOSTED_E2E_TEST_TIMEOUT_MS

export const isLongRunningTestFile = (file: string): boolean => {
  const normalized = file.replace(/\\/g, '/')
  return /\/local\/stt\/whisper(file)?\//.test(normalized)
    || normalized.includes('/e2e/service/visuals/video/')
    || normalized.includes('/e2e/local/audio/music/')
    || normalized.endsWith('/transcript-video-contracts.test.ts')
}
