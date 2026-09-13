import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { validateTtsBenchmarkContent } from '~/tools/tts-benchmark-content'
import type { TtsOptions, TtsTurnControls } from '~/types'
import { createMockWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const envKeys = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'XAI_API_KEY', 'CARTESIA_API_KEY', 'HUME_API_KEY', 'SPEECHIFY_API_KEY', 'INWORLD_API_KEY']
const dirs = setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-speed-benchmark-' })
const audio = createMockWavBytes()
const base64 = Buffer.from(audio).toString('base64')

for (const suite of ['emotion', 'speed-pauses']) {
  const plan = await Bun.file(`test/fixtures/tts-controls/${suite}/benchmark-plan.json`).json() as {
    cases: Array<{ id: string, provider: string, model: string, input: string, flags: Record<string, unknown>, lines: string[], spokenLines: string[], turnControls: TtsTurnControls }>
  }
  describe(`${suite} benchmark dispatch (mocked, no provider calls)`, () => {
    for (const entry of plan.cases) test(entry.id, async () => {
      validateTtsBenchmarkContent(entry)
      for (const key of envKeys) process.env[key] = 'mock-tts-key'
      const calls = installMockFetch(call => {
        if (entry.provider === 'inworld') return Response.json({ audioContent: base64 })
        if (entry.provider === 'speechify') return Response.json({ audio_data: base64 })
        if (entry.provider === 'hume' && call.url.endsWith('/v0/tts')) return Response.json({ generations: [{ audio: base64, generation_id: 'mock-generation' }] })
        return new Response(audio, { headers: { 'content-type': 'audio/wav' } })
      })
      const options: TtsOptions = {
        ...buildOptsFromFlags(entry.flags),
        ttsTurnControls: normalizeTtsTurnControls(entry.turnControls),
        ttsChunkConcurrency: 1,
        ttsProviderConcurrency: 1,
      }
      const targets = collectTtsTargets(options)
      expect(targets).toHaveLength(1)
      const source = await Bun.file(entry.input).text()
      expect(entry.lines).toHaveLength(5)
      expect(source).not.toMatch(/\[(?:laugh[^\]]*|crying|sighs?|cough|yawn|sings|clear throat)\]/i)
      if (suite === 'emotion') {
        expect(source).not.toMatch(/<speed\b|<break\b|\[(?:slow|slowly|fast|rushed|normal pace|.*pause)\]/i)
        expect(JSON.stringify(entry.turnControls)).not.toMatch(/"(?:speed|trailingSilence)"/)
      }
      await runTtsForTargets(source, await dirs.make(), options, targets)
      const bodies = calls.map(call => call.bodyJson!)
      expect(bodies.length).toBeGreaterThan(0)
      const texts = bodies.flatMap(body => entry.provider === 'hume'
        ? (body['utterances'] as Array<Record<string, unknown>>).map(turn => turn['text'])
        : [body['text'] ?? body['input'] ?? body['transcript']])
      if (entry.flags['tts-dialogue-format']) expect(texts).toEqual(entry.lines)
      else expect(String(texts[0]).trim()).toBe(source.trim())
      for (const [index, line] of entry.lines.entries()) {
        const turn = entry.turnControls[`dialogue-turn-${String(index + 1).padStart(3, '0')}`]
        const controls = turn?.[entry.provider as keyof typeof turn]
        if (!controls) continue
        const body = entry.model === 'octave-2' ? bodies[0]! : bodies[index]!
        const utterance = entry.provider === 'hume' ? (body['utterances'] as Array<Record<string, unknown>>)[entry.model === 'octave-2' ? index : 0]! : undefined
        if (controls['speed'] !== undefined) {
          const actual = entry.provider === 'hume' ? utterance?.['speed'] : entry.provider === 'cartesia' ? (body['generation_config'] as Record<string, unknown>)?.['speed'] : body['speed']
          expect(actual).toBe(controls['speed'])
        }
        if (controls['trailingSilence'] !== undefined) expect(utterance?.['trailing_silence']).toBe(controls['trailingSilence'])
        if (controls['instructions'] !== undefined) expect(body['instructions']).toBe(controls['instructions'])
        if (controls['description'] !== undefined) expect(utterance?.['description']).toBe(controls['description'])
        if (controls['steeringPrompt'] !== undefined) expect(body['instruction']).toBe(controls['steeringPrompt'])
        expect(texts).toContain(line)
      }
    }, 20_000)
  })
}

describe('speed capability validation', () => {
  for (const [provider, model, voice] of [
    ['grok', 'grok-tts', 'eve'],
    ['inworld', 'realtime-tts-2', 'Dennis'],
    ['cartesia', 'sonic-3.6-2026-08-27', '0834f3df-e650-4766-a20c-5a93a43aa6e3'],
    ['hume', 'octave-1', '9e068547-5ba4-4c8e-8e03-69282a008f04'],
    ['hume', 'octave-2', '9e068547-5ba4-4c8e-8e03-69282a008f04'],
  ] as const) test(`${provider}/${model}: generic default, override and explicit reset reach transport`, async () => {
    for (const key of envKeys) process.env[key] = 'mock-tts-key'
    const calls = installMockFetch(call => provider === 'hume' && call.url.endsWith('/v0/tts')
      ? Response.json({ generations: [{ audio: base64, generation_id: 'mock-generation' }] })
      : provider === 'inworld' ? Response.json({ audioContent: base64 })
      : new Response(audio, { headers: { 'content-type': 'audio/wav' } }))
    const options: TtsOptions = {
      ...buildOptsFromFlags({ [`${provider}-tts`]: model, 'tts-speed': '1.1', 'tts-dialogue-format': 'labeled', 'tts-speaker': [`Narrator=${voice}`] }),
      ttsChunkConcurrency: 1,
      ttsTurnControls: {
        'dialogue-turn-002': { [provider]: { speed: 0.75 } },
        'dialogue-turn-003': { [provider]: { speed: null } },
      },
    }
    await runTtsForTargets('Narrator: First.\nNarrator: Second.\nNarrator: Third.', await dirs.make(), options, collectTtsTargets(options))
    const rates = calls.flatMap(call => provider === 'hume'
      ? (call.bodyJson?.['utterances'] as Array<Record<string, unknown>>).map(turn => turn['speed'])
      : [provider === 'inworld' ? (call.bodyJson?.['audioConfig'] as Record<string, unknown> | undefined)?.['speakingRate'] : provider === 'cartesia' ? (call.bodyJson?.['generation_config'] as Record<string, unknown> | undefined)?.['speed'] : call.bodyJson?.['speed']])
    expect(rates).toEqual([1.1, 0.75, undefined])
  }, 20_000)

  test('rejects unsupported Eleven v3 numeric speed before dispatch, including per-turn controls', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-speed': '0.8' }))).toThrow('does not support numeric speed')
    const options: TtsOptions = { ...buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-dialogue-format': 'labeled', 'tts-speaker': ['Narrator=hpp4J3VqNfWAUOO0d1Us'] }), ttsTurnControls: { 'dialogue-turn-001': { elevenlabs: { speed: 0.8 } } } }
    expect(() => planCurrentTtsReadiness({ target: collectTtsTargets(options)[0]!, sourceText: 'Narrator: Hello.', ttsOptions: options })).toThrow('does not support numeric speed')
  })
  test('validates model-specific numeric ranges and rejects zero, NaN and infinity', () => {
    for (const [provider,model,min,max] of [['inworld','realtime-tts-2',0.5,1.5], ['grok','grok-tts',0.7,1.5], ['cartesia','sonic-3.6-2026-08-27',0.6,1.5], ['hume','octave-1',0.5,2]] as const) {
      for (const speed of [min,max]) expect(buildOptsFromFlags({ [`${provider}-tts`]: model, 'tts-speed': String(speed) })[`${provider}TtsSpeed`]).toBe(speed)
      for (const speed of [0,min - 0.01,max + 0.01,NaN,Infinity]) {
        expect(() => buildOptsFromFlags({ [`${provider}-tts`]: model, 'tts-speed': String(speed) })).toThrow()
        expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [provider]: { speed } } })).toThrow()
      }
    }
  })
})
