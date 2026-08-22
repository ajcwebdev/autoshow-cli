import { join } from 'node:path'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { PIPELINE_MANIFEST_FILE, readSinglePipelineItemRecord } from '~/cli/commands/process-steps/pipeline-manifest'
import type { PipelineItemRecord, ProviderBatchResumeConfig, ProviderIdentity, ResolvedFlagOptions, ResumeFakeMetadata, ResumeFakeProviderResumeEntry, ResumeTarget } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { isRecord } from '../../../test-utils/test-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const FAKE_MODEL_FIELDS = {
  openai: ['openaiImageModels', 'openaiImageModel'],
  gemini: ['geminiImageModels', 'geminiImageModel']
} as const

export const collectFakeTargetsFromOptions = (opts: ResolvedFlagOptions): ProviderIdentity[] => {
  const valuesByField = opts as Record<string, unknown>
  return Object.entries(FAKE_MODEL_FIELDS).flatMap(([service, [modelsField, modelField]]) => {
    const models = valuesByField[modelsField] ?? valuesByField[modelField]
    const values = Array.isArray(models) ? models : [models]
    return values.flatMap(model => typeof model === 'string' ? [{ service, model }] : [])
  })
}

export const fakeResumeConfig = (selectedTargets: ProviderIdentity[], ranTargets: ProviderIdentity[]) => ({
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Fake image',
  providerFlags: ['fake-provider'],
  selectionMode: 'additive-stored' as const,
  modelFields: FAKE_MODEL_FIELDS,
  getSuccessKey: (entry: ResumeFakeMetadata) => getGenerationTargetKey(entry.service, entry.model),
  collectTargets: (opts: ResolvedFlagOptions) => selectedTargets.length > 0 ? selectedTargets : collectFakeTargetsFromOptions(opts),
  runMissingTargets: async (targets: ProviderIdentity[]) => {
    ranTargets.push(...targets)
    return targets.map(target => ({ ...target, processingTime: 1 }))
  },
  buildEstimates: () => [],
  rebuildRunMetadata: (metadata: ResumeFakeMetadata[]) => ({
    cost: {
      actual: {
        totalCost: 0,
        steps: metadata.map(entry => ({ step: 'image', provider: entry.service, model: entry.model, cost: 0 }))
      }
    },
    timing: {
      actual: {
        totalProcessingTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
        steps: []
      }
    }
  })
})

export const writeFakeImageRun = async (dir: string, requestedProviders: ProviderIdentity[], metadata: ResumeFakeMetadata[]): Promise<void> => {
  await writeSingleManifestFixture(dir, 'image', { input: 'prompt', requestedProviders, image: metadata })
}

export const fakeTarget = (dir: string): ResumeTarget => ({
  kind: 'image',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const parseFakeProviderResumeEntry = (entry: unknown): ResumeFakeProviderResumeEntry | undefined => {
  if (!isRecord(entry) || typeof entry['outputDir'] !== 'string') return undefined
  const readTargets = (value: unknown): ProviderIdentity[] => Array.isArray(value)
    ? value.filter((provider): provider is ProviderIdentity => isRecord(provider) && typeof provider['service'] === 'string' && typeof provider['model'] === 'string')
    : []
  return {
    outputDir: entry['outputDir'],
    source: {},
    requestedTargets: readTargets(entry['requestedProviders']),
    missingTargets: readTargets(entry['missingProviders']),
    completionStatus: entry['completionStatus'] === 'full' ? 'full' : 'incomplete',
    rawRecord: entry
  }
}

const readFakeProviderItemRecord = async (outputDir: string): Promise<PipelineItemRecord> => {
  return requireDefined(await readSinglePipelineItemRecord(outputDir, { command: 'extract' }), `fake provider manifest at ${outputDir}`)
}

export const fakeProviderResumeConfig = (ranTargets: ProviderIdentity[]): ProviderBatchResumeConfig<ProviderIdentity, ResumeFakeProviderResumeEntry> => ({
  stepLabel: 'Fake provider',
  readItemRecord: readFakeProviderItemRecord,
  parseRecord: async record => parseFakeProviderResumeEntry(record),
  getProviderLabels: targets => targets.map(target => `${target.service}/${target.model}`),
  processEntry: async ({ entry }) => {
    ranTargets.push(...entry.missingTargets)
    const record = {
      ...entry.rawRecord,
      completionStatus: 'full',
      missingProviders: [],
      providerStates: entry.requestedTargets.map(target => ({ ...target, status: 'succeeded' }))
    }
    await writeSingleManifestFixture(entry.outputDir, 'extract', record, { extractRoute: 'document' })
    return { outputDir: entry.outputDir, record, completionStatus: 'full' as const, detail: 'resume complete' }
  }
})
