import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { executeBatchPlan } from '~/cli/commands/sources/download/download-targets/download-batch/batch-executor'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import type { BatchCommandOptions, BatchExecutionPlan, ExtractRoute, InputFamily, PlannedBatchInput } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

afterEach(() => resetPinnedRunDir())

// Items fail before any provider or network work because the options omit every extract selection.
const incompleteExtractOptions = (outputRootDir: string): BatchCommandOptions =>
  ({ step2SelectionOrigins: {}, outputRootDir, batchConcurrency: 1 }) as unknown as BatchCommandOptions

const plannedInput = (input: string, inputFamily: InputFamily, extractRoute?: ExtractRoute): PlannedBatchInput =>
  ({ input, inputFamily, resolvedStep2: { route: 'unsupported', sourceKind: 'unsupported' }, ...(extractRoute ? { extractRoute } : {}) }) as PlannedBatchInput

const captureFailure = async (run: () => Promise<void>): Promise<Record<string, unknown>> => {
  try {
    await run()
  } catch (error) {
    const failure = error as Error & { stage?: unknown, exitCode?: unknown }
    return { name: failure.name, message: failure.message, stage: failure.stage, exitCode: failure.exitCode }
  }
  return { name: 'no failure' }
}

describe('extract batch plan contracts', () => {
  for (const fixture of [
    { route: 'document', family: 'document', input: 'missing.pdf', message: 'Batch processing failed for 1 item(s)', stage: 'extract:ocr' },
    { route: 'article', family: 'html_article', input: 'missing.html', message: 'Article batch processing failed for 1 item(s)', stage: 'extract:url' },
    { route: 'x-space', family: 'x_space', input: '1vOxwAbcdEfGh', message: 'X Space batch processing failed for 1 item(s)', stage: 'extract:url' }
  ] satisfies Array<{ route: ExtractRoute, family: InputFamily, input: string, message: string, stage: string }>) {
    test(`a fully failed ${fixture.route} child batch fails the parent batch`, async () => {
      await withTempDir('autoshow-extract-batch-plan-', async (outputDir) => {
        configurePinnedRunDir(outputDir)
        const item = fixture.route === 'x-space' ? fixture.input : join(outputDir, fixture.input)
        const plan: BatchExecutionPlan = {
          label: 'fixture-batch',
          items: [item],
          initialRecords: [{}],
          resultEntryIndexes: [0],
          plannedInputs: [plannedInput(item, fixture.family, fixture.route)]
        }

        expect(await captureFailure(async () => await executeBatchPlan('extract', incompleteExtractOptions(outputDir), plan))).toEqual({
          name: 'AppInfrastructureError',
          message: fixture.message,
          stage: fixture.stage,
          exitCode: 1
        })

        const manifest = await readManifest(outputDir)
        expect(manifest?.source).toBeUndefined()
        expect(manifest?.items).toEqual([
          expect.objectContaining({
            input: item,
            extractRoute: fixture.route,
            child: { route: fixture.route, index: 0, manifestDir: fixture.route },
            status: 'incomplete'
          })
        ])
      })
    })
  }

  test('the parent manifest records the batch source and skipped inputs; the document failure is reported first', async () => {
    await withTempDir('autoshow-extract-batch-plan-', async (outputDir) => {
      configurePinnedRunDir(outputDir)
      const document = join(outputDir, 'missing.pdf')
      const article = join(outputDir, 'missing.html')
      const plan: BatchExecutionPlan = {
        label: 'fixture-batch',
        items: [document, article],
        initialRecords: [{}, {}, { skipReason: 'unsupported fixture' }],
        resultEntryIndexes: [0, 1],
        plannedInputs: [
          plannedInput(document, 'document', 'document'),
          plannedInput(article, 'html_article', 'article'),
          plannedInput('skipped.bin', 'unsupported')
        ],
        source: { sourceKind: 'url_list', sourceUrl: '/fixtures/list.md', title: 'Fixture list', items: [] }
      }

      expect(await captureFailure(async () => await executeBatchPlan('extract', incompleteExtractOptions(outputDir), plan))).toEqual({
        name: 'AppInfrastructureError',
        message: 'Batch processing failed for 1 item(s)',
        stage: 'extract:ocr',
        exitCode: 1
      })

      const manifest = await readManifest(outputDir)
      expect(manifest?.source).toEqual({ sourceKind: 'url_list', sourceUrl: '/fixtures/list.md', title: 'Fixture list', selectedCount: 3 })
      expect(manifest?.items.map((item) => [item.input, item.extractRoute, item.status])).toEqual([
        [document, 'document', 'incomplete'],
        [article, 'article', 'incomplete'],
        ['skipped.bin', undefined, 'skipped']
      ])
      expect(manifest?.items[2]?.metadata).toEqual({ skipReason: 'unsupported fixture' })
    })
  })

  test('a plan without runnable inputs writes the manifest and returns', async () => {
    await withTempDir('autoshow-extract-batch-plan-', async (outputDir) => {
      configurePinnedRunDir(outputDir)
      const plan: BatchExecutionPlan = {
        label: 'fixture-batch',
        items: [],
        initialRecords: [{}],
        resultEntryIndexes: [],
        plannedInputs: [plannedInput('skipped.bin', 'unsupported')]
      }

      await executeBatchPlan('extract', incompleteExtractOptions(outputDir), plan)
      expect((await readManifest(outputDir))?.items.map((item) => item.status)).toEqual(['skipped'])
    })
  })
})
