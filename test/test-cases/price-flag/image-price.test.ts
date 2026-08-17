import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { runCommand } from '../../test-utils/test-helpers'

test('--price allows multiple image providers and reports each image step', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--provider', 'grok=grok-imagine-image-quality', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('openai')
  expect(output).toContain('grok')
  expect(output).toContain('generated-image-openai-gpt-image-2.png')
  expect(output).toContain('generated-image-grok-grok-imagine-image-quality.jpg')
})

test('image --out in price mode reports explicit output directory without creating it', async () => {
  const outputDir = 'output/test-image'
  const existedBefore = existsSync(outputDir)

  try {
    expect(existedBefore).toBe(false)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'image', 'a sunset over a lake', '--provider', 'openai=gpt-image-2', '--output-dir', outputDir, '--price'],
    )
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(result.outputDir).toBeNull()
    expect(output).toContain('Expected files')
    expect(output).toContain('output/test-image/')
    expect(existsSync(outputDir)).toBe(false)
  } finally {
    if (!existedBefore) {
      await rm(outputDir, { recursive: true, force: true })
    }
  }
})
