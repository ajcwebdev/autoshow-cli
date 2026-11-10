import { expect, test } from 'bun:test'
import { serializeResultArtifact } from '~/utils/app-logger/redaction'

test('result artifacts preserve nested provider token accounting while redacting nested credentials', () => {
  const usage = {
    inputTokens: 100,
    audioInputTokens: 80,
    candidatesTokenCount: 30,
    cachedContentTokenCount: 10,
    thoughtsTokenCount: 20,
    toolUsePromptTokenCount: 5,
    completion_tokens_details: { reasoning_tokens: 20, apiKey: 'private-key' },
    input_tokens_details: { cache_write_tokens_details: { cached_tokens: 12 } },
    promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 80 }]
  }
  expect(JSON.parse(serializeResultArtifact(usage))).toEqual({
    ...usage, completion_tokens_details: { reasoning_tokens: 20, apiKey: 'REDACTED' }
  })
})

test('numeric credential fields do not become token counters through a matching substring', () => {
  expect(JSON.parse(serializeResultArtifact({ accessTokens: 123, passwordTokenCount: 456, inputTokens: 100 }))).toEqual({
    accessTokens: 'REDACTED', passwordTokenCount: 'REDACTED', inputTokens: 100
  })
  expect(JSON.parse(serializeResultArtifact({ completion_tokens_details: 'private-key' }))).toEqual({
    completion_tokens_details: 'REDACTED'
  })
})
