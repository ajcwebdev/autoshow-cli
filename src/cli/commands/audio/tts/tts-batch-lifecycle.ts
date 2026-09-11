import type { PipelineProviderState, PreparedTtsInput, TtsBatchItemAccumulator, TtsBatchLifecycleCoordinator, TtsDialoguePlanArtifactRef, TtsTarget } from '~/types'
import { createBatchedManifestUpdater, updateManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { UsageError } from '~/utils/error-handler'
import { appendCurrentTtsProviderState, getCurrentTtsJournalAttemptKey } from './script-to-audio/current-render-artifacts'
import { bindTtsDialoguePlanArtifact } from './script-to-audio/item-dialogue-plan-artifact'
import { reduceTtsProviderStates, writeInitialTtsManifest } from './tts-single-run'
import { buildTtsBatchInitialRecords } from './tts-batch-completion'

export const createTtsBatchLifecycleCoordinator = (options: {
  batchDir: string
  createdAt: string
  preparedInputs: PreparedTtsInput[]
  dialoguePlanArtifacts: TtsDialoguePlanArtifactRef[]
  targets: TtsTarget[]
  accumulators: TtsBatchItemAccumulator[]
  source: Record<string, unknown>
}): TtsBatchLifecycleCoordinator => {
  let initialized = false
  let initializationError: unknown
  let initialization: Promise<void> | undefined
  let releasePreparationBarrier = (): void => {}
  const preparationBarrier = new Promise<void>((resolve) => {
    releasePreparationBarrier = resolve
  })
  const manifestUpdater = createBatchedManifestUpdater(
    async (update) => await updateManifest(options.batchDir, update)
  )
  const publishedJournalAttempts = new Set<string>()

  const allItemsPrepared = (): boolean => options.accumulators.every((accumulator) =>
    options.targets.every((target) => target.targetKey !== undefined && accumulator.providerStates.has(target.targetKey))
  )

  const initializeIfComplete = (): void => {
    if (initialized || initialization || initializationError !== undefined || !allItemsPrepared()) return
    initialization = (async () => {
      const records = buildTtsBatchInitialRecords(options.preparedInputs, options.targets, options.accumulators)
      await writeInitialTtsManifest(options.batchDir, 'batch', records, options.createdAt, options.source)
      initialized = true
    })().catch((error: unknown) => {
      initializationError = error
    }).finally(() => {
      releasePreparationBarrier()
    })
  }

  const waitForInitialization = async (): Promise<void> => {
    initializeIfComplete()
    if (!initialized) await preparationBarrier
    if (initialization) await initialization
    if (initializationError !== undefined) throw initializationError
    if (!initialized) throw UsageError('TTS batch preparation ended before every requested target had a real durable lifecycle state.')
  }

  return {
    beforeDispatch: async (itemIndex, preparedStates) => {
      const accumulator = options.accumulators[itemIndex]
      if (!accumulator) throw UsageError(`Missing TTS batch lifecycle accumulator for item ${itemIndex + 1}.`)
      const dialoguePlanArtifact = options.dialoguePlanArtifacts[itemIndex]
      if (!dialoguePlanArtifact) throw UsageError(`Missing canonical dialogue-plan artifact for TTS batch item ${itemIndex + 1}.`)
      for (const unboundState of preparedStates) {
        const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
        if (!state.targetKey) throw UsageError('TTS batch lifecycle produced a prepared state without an operation-scoped targetKey.')
        accumulator.providerStates.set(state.targetKey, state)
      }
      await waitForInitialization()
    },
    onProviderState: async (itemIndex, unboundState) => {
      const dialoguePlanArtifact = options.dialoguePlanArtifacts[itemIndex]
      if (!dialoguePlanArtifact) throw UsageError(`Missing canonical dialogue-plan artifact for TTS batch item ${itemIndex + 1}.`)
      const state = bindTtsDialoguePlanArtifact(unboundState, dialoguePlanArtifact)
      if (!state.targetKey) throw UsageError('TTS batch lifecycle produced a provider state without an operation-scoped targetKey.')
      await waitForInitialization()
      const journalAttemptKey = state.status === 'running'
        ? getCurrentTtsJournalAttemptKey(state)
        : undefined
      if (state.status === 'running' && (!journalAttemptKey || publishedJournalAttempts.has(journalAttemptKey))) return
      const accumulator = options.accumulators[itemIndex]
      if (!accumulator) throw UsageError(`Missing TTS batch lifecycle accumulator for item ${itemIndex + 1}.`)
      let committed: PipelineProviderState | undefined
      await manifestUpdater((manifest) => {
        if (manifest.command !== 'tts' || manifest.scope !== 'batch' || manifest.items.length !== options.preparedInputs.length) {
          throw UsageError('TTS batch lifecycle can update only its complete canonical batch manifest.')
        }
        const item = manifest.items[itemIndex]
        if (!item || item.input !== options.preparedInputs[itemIndex]?.manifestInputPath) {
          throw UsageError(`Canonical TTS batch item ${itemIndex + 1} changed identity during synthesis.`)
        }
        const providerIndex = item.providers.findIndex((provider) => provider.targetKey === state.targetKey)
        const current = item.providers[providerIndex]
        if (!current) throw UsageError(`Canonical TTS batch item ${itemIndex + 1} is missing lifecycle state for ${state.targetKey}.`)
        committed = appendCurrentTtsProviderState(current, state)
        const providers = item.providers.slice()
        providers[providerIndex] = committed
        const items = manifest.items.slice()
        items[itemIndex] = { ...item, providers, status: reduceTtsProviderStates(providers) }
        return { ...manifest, items }
      })
      accumulator.providerStates.set(state.targetKey, committed as PipelineProviderState)
      if (journalAttemptKey) publishedJournalAttempts.add(journalAttemptKey)
    },
    abortPreparation: (error) => {
      if (initialized || initializationError !== undefined) return
      initializationError = error
      releasePreparationBarrier()
    }
  }
}
