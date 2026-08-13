import { afterEach, describe, expect, test } from 'bun:test'
import { processBatch } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import type { BatchSource, PipelineManifest, ProcessCommand } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

afterEach(() => resetPinnedRunDir())

describe('batch manifest identity contracts', () => {
  for (const fixture of [
    {
      name: 'RSS download',
      command: 'download' as ProcessCommand,
      source: {
        sourceKind: 'podcast_rss',
        sourceUrl: 'https://example.test/feed.xml',
        title: 'Fixture feed',
        items: [{ id: 'episode-1', url: 'https://example.test/audio.mp3' }]
      } satisfies BatchSource
    },
    {
      name: 'URL-list download',
      command: 'download' as ProcessCommand,
      source: {
        sourceKind: 'url_list',
        sourceUrl: '/fixtures/urls.md',
        items: [{ id: 'url-1', url: 'https://example.test/audio.mp3' }]
      } satisfies BatchSource
    },
    {
      name: 'project-directory write',
      command: 'write' as ProcessCommand,
      source: undefined
    }
  ]) {
    test(`${fixture.name} completion replaces only manifest items`, async () => {
      await withTempDir('autoshow-batch-manifest-identity-', async (outputDir) => {
        configurePinnedRunDir(outputDir)
        let initialManifest: PipelineManifest | undefined

        await processBatch(
          ['https://example.test/audio.mp3'],
          'fixture-batch',
          fixture.command,
          {},
          async (_command, input, batchDir) => {
            initialManifest = await readManifest(batchDir)
            return {
              itemRecord: {
                input,
                completionStatus: 'full',
                step1: { title: 'Completed fixture' }
              }
            }
          },
          fixture.source ? { source: fixture.source, concurrency: 1 } : { concurrency: 1 }
        )

        const completedManifest = await readManifest(outputDir)
        expect(initialManifest).toBeDefined()
        expect(completedManifest).toBeDefined()
        expect(completedManifest?.command).toBe(initialManifest?.command)
        expect(completedManifest?.scope).toBe(initialManifest?.scope)
        expect(completedManifest?.source).toEqual(initialManifest?.source)
        expect(completedManifest?.createdAt).toBe(initialManifest?.createdAt)
        expect(completedManifest?.items[0]?.status).toBe('full')
      })
    })
  }
})
