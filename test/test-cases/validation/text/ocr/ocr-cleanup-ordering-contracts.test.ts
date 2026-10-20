import { describe, expect, test } from 'bun:test'
import type { HostedOcrScheduler, PreparedDocument } from '~/types'
import { processOcr } from '~/cli/commands/text/ocr/process-ocr'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { withTempDir } from '../../../../test-utils/temp-dirs'

// A scheduler that fails as soon as processOcr asks for its lifetime, before any target runs.
const failingScheduler = (message: string): HostedOcrScheduler => ({
  getLifetime: () => { throw new Error(message) }
}) as unknown as HostedOcrScheduler

const preparedWithCleanup = (outputDir: string, tempCleanup: () => Promise<void>): PreparedDocument => ({
  outputDir,
  step1Metadata: { slug: 'scan', pageCount: 1, format: 'pdf', fileSize: 4 },
  tempCleanup
})

describe('OCR cleanup ordering contracts', () => {
  test('a failure while preparing the OCR scheduler still removes the downloaded source', async () => {
    await withTempDir('autoshow-ocr-cleanup-', async (outputDir) => {
      let sourceCleanups = 0

      await expect(processOcr(
        'scan.pdf',
        { outputDir, hostedOcrScheduler: failingScheduler('scheduler unavailable') },
        undefined,
        preparedWithCleanup(outputDir, async () => { sourceCleanups += 1 })
      )).rejects.toThrow('scheduler unavailable')

      expect(sourceCleanups).toBe(1)
    })
  })

  test('a failing source cleanup is logged and does not replace the original OCR error', async () => {
    const { events } = await withTempDir('autoshow-ocr-cleanup-', async (outputDir) =>
      await captureLogEvents(async () => {
        await expect(processOcr(
          'scan.pdf',
          { outputDir, hostedOcrScheduler: failingScheduler('scheduler unavailable') },
          undefined,
          preparedWithCleanup(outputDir, async () => { throw new Error('source removal failed') })
        )).rejects.toThrow('scheduler unavailable')
      }))

    const warnings = events.filter((event) => event.level === 'warn' && event.message.includes('source removal failed'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.message).toBe('OCR cleanup failed after an earlier error: source removal failed')
  })
})
