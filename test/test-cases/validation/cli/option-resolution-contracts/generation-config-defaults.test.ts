import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const withConfig = async (defaults: Record<string, unknown>, run: (configPath: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-generation-defaults-'))
  try {
    const configPath = join(directory, 'config.json')
    await Bun.write(configPath, JSON.stringify({ defaults }))
    await run(configPath)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const price = async (command: string, configPath: string, flags: string[] = []) => {
  const child = Bun.spawn(['bun', '--no-env-file', 'src/cli/create-cli.ts', command, 'A calm landscape', '--config-path', configPath, '--json', '--price', ...flags], {
    stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], NO_COLOR: '1' }
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect({ exitCode, stderr: exitCode === 0 ? '' : stderr }).toEqual({ exitCode: 0, stderr: '' })
  const result = JSON.parse(stdout.trim())
  expect(result.data.dryRun).toBe(true)
  return result.data.estimate as { steps: Array<{ provider: string, model: string }>, totalEstimatedCostCents: number }
}

describe('generation command config defaults through read-only price planning', () => {
  test('image applies saved selection/count and supports explicit provider, override, and reset', async () => {
    await withConfig({ image: { openaiImage: ['gpt-image-2.6-flare'], count: 2 } }, async configPath => {
      const saved = await price('image', configPath)
      expect(saved.steps.map(step => step.provider)).toEqual(['openai'])
      const override = await price('image', configPath, ['--count', '1'])
      await Bun.write(configPath, JSON.stringify({ defaults: { image: { openaiImage: ['gpt-image-2.6-flare'] } } }))
      const reset = await price('image', configPath)
      expect(saved.totalEstimatedCostCents).toBeGreaterThan(override.totalEstimatedCostCents)
      expect(reset.totalEstimatedCostCents).toBe(override.totalEstimatedCostCents)
      expect((await price('image', configPath, ['--provider', 'grok=grok-imagine-image-2.0'])).steps.map(step => step.provider)).toEqual(['grok'])
    })
  })

  test('video applies saved selection/duration and supports explicit provider, override, and reset', async () => {
    await withConfig({ video: { grokVideo: ['grok-imagine-video-1.5'], duration: 12 } }, async configPath => {
      const saved = await price('video', configPath)
      expect(saved.steps.map(step => step.provider)).toEqual(['grok'])
      const override = await price('video', configPath, ['--duration', '5'])
      await Bun.write(configPath, JSON.stringify({ defaults: { video: { grokVideo: ['grok-imagine-video-1.5'] } } }))
      const reset = await price('video', configPath)
      expect(saved.totalEstimatedCostCents).toBeGreaterThan(reset.totalEstimatedCostCents)
      expect(reset.totalEstimatedCostCents).toBeGreaterThan(override.totalEstimatedCostCents)
      expect((await price('video', configPath, ['--provider', 'gemini=gemini-omni-1.2-flash'])).steps.map(step => step.provider)).toEqual(['gemini'])
    })
  })

  test('a saved Sunburst default, a Flare override and a cleared default price at 2.6 rates; a saved retired 2.5 default fails with its successor', async () => {
    await withConfig({ image: { openaiImage: ['gpt-image-2.6-sunburst'] } }, async configPath => {
      const saved = await price('image', configPath, ['--size', '1024x1024', '--quality', 'medium'])
      expect(saved.steps.map(step => step.model)).toEqual(['gpt-image-2.6-sunburst'])
      expect(saved.totalEstimatedCostCents).toBeCloseTo(4.347, 6)
      const override = await price('image', configPath, ['--provider', 'openai=gpt-image-2.6-flare', '--size', '1024x1024', '--quality', 'low'])
      expect(override.steps.map(step => step.model)).toEqual(['gpt-image-2.6-flare'])
      expect(override.totalEstimatedCostCents).toBeCloseTo(2.469, 6)
      await Bun.write(configPath, JSON.stringify({ defaults: {} }))
      const reset = await price('image', configPath, ['--provider', 'openai', '--size', '1024x1024', '--quality', 'medium'])
      expect(reset.steps.map(step => step.model)).toEqual(['gpt-image-2.6-flare'])
      expect(reset.totalEstimatedCostCents).toBeCloseTo(4.347, 6)
      for (const [key, model, flag, replacement] of [['openaiImage', 'gpt-image-2.5-flare', 'openai', 'gpt-image-2.6-flare'], ['geminiImage', 'gemini-3.1-flash-lite-image', 'gemini', 'gemini-nano-banana-2.1']] as const) {
        await Bun.write(configPath, JSON.stringify({ defaults: { image: { [key]: [model] } } }))
        const child = Bun.spawn(['bun', '--no-env-file', 'src/cli/create-cli.ts', 'image', 'A calm landscape', '--config-path', configPath, '--price'], {
          stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], NO_COLOR: '1' }
        })
        const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
        expect(exitCode).toBe(2)
        expect(`${stdout}\n${stderr}`).toContain(`Model "${model}" is retired for --provider/--image ${flag}[=model]. Use "${replacement}" instead.`)
      }
    })
  })

  test('bare gemini video resolves to Omni 1.2, and a saved retired Omni 1.1 default fails before pricing with its successor', async () => {
    await withConfig({ video: { geminiVideo: ['gemini-omni-1.2-flash'], duration: 3, resolution: '360p' } }, async configPath => {
      const saved = await price('video', configPath)
      expect(saved.steps.map(step => step.model)).toEqual(['gemini-omni-1.2-flash'])
      expect(saved.totalEstimatedCostCents).toBeCloseTo(6.9516, 6)
      await Bun.write(configPath, JSON.stringify({ defaults: {} }))
      const bare = await price('video', configPath, ['--provider', 'gemini'])
      expect(bare.steps.map(step => step.model)).toEqual(['gemini-omni-1.2-flash'])
      await Bun.write(configPath, JSON.stringify({ defaults: { video: { geminiVideo: ['gemini-omni-1.1-flash'] } } }))
      const child = Bun.spawn(['bun', '--no-env-file', 'src/cli/create-cli.ts', 'video', 'A calm landscape', '--config-path', configPath, '--price'], {
        stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], NO_COLOR: '1' }
      })
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(exitCode).toBe(2)
      expect(`${stdout}\n${stderr}`).toContain('Model "gemini-omni-1.1-flash" is retired for --provider/--video gemini[=model]. Use "gemini-omni-1.2-flash" instead.')
    })
  })

  test('music applies saved selection/duration and supports explicit provider, override, and reset', async () => {
    await withConfig({ music: { elevenlabsMusic: ['music_v2_5'], duration: 12 } }, async configPath => {
      const saved = await price('music', configPath)
      expect(saved.steps.map(step => step.provider)).toEqual(['elevenlabs'])
      const override = await price('music', configPath, ['--duration', '6'])
      await Bun.write(configPath, JSON.stringify({ defaults: { music: { elevenlabsMusic: ['music_v2_5'] } } }))
      const reset = await price('music', configPath)
      expect(reset.totalEstimatedCostCents).toBeGreaterThan(saved.totalEstimatedCostCents)
      expect(saved.totalEstimatedCostCents).toBeGreaterThan(override.totalEstimatedCostCents)
      expect((await price('music', configPath, ['--provider', 'gemini=lyria-3.5'])).steps.map(step => step.provider)).toEqual(['gemini'])
    })
  })
})
