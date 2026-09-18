import { describe,expect,test } from 'bun:test'
import { readSingleManifestProviderState } from '~/cli/commands/command-shared/pipeline-manifest'
import { createAsyncSttProgressMetadataPersister,readPersistedAsyncSttRuntime } from '~/cli/commands/stt/async-lifecycle'
import { ASYNC_STT_PROGRESS_METADATA_KEY } from '~/cli/commands/stt/stt-provider-progress'
import type { Step2Metadata, Step2RuntimeMetadata, SttTarget } from '~/types'
import { installMockFetch,setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { seedAsyncProviderManifest } from '../../../test-utils/async-stt-provider-manifest-fixture'

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


const readProvider = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>
) => await readSingleManifestProviderState(outputDir, {
  service: target.service,
  model: target.model,
  artifactDir: outputDir
})

describe('async STT resume contracts', () => {

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
})
