import { describe, expect, test } from 'bun:test'
import { FLAG_TO_CONFIG_PATH } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { REPEATABLE_MODEL_FLAGS } from '~/cli/options/option-resolution/model-flag-selection'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'

describe('config LLM default contracts', () => {
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

  test('every --llm provider target has a config destination', () => {
    const missing = Object.values(WRITE_LLM_PROVIDER_TARGETS)
      .filter((target) => FLAG_TO_CONFIG_PATH[target] === undefined)

    expect(missing).toEqual([])
  })
})
