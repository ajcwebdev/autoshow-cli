import type { AsyncSttLifecycleHooks, JsonObject, SttProviderProgressSelector } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { readSingleManifestProviderState, updateSingleManifestProviderState } from '../../pipeline-manifest'

export const ASYNC_STT_PROGRESS_METADATA_KEY = 'asyncSttProgress'

const toProviderSelector = ({ artifactDir, target }: SttProviderProgressSelector) => ({
  service: target.service,
  model: target.model,
  artifactDir
})

export const markSttProviderRunning = async (
  selector: SttProviderProgressSelector,
  attempts: number
): Promise<void> => {
  await updateSingleManifestProviderState(
    selector.rootDir,
    toProviderSelector(selector),
    (provider) => ({
      ...provider,
      status: 'running',
      attempts,
      error: undefined
    })
  )
}

export const markSttProviderFailed = async (
  selector: SttProviderProgressSelector,
  error: Record<string, unknown>
): Promise<void> => {
  await updateSingleManifestProviderState(
    selector.rootDir,
    toProviderSelector(selector),
    (provider) => ({
      ...provider,
      status: 'failed',
      error: error as JsonObject
    })
  )
}

export const createSttProviderProgressLifecycle = (
  selector: SttProviderProgressSelector,
  onProviderMetadata?: ((metadata: Record<string, unknown>) => void) | undefined
): Pick<AsyncSttLifecycleHooks, 'readProgressMetadata' | 'writeProgressMetadata'> => ({
  readProgressMetadata: async (progressKey) => {
    const provider = await readSingleManifestProviderState(selector.rootDir, toProviderSelector(selector))
    if (!provider || (provider.status !== 'running' && provider.status !== 'failed')) {
      return undefined
    }
    const progress = provider.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]
    return isRecord(progress) && isRecord(progress[progressKey])
      ? progress[progressKey]
      : undefined
  },
  writeProgressMetadata: async (progressKey, metadata) => {
    const updated = await updateSingleManifestProviderState(
      selector.rootDir,
      toProviderSelector(selector),
      (provider) => {
        const currentProgress = isRecord(provider.metadata[ASYNC_STT_PROGRESS_METADATA_KEY])
          ? provider.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]
          : {}
        return {
          ...provider,
          status: 'running',
          metadata: {
            ...provider.metadata,
            [ASYNC_STT_PROGRESS_METADATA_KEY]: {
              ...currentProgress,
              [progressKey]: metadata as unknown as JsonObject
            }
          }
        }
      }
    )
    onProviderMetadata?.(updated.metadata)
  }
})
