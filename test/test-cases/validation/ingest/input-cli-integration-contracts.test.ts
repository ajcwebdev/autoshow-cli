import { afterEach, describe, expect, test } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { WRITE_NON_TEXT_INPUT_MESSAGE } from '~/cli/commands/text/write/run-write-command'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { STABLE_TTS_MD_PATH, runCommand } from '../../../test-utils/test-helpers'

const tempDirs: string[] = []

const createUnsupportedInput = async (): Promise<string> => {
  const dir = await makeTempDir('autoshow-validation-input-')
  tempDirs.push(dir)
  const filePath = join(dir, 'unknown.payload')
  await writeFile(filePath, 'plain text without a supported extension')
  return filePath
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('input classification contracts', () => {

  test('X Space metadata uses the X lookup path instead of unsupported input rejection', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'metadata',
      'https://x.com/i/spaces/1DXxyRYNejbKM'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('X_BEARER_TOKEN environment variable is required for X/Twitter Space metadata')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('unsupported')
  })

  test('X post downloads use the X lookup path instead of unsupported input rejection', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://x.com/example/status/1234567890123456789'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('X_BEARER_TOKEN environment variable is required for X/Twitter Space download')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('unsupported')
  })

  test('X Space write rejects non-text input instead of running extraction', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      'https://x.com/i/spaces/1DXxyRYNejbKM'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain(WRITE_NON_TEXT_INPUT_MESSAGE)
  })

  test('write URL-list files are rejected as extract inputs', async () => {
    const dir = await makeTempDir('autoshow-validation-write-list-')
    tempDirs.push(dir)
    const listPath = join(dir, 'inputs.md')
    await writeFile(listPath, [
      'https://example.com/articles/story.html',
      '1DXxyRYNejbKM'
    ].join('\n'))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      listPath,
      '--batch-limit',
      'all',
      '--price'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain(WRITE_NON_TEXT_INPUT_MESSAGE)
  })

  test('unsupported input types produce a usage error message', async () => {
    const inputPath = await createUnsupportedInput()
    const result = await runCommand(['src/cli/create-cli.ts', 'extract', inputPath, '--price'])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain(`Could not classify extract input "${inputPath}"`)
  })

  test('write rejects extract STT flags', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      STABLE_TTS_MD_PATH,
      '--stt',
      'whisper=tiny',
      '--stt',
      'assemblyai=universal-3-5-pro',
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Unexpected flag: --stt')
  })
})
