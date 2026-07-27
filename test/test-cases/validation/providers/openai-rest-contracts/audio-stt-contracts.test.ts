import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runOpenAICompatibleSingleSpeakerStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/openai-compatible-single-speaker'
import { createOpenAISpeech, createOpenAITranscription } from '~/utils/openai/openai-client'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from './shared'

installOpenAIRestContractHooks()

describe('OpenAI REST audio and STT contracts', () => {
  test('Speech and transcription helpers use binary and multipart REST bodies', async () => {
    const speechBytes = new Uint8Array([1, 2, 3])
    const calls = installFetch((call) => {
      if (call.url.endsWith('/audio/speech')) {
        expect(call.headers.get('content-type')).toBe('application/json')
        return new Response(speechBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
      }
      return jsonResponse({ text: 'hello' })
    })

    const speech = await createOpenAISpeech(
      { apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1' },
      { model: 'gpt-4o-mini-tts', voice: 'alloy', input: 'hello', response_format: 'wav' }
    )
    const form = new FormData()
    form.append('model', 'openai/whisper-large-v3')
    form.append('file', new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' }), 'audio.mp3')
    await createOpenAITranscription({ apiKey: 'openai-key', baseURL: 'https://mock.openai.local/v1' }, form)

    expect(Array.from(speech)).toEqual([1, 2, 3])
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({
      url: 'https://mock.openai.local/v1/audio/transcriptions',
      method: 'POST'
    })
    expect(calls[1]?.headers.get('content-type')).toBeNull()
    expect(calls[1]?.form?.get('file')).toBeInstanceOf(File)
  })

  test('OpenAI-compatible STT retries transient transcription create failures', async () => {
    const calls = installFetch(() => {
      if (calls.length === 1) {
        return jsonResponse({ error: { message: 'Service Unavailable' } }, { status: 503 })
      }

      return jsonResponse({
        text: 'hello from retry',
        segments: [{ start: 0, end: 1.5, text: 'hello from retry' }]
      })
    })

    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'audio.mp3')
      await writeFile(audioPath, 'audio', 'utf8')

      const result = await runOpenAICompatibleSingleSpeakerStt(audioPath, dir, {
        service: 'together',
        providerLabel: 'Together',
        apiKey: 'together-key',
        baseURL: 'https://api.together.xyz/v1',
        model: 'openai/whisper-large-v3',
        segmentOffsetMinutes: 0
      })

      expect(result.result.text).toBe('hello from retry')
      expect(result.result.segments).toHaveLength(1)
      expect(await Bun.file(join(dir, 'transcription.txt')).text()).toContain('hello from retry')
    })

    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.together.xyz/v1/audio/transcriptions',
      'https://api.together.xyz/v1/audio/transcriptions'
    ])
    expect(calls[0]?.form?.get('model')).toBe('openai/whisper-large-v3')
    expect(calls[1]?.form?.get('model')).toBe('openai/whisper-large-v3')
  })
})
