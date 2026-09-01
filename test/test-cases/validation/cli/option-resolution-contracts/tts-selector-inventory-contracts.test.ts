import { describe, expect, test } from 'bun:test'
import { TTS_PROVIDERS } from '~/types'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'

describe('option resolution contracts', () => {
  test('hosted TTS exposes exactly the active providers', () => {
    expect(TTS_PROVIDERS).toEqual(['elevenlabs', 'minimax', 'grok', 'mistral', 'openai', 'speechify', 'hume', 'cartesia', 'inworld'])
    expect(Object.keys(STANDALONE_TTS_PROVIDER_TARGETS)).toEqual([...TTS_PROVIDERS])
    expect(Object.keys(getModelRegistry().tts).sort()).toEqual([...TTS_PROVIDERS].sort())
  })
})
