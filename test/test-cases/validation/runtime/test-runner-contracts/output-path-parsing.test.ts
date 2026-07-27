import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { runCommand, STABLE_EXAMPLE_AUDIO_URL } from '../../../../test-utils/test-helpers'
import { sanitizeLogText } from '~/utils/app-logger/redaction'

describe('test-runner output path parsing', () => {
  test('runCommand preserves a real manifest directory for a dotted audio URL', async () => {
    let realOutputDir = ''
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL],
      {
        attemptRunner: async ({ outputRoot }) => {
          realOutputDir = join(outputRoot, 'downloaded_audio')
          await mkdir(realOutputDir, { recursive: true })
          await Bun.write(join(realOutputDir, 'run.json'), '{}')
          return {
            exitCode: 0,
            stdout: sanitizeLogText(`outputDir: ${realOutputDir}\n`),
            stderr: '',
          }
        },
      }
    )

    expect(result.exitCode).toBe(0)
    expect(basename(result.outputRoot)).not.toContain('.')
    expect(result.outputDir).toBe(realOutputDir)
    expect(await Bun.file(join(result.outputDir as string, 'run.json')).exists()).toBe(true)
  })
})
