import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { LOCAL_EXAMPLE_AUDIO_PATH, STABLE_TTS_MD_PATH, runCommand } from '../../../../test-utils/test-helpers'
import { findPricingNoteKeys, isRecord, parseJsonLines } from './shared'

const priceCases: Array<{ label: string; args: string[]; expected: string | string[]; env?: Record<string, string | undefined> }> = [
  {
    label: 'metadata',
    args: ['metadata', 'input/examples/document/1-document.pdf', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'write',
    args: ['write', LOCAL_EXAMPLE_AUDIO_PATH, '--llm', 'openai=gpt-5.4-nano', '--price'],
    expected: 'Expected files'
  },
  {
    label: 'extract',
    args: ['extract', LOCAL_EXAMPLE_AUDIO_PATH, '--provider', 'whisper=tiny', '--price'],
    expected: 'Total estimated cost'
  },
  {
    label: 'tts',
    args: ['tts', STABLE_TTS_MD_PATH, '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price'],
    expected: 'speech'
  },
  {
    label: 'image',
    args: ['image', 'a sunset over a lake', '--provider', 'openai=gpt-image-2', '--price'],
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

  test('ElevenLabs TTS rejects --tts-ref-audio before synthesis price planning', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      '--provider',
      'elevenlabs=eleven_v3',
      '--tts-ref-audio',
      'input/examples/audio/anthony-voice.mp3',
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(result.outputDir).toBeNull()
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('--tts-ref-audio does not apply to elevenlabs TTS')
  })

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
        LOCAL_EXAMPLE_AUDIO_PATH,
        '--llm',
        'openai=gpt-5.5',
        '--llm',
        'groq=openai/gpt-oss-20b',
        '--tts',
        'openai=gpt-4o-mini-tts-2025-12-15',
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
