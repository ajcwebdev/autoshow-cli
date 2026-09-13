import { expect, test } from 'bun:test'
import { runCommandAndExpectOutputDir } from '../../../test-utils/service-test-kit'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('a transient provider failure cannot silently rerun the entire command', async () => {
  await withTempDir('service-command-once-', async dir => {
    const countPath = `${dir}/calls.txt`
    const script = `${dir}/failure.ts`
    await Bun.write(script, `const path = Bun.argv[2]!; const prior = await Bun.file(path).exists() ? Number(await Bun.file(path).text()) : 0; await Bun.write(path, String(prior + 1)); console.error('transient fixture provider failure'); process.exit(1)\n`)
    // Exercise the old runtime option shape too: it must no longer authorize redispatch.
    const legacyOptions = { transient: { isTransient: () => true, providerLabel: 'fixture', persistedLabel: 'fixture', retryDelayMs: 0 } }
    await expect(runCommandAndExpectOutputDir('fixture', [script, countPath], undefined, legacyOptions as Parameters<typeof runCommandAndExpectOutputDir>[3])).rejects.toThrow('Command failed')
    expect(await Bun.file(countPath).text()).toBe('1')
  })
})
