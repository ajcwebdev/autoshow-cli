import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { executeBatchItem } from '~/cli/commands/sources/download/download-targets/download-batch/execute-batch-item'
import { SttPartialCompletionError } from '~/cli/commands/stt/batch'
import type { BatchItemProcessResult, ExecuteBatchItemContext, PipelineItemRecord } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

type Processor = () => Promise<BatchItemProcessResult | void>

const contextFor = (sttLike: boolean, process: Processor): ExecuteBatchItemContext<object> => ({
  command: 'extract',
  batchDir: '/unused-batch-dir',
  batchDirName: 'fixture-batch',
  opts: {},
  runOpts: {},
  processSingleTarget: async () => await process(),
  sttLike,
  itemCount: 1
})

const run = async (sttLike: boolean, process: Processor) =>
  await executeBatchItem(contextFor(sttLike, process), 'fixture-item', 0)

describe('executeBatchItem outcome contracts', () => {
  test('STT-like items derive their outcome from the recorded completion status', async () => {
    const full: PipelineItemRecord = { completionStatus: 'full' }
    const failed: PipelineItemRecord = { completionStatus: 'failed', errors: [{ message: 'one' }] }
    const withErrors: PipelineItemRecord = { errors: [{ message: 'one' }, { message: 'two' }] }

    expect(await run(true, async () => ({ itemRecord: full }))).toEqual({ itemRecord: full, errorCount: 0, status: 'ok' })
    expect(await run(true, async () => ({ itemRecord: failed }))).toEqual({ itemRecord: failed, errorCount: 1, status: 'failed' })
    expect(await run(true, async () => ({ itemRecord: withErrors }))).toEqual({ itemRecord: withErrors, errorCount: 2, status: 'incomplete' })
    expect(await run(true, async () => undefined)).toEqual({ itemRecord: null, errorCount: 0, status: 'ok' })
  })

  test('non-STT items report provider failures as partial and attach the output directory', async () => {
    const clean: PipelineItemRecord = { completionStatus: 'full' }
    const withErrors: PipelineItemRecord = { errors: [{ message: 'one' }] }

    expect(await run(false, async () => ({ itemRecord: clean }))).toEqual({ itemRecord: clean, errorCount: 0, status: 'ok' })
    expect(await run(false, async () => ({ itemRecord: withErrors, outputDir: 'relative-output' }))).toEqual({
      itemRecord: { errors: [{ message: 'one' }], outputDir: resolve('relative-output') },
      errorCount: 1,
      status: 'partial'
    })
  })

  test('non-STT items preserve recorded failure and incomplete statuses without error entries', async () => {
    for (const completionStatus of ['failed', 'incomplete'] as const) {
      const itemRecord: PipelineItemRecord = { completionStatus }
      expect(await run(false, async () => ({ itemRecord }))).toEqual({
        itemRecord,
        errorCount: 0,
        status: completionStatus === 'failed' ? 'failed' : 'partial'
      })
    }
  })

  test('STT partial-completion errors keep the failure and classify by completion status', async () => {
    await withTempDir('autoshow-execute-batch-item-', async (outputDir) => {
      const failed = new SttPartialCompletionError(outputDir, 'failed', [], 'no providers completed')
      const incomplete = new SttPartialCompletionError(outputDir, 'incomplete', [], 'some providers missing')

      expect(await run(true, async () => { throw failed })).toEqual({ itemRecord: { outputDir }, errorCount: 0, status: 'failed', failureError: failed })
      expect(await run(true, async () => { throw incomplete })).toEqual({ itemRecord: { outputDir }, errorCount: 0, status: 'incomplete', failureError: incomplete })
      expect(await run(false, async () => { throw failed })).toEqual({ itemRecord: null, errorCount: 0, status: 'failed', failureError: failed })
    })
  })

  test('other thrown values fail the item without a record', async () => {
    const error = new Error('fixture failure')
    expect(await run(false, async () => { throw error })).toEqual({ itemRecord: null, errorCount: 0, status: 'failed', failureError: error })
    expect(await run(true, async () => { throw 'string failure' })).toEqual({ itemRecord: null, errorCount: 0, status: 'failed', failureError: 'string failure' })
  })
})
