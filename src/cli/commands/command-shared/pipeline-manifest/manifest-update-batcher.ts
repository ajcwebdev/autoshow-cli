import type { PipelineManifest } from '~/types'

export type ManifestUpdater = (
  update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
) => Promise<PipelineManifest>

type PendingManifestUpdate = {
  update: Parameters<ManifestUpdater>[0]
  resolve: (manifest: PipelineManifest) => void
  reject: (error: unknown) => void
}

export const createBatchedManifestUpdater = (
  commit: ManifestUpdater
): ManifestUpdater => {
  const pending: PendingManifestUpdate[] = []
  let flushing = false
  let scheduled = false

  const schedule = (): void => {
    if (flushing || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      void flush()
    })
  }

  const flush = async (): Promise<void> => {
    if (flushing) return
    flushing = true
    try {
      while (pending.length > 0) {
        const batch = pending.splice(0)
        const accepted: PendingManifestUpdate[] = []
        let failed: { entry: PendingManifestUpdate, error: unknown, index: number } | undefined
        try {
          const committed = await commit(async (current) => {
            let next = current
            for (const [index, entry] of batch.entries()) {
              try {
                next = await entry.update(next)
                accepted.push(entry)
              } catch (error) {
                failed = { entry, error, index }
                break
              }
            }
            return next
          })
          for (const entry of accepted) entry.resolve(committed)
          if (failed) {
            failed.entry.reject(failed.error)
            pending.unshift(...batch.slice(failed.index + 1))
          }
        } catch (error) {
          for (const entry of batch) entry.reject(error)
        }
        await Promise.resolve()
      }
    } finally {
      flushing = false
      if (pending.length > 0) schedule()
    }
  }

  return async (update) => await new Promise<PipelineManifest>((resolve, reject) => {
    pending.push({ update, resolve, reject })
    schedule()
  })
}
