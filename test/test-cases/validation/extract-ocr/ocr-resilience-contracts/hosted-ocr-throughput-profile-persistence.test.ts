import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  findHostedOcrThroughputProfile,
  persistHostedOcrThroughputProfiles
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-throughput-profiles'
import {
  buildLaneTelemetry,
  buildSchedulerTelemetry,
  buildTargetTelemetry
} from './hosted-ocr-scheduler/shared'

const withProfileStorePath = async <T>(
  run: (profilePath: string) => Promise<T>
): Promise<T> => {
  const dir = join(
    process.cwd(),
    '.test-work',
    `hosted-ocr-profile-store-${crypto.randomUUID()}`
  )
  await mkdir(dir, { recursive: true })
  try {
    return await run(join(dir, 'profiles.json'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('hosted OCR throughput profile persistence contracts', () => {
  test('profile storage persists only privacy-preserving throughput fields', async () => {
    await withProfileStorePath(async (profilePath) => {
      const snapshot = buildSchedulerTelemetry()
      for (const minute of [0, 1, 2]) {
        await persistHostedOcrThroughputProfiles(snapshot, {
          completionStatus: 'full',
          profilePath,
          now: new Date(`2026-07-11T12:0${minute}:00.000Z`)
        })
      }

      const store = JSON.parse(await readFile(profilePath, 'utf-8')) as {
        profiles: Array<Record<string, unknown>>
      }
      const profile = store.profiles[0]
      expect(profile).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        scopeClass: 'env-api-key',
        pageCountBand: '11-50',
        ocrConcurrencyMode: 'auto',
        laneTargetCount: 1,
        throughputPagesPerMinute: 120,
        activePeak: 11,
        retryPressureCount: 0,
        pauseTimeMs: 0,
        completionStatus: 'full',
        sampleCount: 3,
        cleanSampleCount: 3,
        raisedMaxCap: 14,
        capSource: 'exact-clean-sample',
        sourceConfidence: 'healthy'
      })
      expect(Object.keys(profile ?? {}).sort()).toEqual([
        'activePeak',
        'capSource',
        'cleanSampleCount',
        'completionStatus',
        'firstSeenAt',
        'laneTargetCount',
        'lastSeenAt',
        'model',
        'ocrConcurrencyMode',
        'pageCountBand',
        'pauseTimeMs',
        'provider',
        'raisedMaxCap',
        'retryPressureCount',
        'sampleCount',
        'scopeClass',
        'sourceConfidence',
        'throughputPagesPerMinute'
      ])
      expect(JSON.stringify(store)).not.toContain('input.pdf')
      expect(JSON.stringify(store)).not.toContain('sk-')

      const estimate = findHostedOcrThroughputProfile({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        pageCount: 12,
        ocrConcurrencyMode: 'auto',
        profilePath
      })
      expect(estimate?.confidence).toBe('healthy')
    })
  })

  test('profile storage persists mixed run targets with target-level completion status', async () => {
    await withProfileStorePath(async (profilePath) => {
      const snapshot = buildSchedulerTelemetry({
        documentPages: 228,
        lanes: [
          buildLaneTelemetry({
            currentCap: 16,
            maxCap: 16,
            activePeak: 16,
            retryPressureCount: 1,
            submittedPages: 456,
            completedPages: 456,
            pagesPerMinute: 200,
            targets: [
              buildTargetTelemetry({
                targetKey: 'gemini:flash',
                submittedPages: 228,
                completedPages: 228,
                share: 0.5,
                pagesPerMinute: 300
              }),
              buildTargetTelemetry({
                targetKey: 'gemini:lite',
                model: 'gemini-3.5-flash-lite',
                submittedPages: 228,
                completedPages: 228,
                share: 0.5,
                pagesPerMinute: 150
              })
            ]
          }),
          buildLaneTelemetry({
            laneKey: 'deepinfra:env-api-key',
            service: 'deepinfra',
            currentCap: 16,
            maxCap: 16,
            activePeak: 16,
            submittedPages: 228,
            completedPages: 228,
            pagesPerMinute: 38,
            targets: [buildTargetTelemetry({
              targetKey: 'deepinfra:mistral-small-ocr',
              service: 'deepinfra',
              model: 'mistral-small-ocr',
              submittedPages: 228,
              completedPages: 228,
              pagesPerMinute: 38
            })]
          }),
          buildLaneTelemetry({
            laneKey: 'kimi:env-api-key',
            service: 'kimi',
            status: 'failed',
            currentCap: 1,
            maxCap: 16,
            activePeak: 16,
            retryPressureCount: 1,
            submittedPages: 228,
            completedPages: 227,
            failedPages: 1,
            pagesPerMinute: 22.7,
            targets: [buildTargetTelemetry({
              targetKey: 'kimi:kimi-latest',
              service: 'kimi',
              model: 'kimi-latest',
              status: 'failed',
              submittedPages: 228,
              completedPages: 227,
              failedPages: 1,
              pagesPerMinute: 22.7
            })]
          })
        ]
      })

      await persistHostedOcrThroughputProfiles(snapshot, {
        completionStatus: 'incomplete',
        profilePath,
        now: new Date('2026-07-11T12:00:00.000Z')
      })
      const store = JSON.parse(await readFile(profilePath, 'utf-8')) as {
        profiles: Array<Record<string, unknown>>
      }
      const byModel = new Map(store.profiles.map((profile) => [profile['model'], profile]))
      expect(byModel.get('gemini-3.5-flash')?.['completionStatus']).toBe('full')
      expect(byModel.get('gemini-3.5-flash-lite')?.['completionStatus']).toBe('full')
      expect(byModel.get('mistral-small-ocr')?.['completionStatus']).toBe('full')
      expect(byModel.get('kimi-latest')?.['completionStatus']).toBe('incomplete')
    })
  })
})
