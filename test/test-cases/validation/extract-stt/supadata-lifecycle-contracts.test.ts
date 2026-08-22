import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/process-steps/pipeline-manifest'
import { runSupadataStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-supadata/run-supadata-stt'
import { ASYNC_STT_PROGRESS_METADATA_KEY, createSttProviderProgressLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import type { AsyncSttLifecycleHooks, SttTarget } from '~/types'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const TARGET = { service: 'supadata', model: 'generate' } as const
const SOURCE_URL = 'https://www.youtube.com/watch?v=lifecycle'
const TRANSCRIPT_CONTENT = [{ text: 'Hello there.', offset: 0, duration: 1000, lang: 'en' }]

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['SUPADATA_API_KEY'],
  tempPrefix: 'autoshow-supadata-lifecycle-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    installMockFetch(() => {
      throw new Error('Unexpected unmocked provider request')
    })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const seedProgressLifecycle = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'> = TARGET
): Promise<Pick<AsyncSttLifecycleHooks, 'readProgressMetadata' | 'writeProgressMetadata'>> => {
  await writeSingleManifestFixture(outputDir, 'extract', {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: target.service, model: target.model, local: false }],
    providerStates: [{
      service: target.service,
      model: target.model,
      local: false,
      artifactDir: '.',
      status: 'running',
      attempts: 1
    }],
    missingProviders: [{ service: target.service, model: target.model, local: false }]
  }, { extractRoute: 'media' })

  return createSttProviderProgressLifecycle({ rootDir: outputDir, artifactDir: outputDir, target })
}

const runOptions = (
  lifecycle?: Pick<AsyncSttLifecycleHooks, 'readProgressMetadata' | 'writeProgressMetadata'> | undefined
) => ({
  model: TARGET.model,
  sourceUrl: SOURCE_URL,
  segmentOffsetMinutes: 0,
  ...(lifecycle ? { lifecycle } : {})
})

describe('Supadata shared async lifecycle contracts', () => {
  test('a 200 creation returns the transcript without polling or a remote runtime', async () => {
    const outputDir = await tempDirs.make()
    process.env['SUPADATA_API_KEY'] = 'test-supadata-key'
    const calls = installMockFetch(() => jsonResponse(
      { content: TRANSCRIPT_CONTENT, lang: 'en' },
      { headers: { 'x-billable-requests': '3' } }
    ))

    const actual = await runSupadataStt('unused.mp3', outputDir, runOptions())

    expect(calls).toHaveLength(1)
    expect(new URL(calls[0]?.url as string).pathname).toBe('/v1/transcript')
    expect(actual.result.text).toBe('Hello there.')
    expect(await Bun.file(join(outputDir, 'transcription.txt')).text()).toContain('Hello there.')
    expect(actual.metadata).toMatchObject({
      transcriptionService: 'supadata',
      transcriptionModel: TARGET.model,
      billing: { creditsUsed: 3, source: 'response_header' }
    })
    expect(actual.metadata.runtime).toBeUndefined()
  })

  test('a 202 creation polls to completion and persists the canonical job runtime', async () => {
    const outputDir = await tempDirs.make()
    process.env['SUPADATA_API_KEY'] = 'test-supadata-key'
    const lifecycle = await seedProgressLifecycle(outputDir)
    const calls = installMockFetch((call) => new URL(call.url).pathname.endsWith('/transcript')
      ? jsonResponse({ jobId: 'supadata-job-1' }, { status: 202, headers: { 'x-billable-requests': '2' } })
      : jsonResponse({ status: 'completed', content: TRANSCRIPT_CONTENT, lang: 'en' }))

    const actual = await runSupadataStt('unused.mp3', outputDir, runOptions(lifecycle))

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/v1/transcript', '/v1/transcript/supadata-job-1'])
    expect(actual.result.text).toBe('Hello there.')
    expect(actual.metadata).toMatchObject({
      billing: { creditsUsed: 2, source: 'response_header' },
      runtime: { mode: 'fresh', stage: 'completed', remoteJobId: 'supadata-job-1' }
    })

    const provider = await readSingleManifestProviderState(outputDir, {
      service: TARGET.service,
      model: TARGET.model,
      artifactDir: outputDir
    })
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({
      whole: { runtime: { remoteJobId: 'supadata-job-1', stage: 'completed' } }
    })
  })

  test('a persisted in-flight job resumes by polling instead of creating a second job', async () => {
    const outputDir = await tempDirs.make()
    process.env['SUPADATA_API_KEY'] = 'test-supadata-key'
    const lifecycle = await seedProgressLifecycle(outputDir)
    await lifecycle.writeProgressMetadata?.('whole', {
      transcriptionService: 'supadata',
      transcriptionModel: TARGET.model,
      processingTime: 0,
      tokenCount: 0,
      billing: { creditsUsed: 5, creditRateCents: 1, source: 'response_header' },
      runtime: { mode: 'fresh', stage: 'polling', remoteJobId: 'supadata-resumed-1' }
    })

    const calls = installMockFetch(() => jsonResponse({ status: 'completed', content: TRANSCRIPT_CONTENT, lang: 'en' }))
    const actual = await runSupadataStt('unused.mp3', outputDir, runOptions(lifecycle))

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/v1/transcript/supadata-resumed-1'])
    expect(actual.metadata).toMatchObject({
      billing: { creditsUsed: 5, source: 'response_header' },
      runtime: { mode: 'resumed', stage: 'completed', remoteJobId: 'supadata-resumed-1' }
    })
  })

  test('a failed poll status surfaces the provider failure message', async () => {
    const outputDir = await tempDirs.make()
    process.env['SUPADATA_API_KEY'] = 'test-supadata-key'
    installMockFetch((call) => new URL(call.url).pathname.endsWith('/transcript')
      ? jsonResponse({ jobId: 'supadata-job-fail' }, { status: 202 })
      : jsonResponse({ status: 'failed', error: 'transcript unavailable for this source' }))

    await expect(runSupadataStt('unused.mp3', outputDir, runOptions()))
      .rejects.toThrow('transcript unavailable for this source')
  })

  test('an unsupported source is skipped before any provider request', async () => {
    const outputDir = await tempDirs.make()
    process.env['SUPADATA_API_KEY'] = 'test-supadata-key'
    const calls = installMockFetch(() => jsonResponse({}))

    await expect(runSupadataStt('unused.mp3', outputDir, {
      model: TARGET.model,
      sourceUrl: 'file:///tmp/local.mp3',
      segmentOffsetMinutes: 0
    })).rejects.toMatchObject({ skipped: true })
    expect(calls).toHaveLength(0)
  })
})
