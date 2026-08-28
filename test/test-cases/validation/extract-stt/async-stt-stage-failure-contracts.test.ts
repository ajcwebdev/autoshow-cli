import { describe,expect,test } from 'bun:test'
import { runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import type { MatrixOptions,MatrixStatus,Step2Metadata,Step2RuntimeMetadata } from '~/types'

describe('async STT resume contracts', () => {

    const createMatrixOptions = (
      overrides: Partial<MatrixOptions> = {}
    ): MatrixOptions => ({
      outputDir: '.',
      providerService: 'assemblyai',
      providerLogLabel: 'matrix',
      providerDisplayName: 'Matrix',
      modelName: 'synthetic',
      startTime: Date.now() - 100,
      initialPollIntervalMs: 1,
      maxPollIntervalMs: 1,
      createJob: async () => ({ jobId: 'job-1', status: { state: 'queued' } }),
      pollJob: async () => ({ status: { state: 'completed' }, retryAfterMs: null }),
      getTranscript: async () => ({ text: 'done' }),
      isComplete: (status) => status.state === 'completed',
      isFailed: () => undefined,
      buildDeadlineError: () => { throw new Error('deadline') },
      buildResumeProbeError: () => { throw new Error('resume probe') },
      buildResult: async ({ transcript, runtime, processingTime, timings }) => ({
        result: { text: transcript.text, segments: [] },
        metadata: {
          transcriptionService: 'assemblyai',
          transcriptionModel: 'synthetic',
          processingTime,
          tokenCount: 1,
          runtime,
          ...(timings ? { timings } : {})
        }
      }),
      ...overrides
    })

    const asyncSttStageFailureMatrix: Array<{
      stage: string
      expectedOutcome: string
      verify: () => Promise<void>
    }> = [
      {
        stage: 'fresh setup / optional upload failure',
        expectedOutcome: 'does not create, persist, or invoke cleanup policy without a remote job',
        verify: async () => {
          const events: string[] = []
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async () => { events.push('persist') }
            },
            uploadAsset: async () => {
              events.push('upload')
              throw new Error('upload failed')
            },
            createJob: async () => {
              events.push('create')
              return { jobId: 'unexpected' }
            },
            cleanup: {
              shouldDelete: () => {
                events.push('cleanup-policy')
                return true
              }
            }
          }))).rejects.toThrow('upload failed')
          expect(events).toEqual(['upload'])
        }
      },
      {
        stage: 'fresh setup / create failure',
        expectedOutcome: 'retains the provider error and does not invent resumable job metadata',
        verify: async () => {
          const writes: Step2RuntimeMetadata[] = []
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async (_key, metadata) => {
                if (metadata.runtime) writes.push(metadata.runtime)
              }
            },
            uploadAsset: async () => ({ value: 'asset-1', remoteAssetId: 'asset-1' }),
            createJob: async () => { throw new Error('create failed') }
          }))).rejects.toThrow('create failed')
          expect(writes).toEqual([])
        }
      },
      {
        stage: 'resumed setup / progress persistence failure',
        expectedOutcome: 'does not upload or create a duplicate remote job',
        verify: async () => {
          const events: string[] = []
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              readProgressMetadata: async () => ({
                transcriptionService: 'assemblyai',
                transcriptionModel: 'synthetic',
                runtime: {
                  mode: 'fresh',
                  stage: 'polling',
                  remoteJobId: 'resumed-job'
                }
              }),
              writeProgressMetadata: async () => {
                events.push('persist-resumed')
                throw new Error('resume persistence failed')
              }
            },
            uploadAsset: async () => {
              events.push('upload')
              return { value: 'unexpected' }
            },
            createJob: async () => {
              events.push('create')
              return { jobId: 'unexpected' }
            },
            pollJob: async () => {
              events.push('poll')
              return { status: { state: 'completed' }, retryAfterMs: null }
            }
          }))).rejects.toThrow('resume persistence failed')
          expect(events).toEqual(['persist-resumed'])
        }
      },
      {
        stage: 'polling / provider request failure',
        expectedOutcome: 'keeps polling runtime resumable and does not delete a non-terminal job',
        verify: async () => {
          const writes: Step2RuntimeMetadata[] = []
          const cleanupInputs: Array<{ status: MatrixStatus | undefined, stage: string | undefined }> = []
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async (_key, metadata) => {
                if (metadata.runtime) writes.push(metadata.runtime)
              }
            },
            pollJob: async () => { throw new Error('poll request failed') },
            cleanup: {
              shouldDelete: ({ lastKnownStatus, runtime }) => {
                cleanupInputs.push({ status: lastKnownStatus, stage: runtime?.stage })
                return false
              },
              deleteJob: async () => true
            }
          }))).rejects.toThrow('poll request failed')
          expect(cleanupInputs).toEqual([{ status: { state: 'queued' }, stage: 'polling' }])
          expect(writes.map((runtime) => runtime.stage)).toEqual(['polling', 'polling'])
          expect(writes.at(-1)?.cleanup).toEqual({})
        }
      },
      {
        stage: 'polling / progress persistence failure',
        expectedOutcome: 'stops before transcript construction with the completed status still uncommitted',
        verify: async () => {
          let writeCount = 0
          let transcriptCalls = 0
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async () => {
                writeCount += 1
                if (writeCount === 2) {
                  throw new Error('poll progress failed')
                }
              }
            },
            getTranscript: async () => {
              transcriptCalls += 1
              return { text: 'unexpected' }
            }
          }))).rejects.toThrow('poll progress failed')
          expect(writeCount).toBe(2)
          expect(transcriptCalls).toBe(0)
        }
      },
      {
        stage: 'result / transcript retrieval failure',
        expectedOutcome: 'performs terminal cleanup and persists partial deletion without success metadata',
        verify: async () => {
          const writes: Step2RuntimeMetadata[] = []
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async (_key, metadata) => {
                if (metadata.runtime) writes.push(metadata.runtime)
              }
            },
            uploadAsset: async () => ({ value: 'asset-1', remoteAssetId: 'asset-1' }),
            getTranscript: async () => { throw new Error('transcript failed') },
            cleanup: {
              shouldDelete: ({ lastKnownStatus, metadata }) =>
                metadata !== undefined || lastKnownStatus?.state === 'completed',
              deleteJob: async () => true,
              deleteAsset: async () => false
            }
          }))).rejects.toThrow('transcript failed')
          expect(writes.at(-1)).toMatchObject({
            stage: 'cleanup-complete',
            remoteJobId: 'job-1',
            remoteAssetId: 'asset-1',
            cleanup: {
              remoteJobDeleted: true,
              remoteAssetDeleted: false
            }
          })
        }
      },
      {
        stage: 'result / construction and timing failure',
        expectedOutcome: 'persists completed progress before build failure and cleans up from completed runtime',
        verify: async () => {
          const writes: Step2RuntimeMetadata[] = []
          let capturedTimings: Step2Metadata['timings']
          await expect(runAsyncSttJobLifecycle(createMatrixOptions({
            persistCompletedProgress: true,
            lifecycle: {
              writeProgressMetadata: async (_key, metadata) => {
                if (metadata.runtime) writes.push(metadata.runtime)
              }
            },
            buildResult: async ({ runtime, timings }) => {
              expect(runtime?.stage).toBe('completed')
              capturedTimings = timings
              throw new Error('result build failed')
            },
            cleanup: {
              shouldDelete: ({ lastKnownStatus }) => lastKnownStatus?.state === 'completed',
              deleteJob: async () => true
            }
          }))).rejects.toThrow('result build failed')
          expect(capturedTimings?.remoteProcessingMs).toBeGreaterThan(0)
          expect(writes.map((runtime) => runtime.stage)).toEqual([
            'polling',
            'polling',
            'completed',
            'cleanup-complete'
          ])
        }
      },
      {
        stage: 'cleanup / partial deletion and metadata finalization',
        expectedOutcome: 'returns cleanup-complete metadata and adjusts remote processing timing',
        verify: async () => {
          const actual = await runAsyncSttJobLifecycle(createMatrixOptions({
            uploadAsset: async () => ({ value: 'asset-1', remoteAssetId: 'asset-1' }),
            cleanup: {
              shouldDelete: ({ metadata }) => metadata !== undefined,
              deleteJob: async () => true,
              deleteAsset: async () => false
            }
          }))
          expect(actual.metadata.runtime).toMatchObject({
            stage: 'cleanup-complete',
            cleanup: {
              remoteJobDeleted: true,
              remoteAssetDeleted: false
            }
          })
          expect(actual.metadata.timings?.remoteProcessingMs).toBeGreaterThan(0)
        }
      },
      {
        stage: 'cleanup / disabled',
        expectedOutcome: 'returns completed result metadata without rewriting persisted polling progress',
        verify: async () => {
          const writes: Step2RuntimeMetadata[] = []
          const actual = await runAsyncSttJobLifecycle(createMatrixOptions({
            lifecycle: {
              writeProgressMetadata: async (_key, metadata) => {
                if (metadata.runtime) writes.push(metadata.runtime)
              }
            }
          }))
          expect(actual.metadata.runtime?.stage).toBe('completed')
          expect(writes.map((runtime) => runtime.stage)).toEqual(['polling', 'polling'])
        }
      }
    ]

    describe('async STT lifecycle stage failure matrix', () => {
      for (const scenario of asyncSttStageFailureMatrix) {
        test(`${scenario.stage}: ${scenario.expectedOutcome}`, scenario.verify)
      }
    })
})
