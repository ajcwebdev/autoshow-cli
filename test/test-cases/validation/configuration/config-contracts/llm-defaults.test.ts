import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import {
  buildConfigPatchFromFlags,
  mergeConfigIntoRawFlags,
  FLAG_TO_CONFIG_PATH
} from '~/cli/commands/setup-and-utilities/config/config-merge'
import { collectRepeatableModelFlagOccurrences, normalizeModelFlagOccurrences, REPEATABLE_MODEL_FLAGS } from '~/cli/options/option-resolution/model-flag-selection'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { SUPPORTED_LLAMAFILE_MODELS } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { normalizeWriteStepSelectorFlags } from '~/cli/flags/service-selector-normalization/write-step-selectors'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import type { AutoshowConfig } from '~/types'
import { writeTempConfig } from './shared'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'

// Mirrors the config command handler: expand the parsed `--llm provider[=model]`
// occurrences into per-provider target occurrences, then build the patch.
const patchFromArgv = (_argv: string[], flags: Record<string, unknown>): Record<string, unknown> => {
  const explicitFlags = new Set(Object.keys(flags))
  const normalized = normalizeWriteStepSelectorFlags(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))
  return buildConfigPatchFromFlags(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)
}

describe('config LLM default contracts', () => {
  test('bare --llm llamafile selects the first supported llamafile bundle', () => {
    const flags = { llm: ['llamafile'] }
    const explicitFlags = new Set(['llm'])
    const normalized = normalizeWriteStepSelectorFlags(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))
    const occurrences = collectRepeatableModelFlagOccurrences(normalized.flagOccurrences)
    const llamafileModels = normalizeModelFlagOccurrences('llamafile', normalized.flags, occurrences)

    expect(llamafileModels).toEqual([SUPPORTED_LLAMAFILE_MODELS[0]])
    expect(resolveLLMDefaults({ llamafileModels })).toMatchObject({
      llmService: 'llamafile',
      llmModel: SUPPORTED_LLAMAFILE_MODELS[0]
    })
  })

  test('every --llm provider target has a bare-selection model default', () => {
    const missing = Object.values(WRITE_LLM_PROVIDER_TARGETS)
      .filter((target) => resolveCheapestModelForFlag(target) === undefined)

    expect(missing).toEqual([])
  })

  test('every repeatable model flag resolves bare selection or has a named downstream default', () => {
    const downstreamDefaultFlags = new Set(['whisper-stt', 'whisperfile-stt'])
    const missing = REPEATABLE_MODEL_FLAGS
      .filter((flag) => resolveCheapestModelForFlag(flag) === undefined && !downstreamDefaultFlags.has(flag))

    expect(missing).toEqual([])
  })

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
