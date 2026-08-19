import { mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  createManifest,
  createManifestItem,
  derivePipelineItemRecord,
  PIPELINE_MANIFEST_FILE,
  readManifest,
  writeManifest,
  writePipelineItemRecords
} from '~/cli/commands/process-steps/pipeline-manifest'
import type { ExtractRoute, MultiProviderManifestFixtureOptions, PipelineManifest, PipelineManifestItem, PipelineProviderState, ProcessCommand } from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const resolveRootDir = (pathOrDir: string): string =>
  basename(pathOrDir) === PIPELINE_MANIFEST_FILE ? dirname(pathOrDir) : pathOrDir

export const unwrapCanonicalRecordValue = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null
  }

  const items = value['items']
  if (
    typeof value['command'] === 'string'
    && (value['scope'] === 'single' || value['scope'] === 'batch')
    && Array.isArray(items)
    && items.length === 1
    && isRecord(items[0])
    && isRecord(items[0]['metadata'])
  ) {
    return items[0]['metadata']
  }

  return value
}

export const readCanonicalManifest = async (pathOrDir: string): Promise<PipelineManifest> => {
  const rootDir = resolveRootDir(pathOrDir)
  const manifest = await readManifest(rootDir)
  if (!manifest) {
    throw new Error(`Missing canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)}`)
  }
  return manifest
}

export const readCanonicalRecord = async (pathOrDir: string): Promise<Record<string, unknown>> => {
  const rootDir = resolveRootDir(pathOrDir)
  const manifest = await readCanonicalManifest(rootDir)
  const item = manifest.scope === 'single' && manifest.items.length === 1
    ? manifest.items[0]
    : undefined
  if (!item) {
    throw new Error(`Expected one canonical manifest item at ${join(rootDir, PIPELINE_MANIFEST_FILE)}`)
  }
  return derivePipelineItemRecord(rootDir, item)
}

export const writeSingleManifestFixture = async (
  rootDir: string,
  command: ProcessCommand,
  record: Record<string, unknown>,
  options: { extractRoute?: ExtractRoute | undefined } = {}
): Promise<void> => {
  await mkdir(rootDir, { recursive: true })
  await writePipelineItemRecords(rootDir, command, 'single', [record], options)
}

export const writeLegacyTtsManifestFixture = async (
  rootDir: string,
  record: Record<string, unknown>
): Promise<void> => {
  const rawEntries = Array.isArray(record['tts']) ? record['tts'] : []
  const entries = rawEntries.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry)
    && typeof entry['ttsService'] === 'string'
    && typeof entry['ttsModel'] === 'string'
  )
  if (entries.length === 0) {
    throw new Error('A legacy TTS manifest fixture requires at least one TTS metadata entry.')
  }

  const metadata = { ...record }
  delete metadata['input']
  delete metadata['outputDir']
  delete metadata['completionStatus']

  const now = new Date().toISOString()
  await mkdir(rootDir, { recursive: true })
  await Bun.write(join(rootDir, PIPELINE_MANIFEST_FILE), `${JSON.stringify({
    command: 'tts',
    scope: 'single',
    createdAt: now,
    updatedAt: now,
    items: [{
      ...(typeof record['input'] === 'string' ? { input: record['input'] } : {}),
      outputDir: '.',
      status: 'full',
      metadata,
      providers: entries.map((entry) => ({
        service: entry['ttsService'],
        model: entry['ttsModel'],
        local: false,
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: entry,
        result: entry
      }))
    }]
  }, null, 2)}\n`)
}

export const readCanonicalItemRecords = async (pathOrDir: string): Promise<Record<string, unknown>[]> => {
  const rootDir = resolveRootDir(pathOrDir)
  return (await readCanonicalManifest(rootDir)).items.map((item) => derivePipelineItemRecord(rootDir, item))
}

export const readCanonicalSource = async (pathOrDir: string): Promise<Record<string, unknown> | undefined> =>
  (await readCanonicalManifest(pathOrDir)).source

const resolveProviderResultPath = (pathOrDir: string): string =>
  basename(pathOrDir) === 'result.json' ? pathOrDir : join(pathOrDir, 'result.json')

export const readProviderResultArtifact = async (pathOrDir: string): Promise<Record<string, unknown>> => {
  const resultPath = resolveProviderResultPath(pathOrDir)
  if (!await Bun.file(resultPath).exists()) {
    throw new Error(`Missing provider result artifact at ${resultPath}`)
  }
  const result = await Bun.file(resultPath).json() as unknown
  if (!isRecord(result)) {
    throw new Error(`Invalid provider result artifact at ${resultPath}`)
  }
  return result
}

export const writeProviderResultFixture = async (
  pathOrDir: string,
  result: Record<string, unknown>
): Promise<void> => {
  await mkdir(pathOrDir, { recursive: true })
  await Bun.write(resolveProviderResultPath(pathOrDir), `${JSON.stringify(result, null, 2)}\n`)
}

export const writeMultiProviderManifestFixture = async (
  rootDir: string,
  options: MultiProviderManifestFixtureOptions
): Promise<void> => {
  const providers = options.providers.map((provider): PipelineProviderState => ({
    service: provider.provider,
    model: provider.model,
    artifactDir: `providers/${provider.dir}`,
    status: provider.status ?? 'succeeded',
    attempts: provider.status === 'missing' ? 0 : 1,
    options: {},
    metadata: {
      ...(provider.processingTime === undefined ? {} : { processingTime: provider.processingTime }),
      ...options.providerMetadata
    },
    result: provider.result
  }))
  const costSteps = options.providers.flatMap((provider) =>
    provider.cost === undefined
      ? []
      : [{ provider: provider.provider, model: provider.model, cost: provider.cost }]
  )
  const timingSteps = options.providers.flatMap((provider) =>
    provider.processingTime === undefined
      ? []
      : [{ provider: provider.provider, model: provider.model, processingTimeMs: provider.processingTime }]
  )
  const status: PipelineManifestItem['status'] = providers.every((provider) =>
    provider.status === 'succeeded' || provider.status === 'skipped'
  ) ? 'full' : 'incomplete'

  await mkdir(rootDir, { recursive: true })
  await writeManifest(rootDir, createManifest(options.command, 'single', [
    createManifestItem(rootDir, {
      ...(options.extractRoute ? { extractRoute: options.extractRoute } : {}),
      status,
      metadata: {
        ...options.metadata,
        cost: { actual: { steps: costSteps } },
        timing: { actual: { steps: timingSteps } }
      },
      providers
    })
  ]))

  await Promise.all(options.providers.map(async (provider) => {
    await writeProviderResultFixture(
      join(rootDir, 'providers', provider.dir),
      provider.result
    )
  }))
}
