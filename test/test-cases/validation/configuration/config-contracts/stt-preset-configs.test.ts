import { expect, test } from 'bun:test'
import { Glob } from 'bun'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

const presets = [...new Glob('config/stt-*.json').scanSync('.')].sort()

test('the tracked STT presets exist', () => {
  expect(presets).toEqual(['config/stt-local.json', 'config/stt-with-speakers.json', 'config/stt-without-speakers.json'])
})

// A preset that names an excluded provider or a retired model fails at load or option resolution, so every tracked
// preset must still resolve to active registry targets through the same path as --config-path.
for (const preset of presets) {
  test(`${preset} loads and resolves only active STT registry targets`, async () => {
    const config = await loadConfig(preset)
    const opts = buildOptsFromFlags(mergeConfigIntoRawFlags({}, config, new Set()))
    const targets = collectSttTargets(opts)
    expect(targets.length).toBeGreaterThan(0)
    const registry = getModelRegistry().stt
    for (const target of targets) expect(registry[target.service]?.models[target.model]).toBeDefined()
  })
}
