import { describe, expect, test } from 'bun:test'
import { mergeCompletedSttProviderMetadata } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/process-stt/single-provider-completion'
import { ASYNC_STT_PROGRESS_METADATA_KEY } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import type { Step2Metadata } from '~/types'
import { readCanonicalRecord, writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'

describe('single-provider STT canonical projection', () => {
  test('retains lifecycle progress while projecting final transcription identity', async () => {
    await withTempDir('autoshow-single-stt-projection-', async (outputDir) => {
      const runtime = {
        mode: 'fresh' as const,
        stage: 'completed' as const,
        remoteJobId: 'job-1',
        completedAt: '2026-08-13T12:00:00.000Z'
      }
      const completedMetadata: Step2Metadata = {
        transcriptionService: 'soniox',
        transcriptionModel: 'stt-rt-v4',
        processingTime: 123,
        tokenCount: 42,
        runtime
      }
      const metadata = mergeCompletedSttProviderMetadata({
        [ASYNC_STT_PROGRESS_METADATA_KEY]: {
          whole: {
            transcriptionService: 'soniox',
            transcriptionModel: 'stt-rt-v4',
            processingTime: 100,
            tokenCount: 0,
            runtime
          }
        }
      }, completedMetadata)

      await writeSingleManifestFixture(outputDir, 'extract', {
        completionStatus: 'full',
        requestedProviders: [{ service: 'soniox', model: 'stt-rt-v4', local: false }],
        providerStates: [{
          service: 'soniox',
          model: 'stt-rt-v4',
          local: false,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1,
          metadata,
          result: { text: 'Completed transcript', segments: [] }
        }],
        missingProviders: []
      }, { extractRoute: 'media' })

      const projected = await readCanonicalRecord(outputDir)
      expect(projected['step2']).toMatchObject({
        transcriptionService: 'soniox',
        transcriptionModel: 'stt-rt-v4',
        processingTime: 123,
        tokenCount: 42,
        [ASYNC_STT_PROGRESS_METADATA_KEY]: {
          whole: { runtime }
        }
      })
    })
  })
})
