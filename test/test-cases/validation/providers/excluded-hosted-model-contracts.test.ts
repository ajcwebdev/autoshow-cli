import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getModelRegistry, getSttCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-excluded-hosted-models-' })

const decision = readFileSync('docs/adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md', 'utf8')
const section = decision.split('<!-- excluded-hosted-models:start -->')[1]!.split('<!-- excluded-hosted-models:end -->')[0]!
const tuples = [...section.matchAll(/`stt\/([^/`]+)\/([^`]+)`/g)].map(([, service, model]) => ({ service: service!, model: model! }))

test('the ADR-010 decision table lists the three excluded STT tuples', () => {
  expect(tuples).toEqual([
    { service: 'cloudflare', model: '@cf/deepgram/nova-3' },
    { service: 'together', model: 'nvidia/nemotron-3.5-asr-streaming-0.6b' },
    { service: 'together', model: 'nvidia/nemotron-3-asr-streaming-0.6b' }
  ])
})

test('excluded tuples stay out of registries, defaults and --all-stt, and explicit selections fail before dispatch', () => {
  const calls = installMockFetch(() => { throw Error('Provider must not be called') })
  const registry = getModelRegistry().stt
  const allTargets = collectSttTargets(buildOptsFromFlags({ 'all-stt': true })).map(target => `${target.service}:${target.model}`)
  for (const { service, model } of tuples) {
    expect(registry[service]).toBeDefined()
    expect(registry[service]?.models[model]).toBeUndefined()
    expect(resolveCheapestModelForFlag(`${service}-stt`)).not.toBe(model)
    expect(allTargets).not.toContain(`${service}:${model}`)
    expect(() => buildOptsFromFlags({ [`${service}-stt`]: [model] })).toThrow(`Invalid model "${model}"`)
  }
  expect(calls).toHaveLength(0)
})

test('Cloudflare keeps its Whisper models, points Nova-3 users at direct Deepgram and still prices finished Nova-3 runs', () => {
  expect(Object.keys(getModelRegistry().stt['cloudflare']?.models ?? {})).toEqual(['@cf/openai/whisper-large-v3-turbo', '@cf/openai/whisper', '@cf/openai/whisper-tiny-en'])
  expect(() => buildOptsFromFlags({ 'cloudflare-stt': ['@cf/deepgram/nova-3'] })).toThrow('use --provider deepgram=nova-3')
  expect(getModelRegistry().stt['deepgram']?.models['nova-3']).toBeDefined()
  // The finished October 2026 benchmark rows were recorded at the published $0.0052 per HTTP audio minute.
  expect(getSttCost('cloudflare', '@cf/deepgram/nova-3')).toEqual({ costPerHourCents: 31.2 })
})

test('the provider-model-additions research workflow reads these decisions before recommending', () => {
  const skill = readFileSync('.codex/skills/provider-model-additions/SKILL.md', 'utf8')
  expect(skill).toContain('ADR-010')
  expect(skill).toContain('Excluded integrations')
})
