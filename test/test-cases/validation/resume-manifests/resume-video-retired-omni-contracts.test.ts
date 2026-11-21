import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { ResumeTarget, Step6VideoMetadata } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch } from '../../../test-utils/rest-contract-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'

const videoResume = getResumeHandler('video')!
const retired = { service: 'gemini', model: 'gemini-omni-1.1-flash' }
const completedVideo: Step6VideoMetadata = {
  videoGenService: 'gemini',
  videoGenModel: 'gemini-omni-1.1-flash',
  processingTime: 1,
  videoFileName: 'generated-video.mp4',
  videoFileSize: 1,
  videoDuration: 5,
  videoResolution: '720p'
}

const resumeTarget = (dir: string): ResumeTarget => ({ kind: 'video', scope: 'single', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) })

describe('video resume after the Omni 1.1 retirement', () => {
  test('a completed 1.1 run stays readable at its historical rate, and an unfinished 1.1 target cannot resume under the old name', async () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
    await withTempDir('autoshow-video-retired-omni-resume-', async (dir) => {
      const completeDir = join(dir, 'complete'), incompleteDir = join(dir, 'incomplete')
      await Promise.all([mkdir(completeDir, { recursive: true }), mkdir(incompleteDir, { recursive: true })])
      await writeSingleManifestFixture(completeDir, 'video', {
        input: 'Prompt text.', completionStatus: 'full', requestedProviders: [retired],
        providerStates: [{ ...retired, artifactDir: '.', status: 'succeeded', attempts: 1 }],
        video: [completedVideo]
      })
      await writeSingleManifestFixture(incompleteDir, 'video', {
        input: 'Prompt text.', completionStatus: 'incomplete', requestedProviders: [retired], missingProviders: [retired],
        providerStates: [{ ...retired, artifactDir: '.', status: 'missing', attempts: 0 }],
        video: []
      })

      await expect(videoResume.hasResumableWork(resumeTarget(completeDir), buildOptsFromFlags({}), new Set())).resolves.toBe(false)
      expect(computeActualCosts({ step6: completedVideo }).steps[0]).toMatchObject({ model: 'gemini-omni-1.1-flash', cost: 50, costSource: 'registry_fallback' })

      await expect(videoResume.hasResumableWork(resumeTarget(incompleteDir), buildOptsFromFlags({}), new Set())).resolves.toBe(true)
      await expect(videoResume.price(resumeTarget(incompleteDir), buildOptsFromFlags({}), new Set()))
        .rejects.toThrow('Model "gemini-omni-1.1-flash" is retired for --provider/--video gemini[=model]. Use "gemini-omni-1.2-flash" instead.')
    })
    expect(calls).toHaveLength(0)
  })
})
