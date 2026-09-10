import { expect, test } from 'bun:test'
import { selectCheapestDefaultLlmSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

test('write without --llm resolves to the cheapest hosted LLM', () => {
  const cheapest = selectCheapestDefaultLlmSelection()
  const defaults = resolveLLMDefaults({})
  const opts = buildOptsFromFlags({})

  expect(defaults.llmService).toBe(cheapest.provider)
  expect(defaults.llmModel).toBe(cheapest.model)
  expect(resolveLLMDefaults(opts).llmService).toBe(cheapest.provider)
  expect(resolveLLMDefaults(opts).llmModel).toBe(cheapest.model)
})
