import { ASYNC_STT_PROGRESS_METADATA_KEY, createSttProviderProgressLifecycle } from '~/cli/commands/stt/stt-provider-progress'
import type { PipelineProviderStatus, Step2Metadata, Step2RuntimeMetadata, SttTarget } from '~/types'
import { writeSingleManifestFixture } from './manifest-helpers'

export const seedAsyncProviderManifest = async (
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
