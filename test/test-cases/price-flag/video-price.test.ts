import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'

const withTempImage = async <T,>(fn: (path: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-video-price-image-'))
  try {
    const imagePath = join(dir, 'input.png')
    await writeFile(imagePath, new Uint8Array([1, 2, 3]))
    return await fn(imagePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('allows multiple providers with --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-generate-preview', '--provider', 'minimax=MiniMax-Hailuo-2.3', '--provider', 'glm=cogvideox-3', '--provider', 'grok=grok-imagine-video', '--provider', 'runway=gen4.5', '--provider', 'ltx=ltx-2-3-fast', '--provider', 'replicate=wan-video/wan-2.7-t2v', '--provider', 'lumalabs=ray-3.2', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('gemini')
  expect(output).toContain('minimax')
  expect(output).toContain('glm')
  expect(output).toContain('grok')
  expect(output).toContain('runway')
  expect(output).toContain('ltx')
  expect(output).toContain('replicate')
  expect(output).toContain('lumalabs')
  expect(output).toContain('generated-video-gemini-veo-3.1-generate-preview.mp4')
  expect(output).toContain('generated-video-minimax-MiniMax-Hailuo-2.3.mp4')
  expect(output).toContain('generated-video-replicate-wan-video-wan-2.7-t2v.mp4')
})

test('positional image input defaults to compatible image-to-video targets with --price', async () => {
  await withTempImage(async (imagePath) => {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'video', imagePath, '--price'],
    )
    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(0)
    expect(output).toContain('generated-video-gemini-veo-3.1-fast-generate-preview.mp4')
    expect(output).toContain('generated-video-minimax-MiniMax-Hailuo-2.3.mp4')
    expect(output).toContain('generated-video-ltx-ltx-2-3-fast.mp4')
    expect(output).not.toContain('generated-video-runway-gen4.5.mp4')
    expect(output).not.toContain('generated-video-minimax-T2V-01.mp4')
    expect(output).not.toContain('generated-video-replicate-wan-video-wan-2.7-t2v.mp4')
  })
})
