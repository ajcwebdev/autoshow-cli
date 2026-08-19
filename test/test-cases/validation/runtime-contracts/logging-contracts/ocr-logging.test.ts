import { describe, expect, test } from 'bun:test'
import {
  buildOcrPagesProgressTable,
  buildOcrProviderLifecycleTable
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-logging'

describe('logging contracts', () => {
  test('ocr log table builders use key/value rows for single-record progress', () => {
      expect(buildOcrProviderLifecycleTable({
        provider: 'openai',
        model: 'gpt-5.4-nano',
        status: 'succeeded',
        elapsedMs: 1234
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'provider', value: 'openai' },
          { key: 'model', value: 'gpt-5.4-nano' },
          { key: 'status', value: 'succeeded' },
          { key: 'elapsedMs', value: 1234 }
        ]
      })

      expect(buildOcrPagesProgressTable({
        status: 'running',
        ocrPages: 2,
        totalPages: 5,
        renderConcurrency: 4,
        ocrConcurrency: 2
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'status', value: 'running' },
          { key: 'ocrPages', value: 2 },
          { key: 'totalPages', value: 5 },
          { key: 'renderConcurrency', value: 4 },
          { key: 'ocrConcurrency', value: 2 }
        ]
      })

    })
})
