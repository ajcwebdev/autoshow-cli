import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-gemini/run-gemini-video-gen'
import { runGrokVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-grok/run-grok-video-gen'
import { runLtxVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/ltx/run-ltx-video-gen'
import { runReplicateVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/replicate-video/run-replicate-video-gen'
import { runLumalabsVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-lumalabs/run-lumalabs-video-gen'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import {
  bytesResponse,
  installMockFetch,
  jsonResponse,
  setupContractSuiteLifecycle
} from '../../../../test-utils/rest-contract-helpers'

const envKeys = ['GEMINI_API_KEY', 'XAI_API_KEY', 'LTXV_API_KEY', 'REPLICATE_API_TOKEN', 'LUMA_AGENTS_API_KEY']
const tempDirs = setupContractSuiteLifecycle({
  envKeys,
  tempPrefix: 'autoshow-video-provider-contracts-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})
export const videoBytes = new Uint8Array([9, 8, 7])
export const inlineVideo = Buffer.from(videoBytes).toString('base64')
export const defaultImageVideoPrompt = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

export const videoResponse = (): Response =>
  bytesResponse(videoBytes, { headers: { 'content-type': 'video/mp4' } })

export const withTempDir = tempDirs.withDir

export const writeMediaFixtures = async (dir: string): Promise<{ imagePath: string, lastFramePath: string, videoPath: string }> => {
  const imagePath = join(dir, 'input.png')
  const lastFramePath = join(dir, 'last.webp')
  const videoPath = join(dir, 'input.mp4')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))
  await writeFile(lastFramePath, new Uint8Array([4, 5, 6]))
  await writeFile(videoPath, new Uint8Array([7, 8, 9]))
  return { imagePath, lastFramePath, videoPath }
}

export {
  bytesResponse,
  computeActualCosts,
  installMockFetch,
  join,
  jsonResponse,
  runGeminiVideoGen,
  runGrokVideoGen,
  runLtxVideoGen,
  runLumalabsVideoGen,
  runReplicateVideoGen,
  writeFile,
  XAI_DEFAULT_BASE_URL
}
