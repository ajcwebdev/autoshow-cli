import { describe, expect, test } from 'bun:test'
import {
  buildOcrJobProgressTable,
  buildOcrPagesProgressTable,
  buildOcrProviderLifecycleTable,
  buildOcrTransferTable
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

      expect(buildOcrJobProgressTable({
        provider: 'deepinfra',
        action: 'poll',
        remoteId: 'job-123',
        state: 'in_progress',
        pages: 7,
        detail: 'attempt 10'
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'provider', value: 'deepinfra' },
          { key: 'action', value: 'poll' },
          { key: 'remoteId', value: 'job-123' },
          { key: 'state', value: 'in_progress' },
          { key: 'pages', value: 7 },
          { key: 'detail', value: 'attempt 10' }
        ]
      })

      expect(buildOcrJobProgressTable({
        provider: 'deepinfra',
        action: 'launch',
        state: 'queued'
      }).rows).toEqual([
        { key: 'provider', value: 'deepinfra' },
        { key: 'action', value: 'launch' },
        { key: 'state', value: 'queued' }
      ])
    })

  test('ocr log table builders use key/value rows for single-operation details', () => {
      expect(buildOcrTransferTable({
        action: 'upload',
        file: 'document.pdf',
        destination: 's3://bucket/document.pdf'
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'action', value: 'upload' },
          { key: 'file', value: 'document.pdf' },
          { key: 'destination', value: 's3://bucket/document.pdf' }
        ]
      })
    })
})
