import { rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type {
  ExtractRoute,
  ManifestProviderSelector,
  PipelineItemRecord,
  PipelineManifest,
  PipelineProviderState,
  ProcessCommand
} from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { writeFileExact } from '~/utils/bun-file-io'
import { InfraError, isRetryExhaustedError, UsageError } from '~/utils/error-handler'
import { withRetry } from '~/utils/retries'
import { assertAppendOnlyAudioProjection, assertAppendOnlyManifestAudioState } from './audio-projection-structure'
import {
  expectedTtsItemStatus,
  parseManifest
} from './manifest-parse'
import { createManifest, createPipelineItemFromRecord, derivePipelineItemRecord, matchesManifestProvider } from './manifest-record-projection'
import { verifyManifestProjectionArtifacts, verifyManifestUpdateProjectionArtifacts } from './projection-artifact-graph'

export const PIPELINE_MANIFEST_FILE = 'manifest.json'

const invalidManifestError = (
  manifestPath: string,
  reason?: 'structure' | 'artifact-graph'
): Error => reason === 'artifact-graph'
  ? UsageError(`Invalid canonical manifest at ${manifestPath} (artifact-graph). One or more referenced artifacts are missing or changed. If another process is writing this run, wait for it to finish and retry; otherwise resume the output to recover retained work. Do not delete the output directory.`)
  : UsageError(`Invalid canonical manifest at ${manifestPath}${reason ? ` (${reason})` : ''}. Re-run the pipeline to regenerate this output.`)

const readManifestUnlocked = async (
  rootDir: string,
  verifyArtifacts = true
): Promise<PipelineManifest | undefined> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  if (!await Bun.file(manifestPath).exists()) {
    return undefined
  }

  let raw: unknown
  try {
    raw = await Bun.file(manifestPath).json() as unknown
  } catch (error) {
    throw UsageError(`Malformed canonical manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  const manifest = parseManifest(rootDir, raw)
  if (!manifest) throw invalidManifestError(manifestPath, 'structure')
  if (verifyArtifacts && !await verifyManifestProjectionArtifacts(rootDir, manifest)) throw invalidManifestError(manifestPath, 'artifact-graph')
  return manifest
}

const hasConcurrentProviderWork = (manifest: PipelineManifest): boolean =>
  manifest.items.some((item) => item.providers.some((provider) =>
    provider.status === 'running' || provider.status === 'missing'
  ))

const verifyManifestProjectionArtifactsForWrite = async (
  rootDir: string,
  manifest: PipelineManifest,
  previous?: PipelineManifest | undefined,
  updateOnly = false
): Promise<boolean> => {
  const verify = async (): Promise<boolean> => updateOnly && previous
    ? await verifyManifestUpdateProjectionArtifacts(rootDir, previous, manifest)
    : await verifyManifestProjectionArtifacts(rootDir, manifest)
  if (!hasConcurrentProviderWork(manifest)) return await verify()
  try {
    return await withRetry({
      retryClass: 'filesystem_visibility',
      operationName: 'manifest-artifact-visibility',
      retryLogMetadata: () => ({ rootDir })
    }, async () => {
      if (await verify()) return true
      throw InfraError('Manifest projection artifacts are not visible yet', {
        stage: 'manifest:artifact-visibility',
        retryable: true,
        metadata: { rootDir }
      })
    }, () => ({
      shouldRetry: true,
      delayMs: 0,
      reasonCode: 'filesystem_not_visible',
      reason: 'manifest projection artifacts are not visible yet'
    }))
  } catch (error) {
    if (!isRetryExhaustedError(error)) throw error
    l.warn('Manifest projection artifacts remained unavailable after local visibility checks', {
      category: 'runtime',
      metadata: { rootDir, handledRetryExhaustion: true }
    })
    return false
  }
}

const manifestQueues = new Map<string, Promise<void>>()

const withManifestLock = async <T>(
  rootDir: string,
  action: () => Promise<T>
): Promise<T> => {
  const key = resolve(rootDir)
  const previous = manifestQueues.get(key) ?? Promise.resolve()
  let release = (): void => {}
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate
  })
  const queued = previous.catch(() => undefined).then(async () => await gate)
  manifestQueues.set(key, queued)
  await previous.catch(() => undefined)
  try {
    return await action()
  } finally {
    release()
    if (manifestQueues.get(key) === queued) {
      manifestQueues.delete(key)
    }
  }
}

const writeManifestUnlocked = async (
  rootDir: string,
  manifest: PipelineManifest,
  previous?: PipelineManifest | undefined,
  updateOnly = false
): Promise<PipelineManifest> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  const next = {
    ...manifest,
    updatedAt: new Date().toISOString()
  }
  const parsed = parseManifest(rootDir, next)
  if (!parsed) throw invalidManifestError(manifestPath, 'structure')
  if (previous) assertAppendOnlyManifestAudioState(previous, parsed)
  if (!await verifyManifestProjectionArtifactsForWrite(rootDir, parsed, previous, updateOnly)) throw invalidManifestError(manifestPath, 'artifact-graph')

  const tempPath = join(rootDir, `.${PIPELINE_MANIFEST_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`)
  try {
    await writeFileExact(tempPath, `${JSON.stringify(parsed, null, 2)}\n`)
    await rename(tempPath, manifestPath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
  return parsed
}

// verifyArtifacts stays on by default. A stage that is deliberately replacing an artifact the current
// manifest references must pass false, because verifying the recorded hash against the replacement bytes
// is guaranteed to fail; the subsequent updateManifest re-stamps the ref and re-verifies the new graph.
export const readManifest = async (
  rootDir: string,
  options: { verifyArtifacts?: boolean } = {}
): Promise<PipelineManifest | undefined> => await readManifestUnlocked(rootDir, options.verifyArtifacts ?? true)

export const writeManifest = async (
  rootDir: string,
  manifest: PipelineManifest
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir, false)
    return await writeManifestUnlocked(rootDir, manifest, current)
  })

export const updateManifest = async (
  rootDir: string,
  update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir, false)
    if (!current) {
      throw UsageError(`Missing canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)}`)
    }
    return await writeManifestUnlocked(rootDir, await update(current), current, true)
  })

export const readSinglePipelineItemRecord = async (
  rootDir: string,
  expected: {
    command?: ProcessCommand | undefined
    extractRoute?: ExtractRoute | undefined
  } = {}
): Promise<PipelineItemRecord | undefined> => {
  const manifest = await readManifest(rootDir)
  if (
    !manifest
    || manifest.scope !== 'single'
    || manifest.items.length !== 1
    || (expected.command !== undefined && manifest.command !== expected.command)
  ) {
    return undefined
  }
  const item = manifest.items[0]
  if (!item || (expected.extractRoute !== undefined && item.extractRoute !== expected.extractRoute)) {
    return undefined
  }
  return derivePipelineItemRecord(rootDir, item)
}

export const readSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector
): Promise<PipelineProviderState | undefined> => {
  const manifest = await readManifest(rootDir)
  if (!manifest || manifest.scope !== 'single' || manifest.items.length !== 1) {
    return undefined
  }
  return manifest.items[0]?.providers.find((provider) =>
    matchesManifestProvider(rootDir, provider, selector)
  )
}

export const updateSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector,
  update: (provider: PipelineProviderState) => PipelineProviderState | Promise<PipelineProviderState>
): Promise<PipelineProviderState> => {
  let updatedProvider: PipelineProviderState | undefined
  await updateManifest(rootDir, async (manifest) => {
    if (manifest.scope !== 'single' || manifest.items.length !== 1) {
      throw UsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} is not a single-run manifest.`)
    }
    const item = manifest.items[0]
    if (!item) {
      throw invalidManifestError(join(rootDir, PIPELINE_MANIFEST_FILE))
    }
    const providerIndex = item.providers.findIndex((provider) =>
      matchesManifestProvider(rootDir, provider, selector)
    )
    const provider = item.providers[providerIndex]
    if (!provider) {
      throw UsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} has no matching ${selector.service} provider state.`)
    }
    const nextProvider = await update(provider)
    if (!matchesManifestProvider(rootDir, nextProvider, selector)) {
      throw UsageError('A manifest provider-state update cannot change the selected provider identity or artifact path.')
    }
    assertAppendOnlyAudioProjection(provider, nextProvider)
    updatedProvider = nextProvider
    const providers = item.providers.slice()
    providers[providerIndex] = nextProvider
    const items = manifest.items.slice()
    const reducedTtsStatus = manifest.command === 'tts' ? expectedTtsItemStatus(providers) : undefined
    if (manifest.command === 'tts' && reducedTtsStatus === undefined) {
      throw UsageError('A requested TTS item must retain at least one canonical provider state.')
    }
    items[0] = { ...item, providers, ...(reducedTtsStatus ? { status: reducedTtsStatus } : {}) }
    return { ...manifest, items }
  })
  if (!updatedProvider) {
    throw UsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} was not updated.`)
  }
  return updatedProvider
}

export const writePipelineItemRecords = async (
  rootDir: string,
  command: ProcessCommand,
  scope: PipelineManifest['scope'],
  records: PipelineItemRecord[],
  options: {
    extractRoute?: ExtractRoute | undefined
    source?: Record<string, unknown> | undefined
  } = {}
): Promise<PipelineManifest> => {
  if (scope === 'single' && records.length !== 1) {
    throw UsageError('A single-run canonical manifest must contain exactly one item record.')
  }
  const current = await readManifest(rootDir)
  const next = createManifest(
    command,
    scope,
    records.map((record) => createPipelineItemFromRecord(rootDir, record, {
      ...(options.extractRoute ? { extractRoute: options.extractRoute } : {}),
      ...(scope === 'single' ? { outputDir: rootDir } : {})
    })),
    options.source
  )
  return await writeManifest(rootDir, {
    ...next,
    ...(current ? { createdAt: current.createdAt } : {})
  })
}

export { createManifest, createManifestItem, createPipelineItemFromRecord, derivePipelineItemRecord } from './manifest-record-projection'
