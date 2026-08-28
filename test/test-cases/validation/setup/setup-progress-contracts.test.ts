import { describe, expect, test } from 'bun:test'
import {
  runConcurrentSetupTasks,
  runInherit,
  shouldReportReclaimedBuildTrees
} from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { formatSetupElapsed, formatSetupHeartbeatLine } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import { setCompactSetupMode } from '~/utils/setup-output-mode'
import { expectProviderHttpError } from '../../../test-utils/rest-contract-helpers'

const waitForTurn = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('setup progress contracts', () => {
  test('compact setup subprocess failures include a bounded output tail', async () => {
    setCompactSetupMode(true)
    try {
      const error = await expectProviderHttpError(
        () => runInherit('bun', [
          '-e',
          'for (let i = 0; i < 80; i++) console.log(`stdout-line-${i}`); console.error("stderr-tail-line"); process.exit(7)'
        ]),
        { messageContains: ['exit code 7', 'stderr-tail-line', 'stdout-line-79'] }
      )
      expect(error.message).not.toContain('stdout-line-0')
    } finally {
      setCompactSetupMode(false)
    }
  })

  test('concurrent setup tasks start independent tasks before the slowest task finishes', async () => {
    const events: string[] = []
    let releaseSlow!: () => void
    const slowTask = new Promise<void>((resolve) => { releaseSlow = resolve })

    const pending = runConcurrentSetupTasks([
      {
        label: 'slow',
        run: async () => {
          events.push('slow:start')
          await slowTask
          events.push('slow:done')
        }
      },
      {
        label: 'fast',
        run: async () => {
          events.push('fast:start')
        }
      }
    ])

    expect(events).toEqual(['slow:start', 'fast:start'])
    releaseSlow()
    await pending
    expect(events).toEqual(['slow:start', 'fast:start', 'slow:done'])
  })

  test('concurrent setup tasks wait for all tasks even when one fails', async () => {
    const events: string[] = []
    let releaseSlow!: () => void
    const slowTask = new Promise<void>((resolve) => { releaseSlow = resolve })
    const pending = runConcurrentSetupTasks([
      {
        label: 'failing',
        run: async () => {
          events.push('failing:start')
          throw new Error('boom')
        }
      },
      {
        label: 'slow',
        run: async () => {
          events.push('slow:start')
          await slowTask
          events.push('slow:done')
        }
      }
    ])
    let rejected = false
    void pending.catch(() => { rejected = true })

    await waitForTurn()
    expect(rejected).toBe(false)

    releaseSlow()
    await expect(pending).rejects.toThrow('Setup tasks failed')
    expect(events).toEqual(['failing:start', 'slow:start', 'slow:done'])
  })

  test('concurrent setup task failures include task labels', async () => {
    let message = ''
    try {
      await runConcurrentSetupTasks([
        {
          label: 'media tools',
          run: async () => { throw new Error('media failed') }
        },
        {
          label: 'OCR',
          run: async () => { throw new Error('ocr failed') }
        }
      ])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain('media tools: media failed')
    expect(message).toContain('OCR: ocr failed')
  })

  test('the setup heartbeat reports every quiet task on one line', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'media tools', startedAtMs: now - 250_000, lastActivityAtMs: now - 250_000 },
      { label: 'OCR', startedAtMs: now - 90_000, lastActivityAtMs: now - 90_000 }
    ], now, 30_000)

    expect(line).toBe('Still running: media tools 4m 10s · OCR 1m 30s')
  })

  test('the setup heartbeat stays silent when every task logged recently', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'llama', startedAtMs: now - 250_000, lastActivityAtMs: now - 5_000 },
      { label: 'Whisper', startedAtMs: now - 120_000, lastActivityAtMs: now - 1_000 }
    ], now, 30_000)

    expect(line).toBeUndefined()
  })

  test('the setup heartbeat omits only the task that logged recently', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'llama', startedAtMs: now - 250_000, lastActivityAtMs: now - 2_000 },
      { label: 'media tools', startedAtMs: now - 250_000, lastActivityAtMs: now - 250_000 }
    ], now, 30_000)

    expect(line).toBe('Still running: media tools 4m 10s')
  })

  test('setup elapsed times switch to minutes instead of reporting 240.0s', () => {
    expect(formatSetupElapsed(900)).toBe('900ms')
    expect(formatSetupElapsed(45_600)).toBe('45.6s')
    expect(formatSetupElapsed(250_000)).toBe('4m 10s')
  })

  test('an empty build tree is not reported as reclaimed disk', () => {
    expect(shouldReportReclaimedBuildTrees(8192)).toBe(false)
    expect(shouldReportReclaimedBuildTrees(64 * 1024 * 1024)).toBe(true)
  })
})
