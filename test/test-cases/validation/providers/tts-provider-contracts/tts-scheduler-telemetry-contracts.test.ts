import {
describe,
expect,
test
} from 'bun:test'
import { runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'

describe('TTS provider service contracts', () => {

  test('hosted TTS scheduler records provider and job telemetry', async () => {
      const scheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate' })

      await runTtsChunks(['a', 'b', 'c'], async (chunk) => chunk, {
        provider: 'grok',
        scheduler,
        job: { jobId: 'job-a', inputIndex: 0, targetIndex: 0 }
      })

      const telemetry = scheduler.getTelemetry()
      expect(telemetry.providers).toHaveLength(1)
      expect(telemetry.providers[0]).toMatchObject({
        provider: 'grok',
        maxLimit: 2,
        startedChunks: 3,
        completedChunks: 3,
        failedChunks: 0,
        maxActive: 2
      })
      expect(telemetry.providers[0]?.queueWait.p95Ms).toBeGreaterThanOrEqual(0)
      expect(telemetry.jobs).toHaveLength(1)
      expect(telemetry.jobs[0]).toMatchObject({
        provider: 'grok',
        jobId: 'job-a',
        chunkCount: 3,
        completedChunks: 3,
        inputIndex: 0,
        targetIndex: 0
      })
    })
})
