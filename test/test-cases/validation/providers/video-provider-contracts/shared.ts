import { beforeEach, afterEach } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-gemini/run-gemini-video-gen'
import { runGrokVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-grok/run-grok-video-gen'
import { runGlmVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-glm/run-glm-video-gen'
import { runMinimaxVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-minimax/run-minimax-video-gen'
import { runRunwayVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/runway/run-runway-video-gen'
import { runLtxVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/ltx/run-ltx-video-gen'
import { runReplicateVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/replicate-video/run-replicate-video-gen'
import { runLumalabsVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/video-lumalabs/run-lumalabs-video-gen'
import { GLM_DEFAULT_BASE_URL, MINIMAX_DEFAULT_BASE_URL, XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import {
  bytesResponse,
  clearEnv,
  createTempDirTracker,
  installMockFetch,
  jsonResponse,
  restoreEnv,
  snapshotEnv
} from '../../../../test-utils/rest-contract-helpers'
import type { EnvSnapshot } from '~/types'

export const originalFetch = globalThis.fetch
export let previousEnv: EnvSnapshot = {}
export const envKeys = ['GEMINI_API_KEY', 'XAI_API_KEY', 'GLM_API_KEY', 'MINIMAX_API_KEY', 'RUNWAYML_API_SECRET', 'LTXV_API_KEY', 'REPLICATE_API_TOKEN', 'LUMA_AGENTS_API_KEY']
export const tempDirs = createTempDirTracker('autoshow-video-provider-contracts-')
export const videoBytes = new Uint8Array([9, 8, 7])
export const inlineVideo = Buffer.from(videoBytes).toString('base64')
export const defaultImageVideoPrompt = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

export const videoResponse = (): Response =>
  bytesResponse(videoBytes, { headers: { 'content-type': 'video/mp4' } })

export const transientVideoReadFailureResponse = (): Response => {
  const response = videoResponse()
  Object.defineProperty(response, 'arrayBuffer', {
    value: async () => {
      throw new TypeError('socket connection was closed unexpectedly')
    }
  })
  return response
}

export const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  return await tempDirs.withDir(fn)
}

export const writeMediaFixtures = async (dir: string): Promise<{ imagePath: string, lastFramePath: string, videoPath: string }> => {
  const imagePath = join(dir, 'input.png')
  const lastFramePath = join(dir, 'last.webp')
  const videoPath = join(dir, 'input.mp4')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))
  await writeFile(lastFramePath, new Uint8Array([4, 5, 6]))
  await writeFile(videoPath, new Uint8Array([7, 8, 9]))
  return { imagePath, lastFramePath, videoPath }
}

beforeEach(() => {
  previousEnv = snapshotEnv(envKeys)
  clearEnv(envKeys)
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreEnv(previousEnv)
  await tempDirs.cleanup()
})
export {
  bytesResponse,
  clearEnv,
  computeActualCosts,
  createTempDirTracker,
  GLM_DEFAULT_BASE_URL,
  installMockFetch,
  join,
  jsonResponse,
  MINIMAX_DEFAULT_BASE_URL,
  restoreEnv,
  runGeminiVideoGen,
  runGlmVideoGen,
  runGrokVideoGen,
  runLtxVideoGen,
  runLumalabsVideoGen,
  runMinimaxVideoGen,
  runReplicateVideoGen,
  runRunwayVideoGen,
  snapshotEnv,
  writeFile,
  XAI_DEFAULT_BASE_URL
}

export type {
  EnvSnapshot
}
