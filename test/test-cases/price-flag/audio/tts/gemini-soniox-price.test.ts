import { expect, test } from 'bun:test'
import { runCommand, STABLE_TTS_MD_PATH } from '../../../../test-utils/test-helpers'

// These CLI checks always use --price. Mocked synthesis coverage lives in validation/audio/tts.
const cases = [
  { provider: 'soniox', model: 'tts-rt-v2', mode: undefined },
  ...['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].flatMap(model =>
    ['unary', 'stream', 'batch'].map(mode => ({ provider: 'gemini', model, mode }))
  )
]

for (const { provider, model, mode } of cases) {
  test(`${provider}/${model}/${mode ?? 'REST'} price-only CLI reports the selected model without synthesis`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH,
      '--provider', `${provider}=${model}`,
      ...(mode ? ['--gemini-tts-mode', mode] : []), '--price', '--json'
    ])
    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.trim())
    expect(output.data.dryRun).toBe(true)
    expect(output.data.estimate.steps).toHaveLength(1)
    expect(output.data.estimate.steps[0]).toMatchObject({
      provider, model, ...(mode ? { executionMode: mode } : {})
    })
    expect(output.data.estimate.steps[0].totalCostCents).toBeGreaterThan(0)
  })
}
