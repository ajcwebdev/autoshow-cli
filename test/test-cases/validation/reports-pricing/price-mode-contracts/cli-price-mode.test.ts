import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { STABLE_EXAMPLE_AUDIO_URL, STABLE_TTS_MD_PATH, runCommand } from '../../../../test-utils/test-helpers'
import { findPricingNoteKeys, isRecord, parseJsonLines } from './shared'

const priceCases: Array<{ label: string; args: string[]; expected: string | string[]; env?: Record<string, string | undefined> }> = [
  {
    label: 'metadata',
    args: ['metadata', 'input/examples/document/1-document.pdf', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'download',
    args: ['download', 'input/examples/document/1-document.pdf', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'write',
    args: ['write', STABLE_EXAMPLE_AUDIO_URL, '--llm', 'openai=gpt-5.4-nano', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'Kimi write',
    args: ['write', STABLE_EXAMPLE_AUDIO_URL, '--llm', 'kimi=kimi-k2.6', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'Grok 4.5 write',
    args: ['write', STABLE_EXAMPLE_AUDIO_URL, '--llm', 'grok=grok-4.5', '--price'],
    expected: ['Expected files', 'grok-4.5']
  },
  {
    label: 'write URL article extraction',
    args: ['write', 'https://example.com/articles/story.html', '--all-providers', 'url', '--price'],
    expected: ['providers/<backend>/result.json', 'text.json']
  },
  {
    label: 'write X Space extraction',
    args: ['write', 'https://x.com/i/spaces/1DXxyRYNejbKM', '--price'],
    expected: ['extraction.md', 'text.json']
  },
  {
    label: 'extract',
    args: ['extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'whisper=tiny', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'Kimi OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'kimi=kimi-k2.6', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'Grok OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'grok=grok-4.3', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'OpenAI GPT-5.5 OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-5.5', '--price'],
    expected: ['Total estimated cost', 'gpt-5.5']
  },
  {
    label: 'Anthropic Opus OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-opus-4-8', '--price'],
    expected: ['Total estimated cost', 'claude-opus-4-8']
  },
  {
    label: 'Anthropic Sonnet OCR',
    args: ['extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-sonnet-5', '--price'],
    expected: ['Total estimated cost', 'claude-sonnet-5']
  },
  {
    label: 'all URL article extraction',
    args: ['extract', 'https://example.com/articles/story.html', '--all-providers', '--price'],
    expected: 'providers/<backend>/result.json'
  },
  {
    label: 'GLM Reader URL article extraction',
    args: ['extract', 'https://ajcwebdev.com', '--provider', 'glm-reader', '--price'],
    expected: ['Total estimated cost', 'glm-reader']
  },
  {
    label: 'tts',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price'],
    expected: 'speech'
  },
  {
    label: 'all TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--all-providers', '--price'],
    expected: 'speech'
  },
  {
    label: 'Speechify TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'speechify=simba-3.2', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral TTS',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-voice', 'voice_abc123', '--price'],
    expected: 'speech'
  },
  {
    label: 'Mistral dialogue TTS',
    args: ['tts', 'input/examples/tts/tts-dialogue.txt', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker', 'Guest=input/examples/audio/0-audio-short.mp3', '--price'],
    expected: ['speech', '418 characters']
  },
  {
    label: 'image',
    args: ['image', 'a sunset over a lake', '--provider', 'openai=gpt-image-2', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'BFL image',
    args: ['image', 'a sunset over a lake', '--provider', 'bfl=flux-2-pro', '--price'],
    expected: 'generated-image'
  },
  {
    label: 'video',
    args: ['video', 'a sunset over a lake', '--provider', 'gemini=veo-3.1-fast-generate-preview', '--price'],
    expected: 'video'
  },
  {
    label: 'music',
    args: ['music', 'an ambient piano song', '--provider', 'minimax=music-3.0', '--price'],
    expected: 'music'
  },
  {
    label: 'Gemini music',
    args: ['music', 'an ambient piano song', '--provider', 'gemini=lyria-3-clip-preview', '--price'],
    expected: 'gemini'
  }
]

describe('price mode contracts', () => {
  for (const priceCase of priceCases) {
      test(`${priceCase.label} accepts --price without producing an output directory`, async () => {
        const result = await runCommand(['src/cli/create-cli.ts', ...priceCase.args], {
          ...(priceCase.env ? { env: priceCase.env } : {})
        })

        expect(result.exitCode).toBe(0)
        expect(result.outputDir).toBeNull()
        const output = `${result.stdout}\n${result.stderr}`
        for (const expected of Array.isArray(priceCase.expected) ? priceCase.expected : [priceCase.expected]) {
          expect(output).toContain(expected)
        }
      })
    }

  for (const creationCase of [
    {
      label: 'Speechify custom voice TTS',
      args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'speechify=simba-3.0', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--tts-consent-name', 'Anthony Example', '--tts-consent-email', 'anthony@example.com', '--price'],
      expected: 'cannot perform reference-audio cloning during TTS synthesis'
    },
    {
      label: 'ElevenLabs IVC TTS',
      args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'elevenlabs=eleven_v3', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
      expected: 'cannot perform reference-audio cloning during TTS synthesis'
    }
  ]) {
    test(`${creationCase.label} is rejected before synthesis price planning`, async () => {
      const result = await runCommand(['src/cli/create-cli.ts', ...creationCase.args])

      expect(result.exitCode).toBe(2)
      expect(result.outputDir).toBeNull()
      const output = `${result.stdout}\n${result.stderr}`
      expect(output).toContain(creationCase.expected)
      expect(output).toContain('comic reference-voice')
    })
  }

  test('hosted OCR --price reports the detected PDF page count', async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'extract',
        'input/examples/document/3-document.pdf',
        '--provider',
        'kimi=kimi-k2.6',
        '--price'
      ])

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).toBeNull()
      const output = `${result.stdout}\n${result.stderr}`
      expect(output).toContain('3 pages')
      expect(output).not.toContain('1 pages')
    })

  test('price JSON result omits estimate note fields', async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'write',
        STABLE_EXAMPLE_AUDIO_URL,
        '--llm',
        'openai=gpt-5.5',
        '--llm',
        'groq=openai/gpt-oss-20b',
        '--tts',
        'kitten=kitten-tts-mini',
        '--price',
        '--json'
      ])

      expect(result.exitCode).toBe(0)
      const emittedResult = parseJsonLines(`${result.stdout}\n${result.stderr}`)
        .find((entry) => isRecord(entry) && entry['dryRun'] === true)

      expect(emittedResult).toBeDefined()
      expect(findPricingNoteKeys(emittedResult)).toEqual([])
      expect(JSON.stringify(emittedResult)).not.toContain('TTS estimate omitted')
    })

  test('tts directory --price reports per-item estimates and suite total without creating output dirs', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'autoshow-tts-directory-price-'))
      const inputDir = join(dir, 'inputs')
      const nestedDir = join(inputDir, 'nested')
      const outputDir = join(dir, 'tts-batch-out')

      await mkdir(nestedDir, { recursive: true })
      await Bun.write(join(inputDir, '01-first.md'), 'First TTS source.\n')
      await Bun.write(join(nestedDir, '02-second.txt'), 'Second TTS source.\n')
      await Bun.write(join(inputDir, 'ignore.json'), '{"text":"ignored"}\n')

      try {
        const result = await runCommand([
          'src/cli/create-cli.ts',
          'tts',
          inputDir,
          '--provider',
          'grok=grok-tts',
          '--tts-chunk-concurrency',
          '5',
          '--batch-concurrency',
          '2',
          '--output-dir',
          outputDir,
          '--price'
        ], {
          env: { XAI_API_KEY: '' }
        })

        expect(result.exitCode).toBe(0)
        expect(result.outputDir).toBeNull()
        expect(existsSync(outputDir)).toBe(false)

        const output = `${result.stdout}\n${result.stderr}`
        expect(output).toContain('TTS Price Item')
        expect(output).toContain('01-first.md')
        expect(output).toContain('02-second.txt')
        expect(output).not.toContain('ignore.json')
        expect(output).toContain('grok-tts')
        expect(output).toContain('TTS Batch Estimate')
        expect(output).toContain('batch concurrency')
        expect(output).toContain('tts chunk concurrency')
        expect(output).toContain('total estimated processing time')
        expect(output).toContain('estimated wall time')
        expect(output).toContain('total estimated cost')
        expect(output).toContain('Suite Cost Summary')
        expect(output).toContain('2 TTS inputs')
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

  test('music lyric-video mode accepts --price without running local transcription or rendering', async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'music',
        '--audio',
        'input/examples/lyrics/01-example-song.mp3',
        '--price'
      ])

      expect(result.exitCode).toBe(0)
      expect(result.outputDir).toBeNull()
      const output = `${result.stdout}\n${result.stderr}`
      expect(output).toContain('Total estimated cost: free')
      expect(output).toContain('01-example-song.mp4')
    })
})
