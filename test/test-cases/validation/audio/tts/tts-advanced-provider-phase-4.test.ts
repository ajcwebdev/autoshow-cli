import { describe, expect, test } from 'bun:test'
import { advancedProvider } from '~/cli/commands/audio/voice/voice-command-support'

describe('Phase 4 capability fixtures', () => {
  test('public routing exposes Grok and Mistral without provider calls', () => {
    const credentials = {
      XAI_API_KEY: 'xai-key',
      MISTRAL_API_KEY: 'mistral-key',
    } as const
    const prior = Object.fromEntries(Object.keys(credentials).map(key => [key, process.env[key]]))
    Object.assign(process.env, credentials)
    try {
      for (const provider of ['grok', 'mistral'] as const) {
        const routed = advancedProvider(provider)
        expect(routed.provider).toBe(provider)
        expect(routed.catalog).toBeDefined()
        expect(routed.lifecycle).toBeDefined()
      }
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })
})
