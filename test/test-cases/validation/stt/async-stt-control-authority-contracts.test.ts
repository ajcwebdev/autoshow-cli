import { describe,expect,test } from 'bun:test'
import { readPersistedAsyncSttRuntime } from '~/cli/commands/stt/async-lifecycle'
import { writeSttResultArtifact } from '~/cli/commands/stt/stt-utils/stt-result-artifacts'
import type { Step2RuntimeMetadata } from '~/types'
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
