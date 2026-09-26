import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { validateTtsBenchmarkContent } from '~/tools/tts-benchmark-content'
import type { TtsOptions, TtsTurnControls } from '~/types'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { unary } from './tts-provider-contracts/gemini-fixtures'

const envKeys = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'XAI_API_KEY', 'INWORLD_API_KEY', 'SONIOX_API_KEY', 'GEMINI_API_KEY']
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
      const calls = installMockFetch(() => {
        if (entry.provider === 'gemini') return Response.json(unary())
        if (entry.provider === 'soniox') return new Response(createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 }))
        if (entry.provider === 'inworld') return Response.json({ audioContent: base64 })
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
      }
      await runTtsForTargets(source, await dirs.make(), options, targets)
      const bodies = calls.map(call => call.bodyJson!)
      expect(bodies.length).toBeGreaterThan(0)
      const texts = bodies.flatMap(body => entry.provider === 'gemini'
          ? (body['input'] as Array<{ content: Array<{ text: string }> }>).flatMap(input => input.content.map(content => content.text))
          : [body['text'] ?? body['input'] ?? body['transcript']])
      if (entry.provider === 'soniox') {
        // Soniox REST contract: native tags belong in text; speed is a number, not instructions.
        expect(calls).toHaveLength(5)
        for (const call of calls) expect(call).toMatchObject({ url: 'https://tts-rt.soniox.com/tts', method: 'POST', bodyJson: { model: 'tts-rt-v2', voice: 'Adrian', language: 'en', audio_format: 'wav', sample_rate: 24000 } })
        const rates = bodies.map(body => body['speed'])
        expect(rates).toEqual(entry.id.endsWith('-numeric') ? [1, 0.7, 1.3, 1, 1] : [1, 1, 1, 1, 1])
        for (const body of bodies) expect(body['instructions']).toBeUndefined()
      }
      if (entry.flags['tts-dialogue-format']) expect(texts).toEqual(entry.lines)
      else expect(String(texts[0]).trim()).toBe(source.trim())
      for (const [index, line] of entry.lines.entries()) {
        const turn = entry.turnControls[`dialogue-turn-${String(index + 1).padStart(3, '0')}`]
        const controls = turn?.[entry.provider as keyof typeof turn]
        if (!controls) continue
        const body = bodies[index]!
        if (controls['speed'] !== undefined) {
          const actual = body['speed']
          expect(actual).toBe(controls['speed'])
        }
        if (controls['instructions'] !== undefined) {
          if (entry.provider === 'gemini') {
            const input = body['input'] as Array<{ content: Array<{ annotations: Array<{ type: string, style: string }> }> }>
            expect(input[0]!.content[0]!.annotations).toEqual([{ type: 'speech_metadata', style: String(controls['instructions']) }])
          } else expect(body['instructions']).toBe(controls['instructions'])
        }
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
  ] as const) test(`${provider}/${model}: generic default, override and explicit reset reach transport`, async () => {
    for (const key of envKeys) process.env[key] = 'mock-tts-key'
    const calls = installMockFetch(() => provider === 'inworld' ? Response.json({ audioContent: base64 })
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
    const rates = calls.flatMap(call => [provider === 'inworld' ? (call.bodyJson?.['audioConfig'] as Record<string, unknown> | undefined)?.['speakingRate'] : call.bodyJson?.['speed']])
    expect(rates).toEqual([1.1, 0.75, undefined])
  }, 20_000)

  test('rejects unsupported Eleven v3 numeric speed before dispatch, including per-turn controls', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-speed': '0.8' }))).toThrow('does not support numeric speed')
    const options: TtsOptions = { ...buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-dialogue-format': 'labeled', 'tts-speaker': ['Narrator=hpp4J3VqNfWAUOO0d1Us'] }), ttsTurnControls: { 'dialogue-turn-001': { elevenlabs: { speed: 0.8 } } } }
    expect(() => planCurrentTtsReadiness({ target: collectTtsTargets(options)[0]!, sourceText: 'Narrator: Hello.', ttsOptions: options })).toThrow('does not support numeric speed')
  })
  test('validates model-specific numeric ranges and rejects zero, NaN and infinity', () => {
    for (const [provider,model,min,max] of [['inworld','realtime-tts-2',0.5,1.5], ['grok','grok-tts',0.7,1.5]] as const) {
      for (const speed of [min,max]) expect(buildOptsFromFlags({ [`${provider}-tts`]: model, 'tts-speed': String(speed) })[`${provider}TtsSpeed`]).toBe(speed)
      for (const speed of [0,min - 0.01,max + 0.01,NaN,Infinity]) {
        expect(() => buildOptsFromFlags({ [`${provider}-tts`]: model, 'tts-speed': String(speed) })).toThrow()
        expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [provider]: { speed } } })).toThrow()
      }
    }
  })
})
