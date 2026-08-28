import type { AsyncSttLifecycleOptions, Step2Metadata, TranscriptionResult } from '~/types'
import { finalizeAsyncSttCleanup } from './async-stt-cleanup'
import { constructAsyncSttResult, finalizeAsyncSttBuiltResult, pollAndPersistAsyncSttJob, resumeOrCreateAsyncSttJob } from './async-stt-job-execution'
import { createAsyncSttLifecycleContext } from './async-stt-runtime-state'

export {
  parseStep2RuntimeMetadata,
  readPersistedAsyncSttProgressMetadata,
  readPersistedAsyncSttRuntime,
  createAsyncSttProgressMetadataPersister,
  createAsyncSttJobReadyNotifier
} from './async-stt-runtime-state'
export {
  pollAsyncSttJobUntilComplete,
  attachAsyncSttErrorContext,
  attachAsyncSttValidationContext,
  buildAsyncSttPollingDeadlineError,
  buildAsyncSttResumeProbeError
} from './async-stt-polling'
export { deleteSttRemoteResource } from './async-stt-cleanup'

export const runAsyncSttJobLifecycle = async <TStatus, TTranscript, TUpload = unknown>(
  options: AsyncSttLifecycleOptions<TStatus, TTranscript, TUpload>
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const context = createAsyncSttLifecycleContext(options)

  try {
    const created = await resumeOrCreateAsyncSttJob(context)
    if (created.kind === 'completed') {
      return await finalizeAsyncSttBuiltResult(context, created.transcript, undefined)
    }
    const polledJob = await pollAndPersistAsyncSttJob(created.context)
    return (await constructAsyncSttResult(polledJob)).built
  } finally {
    await finalizeAsyncSttCleanup(context)
  }
}
