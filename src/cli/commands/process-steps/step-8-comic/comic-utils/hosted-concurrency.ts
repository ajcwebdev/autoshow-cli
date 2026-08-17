import type { HostedConcurrencyCoordinator, HostedConcurrencyWorkClass, ImageGenerationModel } from '~/types'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { runHostedConcurrencyRequest } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'

type ComicHostedScheduling = {
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  concurrency: number
}

export const runComicHostedRequest = async <T>(
  options: ComicHostedScheduling,
  provider: string,
  workClass: HostedConcurrencyWorkClass,
  workId: string,
  unitIndex: number,
  task: () => Promise<T>
): Promise<T> => {
  const coordinator = options.hostedConcurrencyCoordinator
  if (!coordinator) return await task()
  return await runHostedConcurrencyRequest({
    coordinator,
    admission: {
      provider,
      workClass,
      configuredLimit: options.concurrency,
      workId,
      unitIndex
    }
  }, async () => await task())
}

export const resolveComicImageProvider = (model: ImageGenerationModel): string =>
  findRegistryServiceForModel('image', model) ?? 'comic-image'
