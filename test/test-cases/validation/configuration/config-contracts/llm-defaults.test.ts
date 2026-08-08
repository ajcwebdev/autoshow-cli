import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import {
  buildConfigPatchFromFlags,
  extractExplicitFlags,
  mergeConfigIntoRawFlags,
  FLAG_TO_CONFIG_PATH
} from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeWriteStepSelectorFlags } from '~/cli/flags/service-selector-normalization/write-step-selectors'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import type { AutoshowConfig } from '~/types'
import { writeTempConfig } from './shared'

// Mirrors the config command handler: parse explicit flags off argv, expand the
// `--llm provider[=model]` selector into its per-provider target flag, then build
// the patch from the normalized flags and args.
const patchFromArgv = (argv: string[], flags: Record<string, unknown>): Record<string, unknown> => {
  const explicitFlags = extractExplicitFlags(argv)
  const normalized = normalizeWriteStepSelectorFlags(flags, explicitFlags, argv)
  return buildConfigPatchFromFlags(normalized.flags, normalized.explicitFlags, normalized.rawArgs ?? argv)
}

describe('config LLM default contracts', () => {
  test('config --llm llamafile=<model> persists and round-trips', async () => {
    const patch = patchFromArgv(
      ['config', '--llm', 'llamafile=Qwen3.5-2B-Q8_0'],
      { llm: ['llamafile=Qwen3.5-2B-Q8_0'] }
    )

    expect(patch).toEqual({
      defaults: {
        llm: {
          llamafile: ['Qwen3.5-2B-Q8_0']
        }
      }
    })

    const configPath = await writeTempConfig(patch)
    await expect(loadConfig(configPath)).resolves.toMatchObject(patch)

    expect(mergeConfigIntoRawFlags({}, patch as AutoshowConfig, new Set())).toMatchObject({
      llamafile: ['Qwen3.5-2B-Q8_0']
    })
  })

  test('repeated --llm llamafile selectors normalize to an array', () => {
    expect(patchFromArgv(
      ['config', '--llm', 'llamafile=Qwen3.5-2B-Q8_0', '--llm', 'llamafile=Qwen3.5-4B-Q5_K_S'],
      { llm: ['llamafile=Qwen3.5-2B-Q8_0', 'llamafile=Qwen3.5-4B-Q5_K_S'] }
    )).toEqual({
      defaults: {
        llm: {
          llamafile: ['Qwen3.5-2B-Q8_0', 'Qwen3.5-4B-Q5_K_S']
        }
      }
    })
  })

  // `llamafile` was advertised by `--llm`'s help and accepted by the selector, but had
  // no `FLAG_TO_CONFIG_PATH` entry, so `config --llm llamafile=X` warned and saved
  // nothing. Derive the check from the selector table so a new provider cannot drift
  // the same way.
  test('every --llm provider target has a config destination', () => {
    const missing = Object.values(WRITE_LLM_PROVIDER_TARGETS)
      .filter((target) => FLAG_TO_CONFIG_PATH[target] === undefined)

    expect(missing).toEqual([])
  })
})
