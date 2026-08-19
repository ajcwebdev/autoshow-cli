import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/process-steps/pipeline-manifest'
import { createAsyncSttProgressMetadataPersister, readPersistedAsyncSttRuntime, runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { runHappyScribeStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/run-happyscribe-stt'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/run-soniox-stt'
import { ASYNC_STT_PROGRESS_METADATA_KEY, createSttProviderProgressLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import { writeSttResultArtifact } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import type { MatrixOptions, MatrixStatus, PipelineProviderStatus, Step2Metadata, Step2RuntimeMetadata, SttTarget } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['HAPPYSCRIBE_API_KEY', 'SONIOX_API_KEY'],
  tempPrefix: 'autoshow-async-stt-resume-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    installMockFetch(() => {
      throw new Error('Unexpected unmocked provider request')
    })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const makeTempDir = tempDirs.make

const seedAsyncProviderManifest = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>,
  options: {
    status?: PipelineProviderStatus | undefined
    runtime?: Step2RuntimeMetadata | undefined
    billing?: Step2Metadata['billing'] | undefined
  } = {}
) => {
  const progressMetadata = options.runtime
    ? {
        transcriptionService: target.service,
        transcriptionModel: target.model,
        processingTime: 0,
        tokenCount: 0,
        timings: {},
        runtime: options.runtime,
        ...(options.billing ? { billing: options.billing } : {})
      }
    : undefined
  await writeSingleManifestFixture(outputDir, 'extract', {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: target.service, model: target.model, local: false }],
    providerStates: [{
      service: target.service,
      model: target.model,
      local: false,
      artifactDir: '.',
      status: options.status ?? 'running',
      attempts: 1,
      ...(progressMetadata
        ? { metadata: { [ASYNC_STT_PROGRESS_METADATA_KEY]: { whole: progressMetadata } } }
        : {})
    }],
    missingProviders: [{ service: target.service, model: target.model, local: false }]
  }, { extractRoute: 'media' })
  return createSttProviderProgressLifecycle({ rootDir: outputDir, artifactDir: outputDir, target })
}

const readProvider = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>
) => await readSingleManifestProviderState(outputDir, {
  service: target.service,
  model: target.model,
  artifactDir: outputDir
})

describe('async STT resume contracts', () => {
  test('Happy Scribe keeps the paid order resumable when export retrieval fails', async () => {
    const outputDir = await makeTempDir('autoshow-happyscribe-export-resume-')
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-happyscribe-key'
    const target = { service: 'happyscribe', model: 'auto' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)

    let orderCreates = 0
    let exportCreates = 0
    let downloadAttempts = 0
    installMockFetch((call) => {
      const url = new URL(call.url)
      const method = call.method

      if (url.pathname.endsWith('/organizations')) {
        return jsonResponse({ organizations: [{ id: 'organization-1', currency: 'usd' }] })
      }
      if (url.pathname.endsWith('/uploads/new')) {
        return jsonResponse({ signedUrl: 'https://upload.mock/audio' })
      }
      if (url.hostname === 'upload.mock' && method === 'PUT') {
        return new Response(null, { status: 200 })
      }
      if (url.pathname.endsWith('/orders') && method === 'POST') {
        orderCreates += 1
        return jsonResponse({ id: 'order-1', state: 'submitted' })
      }
      if (url.pathname.endsWith('/orders/order-1')) {
        return jsonResponse({
          id: 'order-1',
          state: 'fulfilled',
          transcriptions: [{ uuid: 'transcription-1', state: 'automatic_done' }]
        })
      }
      if (url.pathname.endsWith('/transcriptions/transcription-1')) {
        return jsonResponse({ id: 'transcription-1', state: 'automatic_done' })
      }
      if (url.pathname.endsWith('/exports') && method === 'POST') {
        exportCreates += 1
        return jsonResponse({ id: `export-${exportCreates}`, state: 'pending' })
      }
      if (url.pathname.endsWith(`/exports/export-${exportCreates}`)) {
        return jsonResponse({
          id: `export-${exportCreates}`,
          state: 'ready',
          download_link: `https://download.mock/export-${exportCreates}`
        })
      }
      if (url.hostname === 'download.mock') {
        downloadAttempts += 1
        if (downloadAttempts <= 2) {
          return jsonResponse({ error: 'export temporarily unavailable' }, { status: 503 })
        }
        return jsonResponse({
          transcript: 'hello from resumed export',
          segments: [{ text: 'hello from resumed export', start_seconds: 0, end_seconds: 1 }]
        })
      }

      throw new Error(`Unexpected Happy Scribe request: ${method} ${url.toString()}`)
    })

    await expect(runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('Happy Scribe transcript download failed')

    const failedProvider = await readProvider(outputDir, target)
    expect(failedProvider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'polling',
      remoteJobId: 'order-1'
    } } })
    const resumed = await runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      lifecycle
    })

    expect(resumed.result.text).toBe('hello from resumed export')
    expect(resumed.metadata.runtime).toMatchObject({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'order-1'
    })
    expect(orderCreates).toBe(1)
    expect(exportCreates).toBe(2)
  })

  test('Soniox retains remote resources while canonical polling progress remains retryable', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-poll-resume-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target, {
      status: 'failed',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls = installMockFetch(() => {
      return jsonResponse({ id: 'transcription-1', status: 'processing' })
    })

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('is still pending after 5 resume status checks')

    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(5)
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)
    const provider = await readProvider(outputDir, target)
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'polling',
      remoteJobId: 'transcription-1',
      remoteAssetId: 'file-1'
    } } })
  })

  test('Soniox deletes remote resources after a terminal provider failure', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-terminal-cleanup-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target, {
      status: 'failed',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls = installMockFetch((call) => {
      if (call.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return jsonResponse({
        id: 'transcription-1',
        status: 'error',
        error_message: 'provider rejected the audio'
      })
    })

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('Soniox transcription failed: provider rejected the audio')

    expect(calls.filter((call) => call.method === 'DELETE').map((call) => new URL(call.url).pathname).sort()).toEqual([
      '/v1/files/file-1',
      '/v1/transcriptions/transcription-1'
    ])
    const provider = await readProvider(outputDir, target)
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'cleanup-complete',
      remoteJobId: 'transcription-1',
      remoteAssetId: 'file-1',
      cleanup: {
        remoteJobDeleted: true,
        remoteAssetDeleted: true
      }
    } } })
  })

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
              expect(runtime.stage).toBe('completed')
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

  test('concurrent segment progress stays isolated in one canonical provider entry', async () => {
    const outputDir = await makeTempDir('autoshow-async-stt-segment-progress-')
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)
    const buildProgress = (runtime: Step2RuntimeMetadata): Step2Metadata => ({
      transcriptionService: target.service,
      transcriptionModel: target.model,
      processingTime: 0,
      tokenCount: 0,
      runtime
    })
    const persistFirst = createAsyncSttProgressMetadataPersister(lifecycle, 1, buildProgress, () => {})
    const persistSecond = createAsyncSttProgressMetadataPersister(lifecycle, 2, buildProgress, () => {})

    await Promise.all([
      persistFirst({ mode: 'fresh', stage: 'polling', remoteJobId: 'segment-job-1' }),
      persistSecond({ mode: 'fresh', stage: 'polling', remoteJobId: 'segment-job-2' })
    ])

    const provider = await readProvider(outputDir, target)
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({
      'segment-001': { runtime: { remoteJobId: 'segment-job-1' } },
      'segment-002': { runtime: { remoteJobId: 'segment-job-2' } }
    })
    await expect(readPersistedAsyncSttRuntime(lifecycle, {
      transcriptionService: target.service,
      transcriptionModel: target.model
    }, 1)).resolves.toMatchObject({ remoteJobId: 'segment-job-1' })
    await expect(readPersistedAsyncSttRuntime(lifecycle, {
      transcriptionService: target.service,
      transcriptionModel: target.model
    }, 2)).resolves.toMatchObject({ remoteJobId: 'segment-job-2' })
  })

  test('result artifacts and non-resumable provider statuses cannot supply async control state', async () => {
    const outputDir = await makeTempDir('autoshow-async-stt-result-isolation-')
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const runtime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'manifest-job'
    }
    const lifecycle = await seedAsyncProviderManifest(outputDir, target, {
      status: 'succeeded',
      runtime
    })
    const untrustedResult = {
      text: 'done',
      segments: [],
      runtime: { ...runtime, remoteJobId: 'result-artifact-job' }
    }
    await writeSttResultArtifact(outputDir, untrustedResult)

    await expect(readPersistedAsyncSttRuntime(lifecycle, {
      transcriptionService: target.service,
      transcriptionModel: target.model
    })).resolves.toBeUndefined()
  })
})
