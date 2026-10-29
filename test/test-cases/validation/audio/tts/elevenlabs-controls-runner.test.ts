import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { withLocalTestDir } from '../../../../test-utils/temp-dirs'

// Official v4 prompting guidance checked 2026-10-29:
// https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v4
// Short/long pause tags are qualitative; numeric speed and SSML are excluded.
test('Eleven v4 controls runner selects both documented cases, quotes native character rates and preserves the ledger without dispatch', async () => {
  await withLocalTestDir('elevenlabs-controls-runner', async root => {
    for (const suite of ['emotion', 'speed-pauses']) {
      const plan = await Bun.file(`test/fixtures/tts-controls/${suite}/benchmark-plan.json`).json()
      const cases = plan.cases.filter((entry: { provider: string }) => entry.provider === 'elevenlabs')
      for (const entry of cases) entry.input = resolve(entry.input)
      await Bun.write(join(root, 'input/examples/tts/controls', suite, 'benchmark-plan.json'), JSON.stringify({ schemaVersion: 1, cases }))
    }
    const ledgerPath = join(root, 'input/examples/tts/controls/benchmark-plan.json')
    const ledger = JSON.stringify({ schemaVersion: 2, priorEstimatedCents: 123, outputBase: 'benchmark-output', benchmarkDate: '2000-01-01' })
    await Bun.write(ledgerPath, ledger)
    const invoke = async (...args: string[]) => {
      const child = Bun.spawn([process.execPath, '--no-env-file', resolve('src/tools/tts-controls-benchmark.ts'), ...args], {
        cwd: root, env: { PATH: Bun.env['PATH'] ?? '' }, stdout: 'pipe', stderr: 'pipe'
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, stdout, stderr }
    }
    const price = await invoke('--suite', 'all', '--provider', 'elevenlabs=eleven_v4', '--price')
    expect(price.code).toBe(0)
    const result = JSON.parse(price.stdout)
    expect(result).toMatchObject({ mode: 'price', spentCents: 123, incrementalCents: 4.864, incrementalAuthorizationCents: 4.864 })
    expect(result.cases).toEqual([
      expect.objectContaining({ suite: 'emotion', id: 'elevenlabs-eleven-v4-tags', reuse: false, estimatedCents: 2.352 }),
      expect.objectContaining({ suite: 'speed-pauses', id: 'elevenlabs-eleven-v4-pause-tags', reuse: false, estimatedCents: 2.512 })
    ])
    for (const suite of ['emotion', 'speed-pauses']) {
      const selected = await invoke('--suite', suite, '--provider', 'elevenlabs=eleven_v4', '--price')
      expect(selected.code).toBe(0)
      expect(JSON.parse(selected.stdout).cases).toHaveLength(1)
      expect(JSON.parse(selected.stdout).cases[0].suite).toBe(suite)
    }
    const bare = await invoke('--provider', 'elevenlabs', '--price')
    expect(bare.code).toBe(0)
    expect(JSON.parse(bare.stdout).cases.map((entry: { id: string }) => entry.id)).toEqual([
      'elevenlabs-eleven-v3-tags', 'elevenlabs-eleven-v4-tags',
      'elevenlabs-eleven-v3-pacing-tags', 'elevenlabs-eleven-v4-pause-tags'
    ])
    const invalid = await invoke('--provider', 'elevenlabs=unknown', '--price')
    expect(invalid.code).not.toBe(0)
    expect(invalid.stderr).toContain('No documented cases')
    const blocked = await invoke('--provider', 'elevenlabs=eleven_v4', '--run')
    expect(blocked.code).not.toBe(0)
    expect(blocked.stderr).toContain('Combined spending bound exceeds')
    expect(await Bun.file(ledgerPath).text()).toBe(ledger)
    expect(await readdir(root)).toEqual(['input'])
  })
})
