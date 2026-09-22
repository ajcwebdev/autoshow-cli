import { describe, expect, test } from 'bun:test'
import { runElevenLabsNativeDialogue } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { HTTP_PAYLOAD_MAX_BYTES_ENV } from '~/utils/http-payload'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: [HTTP_PAYLOAD_MAX_BYTES_ENV, 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-dialogue-payload-' })
const turns = [{ turnId: 'one', subjectKey: 'speaker', speaker: 'Speaker', canonicalText: 'Hello there.', voiceId: 'voice-a' }]
// Independent endpoint contract: output_format is codec_sample_rate_kbps; response audio is base64.
// https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps

describe('ElevenLabs dialogue ceiling: mocked dispatch and decoded integrity, not spoken correctness', () => {
  for (const format of ['mp3_44100_128', 'mp3_44100_192'] as const) {
    test(`${format}: default, lowered, raised and reset ceilings with actual MP3 decoding`, async () => {
      process.env['ELEVENLABS_API_KEY'] = 'mock-key'
      const root = await dirs.make()
      const fixturePath = `${root}/fixture.mp3`
      const encoder = Bun.spawn([getFfmpegBinary(), '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.1', '-b:a', format.endsWith('192') ? '192k' : '128k', fixturePath], { stdout: 'ignore', stderr: 'inherit' })
      expect(await encoder.exited).toBe(0)
      const audio = Buffer.from(await Bun.file(fixturePath).arrayBuffer()).toString('base64')
      const calls = installMockFetch(call => {
        expect(new URL(call.url).pathname).toBe('/v1/text-to-dialogue/with-timestamps')
        expect(new URL(call.url).searchParams.get('output_format')).toBe(format)
        expect(call.bodyJson?.['inputs']).toEqual([{ text: 'Hello there.', voice_id: 'voice-a' }])
        return Response.json({ audio_base64: audio })
      })
      const run = async () => await runElevenLabsNativeDialogue(turns, await dirs.make(), { model: 'eleven_v3', ...(format.endsWith('192') ? { controls: { responseFormat: format } } : {}) })
      const initial = await run()
      expect((await Bun.file(initial.audioPath).bytes()).slice(0, 4)).toEqual(new TextEncoder().encode('RIFF'))
      process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1'
      await expect(run()).rejects.toMatchObject({ kind: 'validation', retryable: false })
      expect(calls).toHaveLength(1)
      // 12 characters / 8 chars/s, with documented 128 or 192 kbps, base64 and 64 bytes/character metadata.
      const estimatedBytes = format.endsWith('192') ? 48_768 : 32_768
      process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(estimatedBytes - 1)
      await expect(run()).rejects.toMatchObject({ kind: 'validation', retryable: false })
      expect(calls).toHaveLength(1)
      process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = String(estimatedBytes)
      await run()
      process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1048576'
      await run()
      delete process.env[HTTP_PAYLOAD_MAX_BYTES_ENV]
      await run()
      expect(calls).toHaveLength(4)
    })
  }

  test('checks every batch before dispatching the first one', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'mock-key'
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '100000'
    const calls = installMockFetch(() => { throw new Error('must not dispatch') })
    await expect(runElevenLabsNativeDialogue([...turns, { ...turns[0]!, turnId: 'two', canonicalText: 'x'.repeat(2000) }], await dirs.make(), { model: 'eleven_v3' })).rejects.toThrow('chunk 2 of 2')
    expect(calls).toHaveLength(0)
  })

  test('HTTP success with invalid audio fails artifact decoding', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'mock-key'
    const calls = installMockFetch(() => Response.json({ audio_base64: Buffer.from('not audio').toString('base64') }))
    await expect(runElevenLabsNativeDialogue(turns, await dirs.make(), { model: 'eleven_v3' })).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })
})
