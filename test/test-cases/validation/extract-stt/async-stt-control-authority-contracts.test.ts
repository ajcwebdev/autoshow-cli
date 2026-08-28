import { describe,expect,test } from 'bun:test'
import { readPersistedAsyncSttRuntime } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { ASYNC_STT_PROGRESS_METADATA_KEY,createSttProviderProgressLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import { writeSttResultArtifact } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import type { PipelineProviderStatus,Step2Metadata,Step2RuntimeMetadata,SttTarget } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch,setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

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

describe('async STT resume contracts', () => {

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
