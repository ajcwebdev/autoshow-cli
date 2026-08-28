import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { normalizeResumeSelectorFlagsForTarget as normalizeResumeSelectorOccurrencesForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { CliFlagOccurrence,ResumeTarget } from '~/types'
import { flagOccurrencesFromValues } from '../../../test-utils/flag-occurrences'

const target = (
  kind: ResumeTarget['kind'],
  dir = '/tmp/autoshow-resume-test',
  extractRoute?: ResumeTarget['extractRoute']
): ResumeTarget => ({
  kind,
  ...(extractRoute ? { extractRoute } : {}),
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const buildOpts = (
  flags: Record<string, unknown>,
  explicit: Set<string>,
  flagOccurrences: CliFlagOccurrence[]
) =>
  buildOptsFromFlags(flags, {}, explicit, { flagOccurrences: flagOccurrences })

const normalizeResumeSelectorFlagsForTarget = (
  resumeTarget: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  _rawArgs: string[]
) => normalizeResumeSelectorOccurrencesForTarget(
  resumeTarget,
  flags,
  explicitFlags,
  flagOccurrencesFromValues(flags, explicitFlags)
)

describe('resume target-aware provider selectors', () => {
  test('normalizes --provider and generic TTS options for TTS resume targets', () => {
    const tts = normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { provider: ['openai=gpt-4o-mini-tts-2025-12-15'], 'tts-voice': ['alloy'] },
      new Set(['provider', 'tts-voice']),
      ['resume', 'out', '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--tts-voice', 'alloy']
    )
    expect(tts.flags['openai-tts']).toBe('gpt-4o-mini-tts-2025-12-15')
    expect(tts.flags['tts-voice']).toEqual(['alloy'])
    expect(tts.explicitFlags.has('openai-tts')).toBe(true)
    expect(tts.explicitFlags.has('tts-voice')).toBe(true)
    expect(tts.explicitFlags.has('openai-voice')).toBe(false)
    expect(buildOpts(tts.flags, tts.explicitFlags, tts.flagOccurrences).openaiVoiceId).toBe('alloy')
  })

  test('normalizes --provider for generation resume targets', () => {
    const write = normalizeResumeSelectorFlagsForTarget(
      target('write'),
      { provider: ['together=kimi-k2.6', 'cerebras=zai-glm-4.7'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'together=kimi-k2.6', '--provider', 'cerebras=zai-glm-4.7']
    )
    expect(write.flags['together']).toBe('kimi-k2.6')
    expect(write.flags['cerebras']).toBe('zai-glm-4.7')
    expect(buildOpts(write.flags, write.explicitFlags, write.flagOccurrences).togetherModels).toEqual(['kimi-k2.6'])
    expect(buildOpts(write.flags, write.explicitFlags, write.flagOccurrences).cerebrasModels).toEqual(['zai-glm-4.7'])

    const image = normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )
    expect(image.flags['openai-image']).toBe('gpt-image-2')
    expect(buildOpts(image.flags, image.explicitFlags, image.flagOccurrences).openaiImageModels).toEqual(['gpt-image-2'])

    const ltxVideo = normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['ltx=ltx-2-3-pro'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'ltx=ltx-2-3-pro']
    )
    expect(ltxVideo.flags['ltx-video']).toBe('ltx-2-3-pro')
    expect(buildOpts(ltxVideo.flags, ltxVideo.explicitFlags, ltxVideo.flagOccurrences).ltxVideoModels).toEqual(['ltx-2-3-pro'])

    const music = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { provider: ['elevenlabs=music_v2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'elevenlabs=music_v2']
    )
    expect(music.flags['elevenlabs-music']).toBe('music_v2')
    expect(buildOpts(music.flags, music.explicitFlags, music.flagOccurrences).elevenlabsMusicModels).toEqual(['music_v2'])

    const currentMusic = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { provider: ['elevenlabs=music_v2', 'minimax=music-3.0'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'elevenlabs=music_v2', '--provider', 'minimax=music-3.0']
    )
    expect(currentMusic.flags['elevenlabs-music']).toBe('music_v2')
    expect(currentMusic.flags['minimax-music']).toBe('music-3.0')
    const currentMusicOpts = buildOpts(currentMusic.flags, currentMusic.explicitFlags, currentMusic.flagOccurrences)
    expect(currentMusicOpts.elevenlabsMusicModels).toEqual(['music_v2'])
    expect(currentMusicOpts.minimaxMusicModels).toEqual(['music-3.0'])
  })

  test('normalizes extract --provider selectors by route', () => {
    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { provider: ['deepgram=nova-3'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepgram=nova-3']
    )
    expect(stt.flags['deepgram-stt']).toBe('nova-3')
    expect(stt.flags['deepinfra-ocr']).toBeUndefined()
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.flagOccurrences).deepgramSttModels).toEqual(['nova-3'])

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { provider: ['deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct']
    )
    expect(ocr.flags['deepinfra-ocr']).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(ocr.flags['deepgram-stt']).toBeUndefined()
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.flagOccurrences).deepinfraOcrModels).toEqual(['Qwen/Qwen3-VL-30B-A3B-Instruct'])

    const article = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-article', 'article'),
      { provider: ['supadata'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'supadata']
    )
    expect(article.flags['url-provider']).toBe('supadata')
    expect(buildOpts(article.flags, article.explicitFlags, article.flagOccurrences).urlBackend).toBe('supadata')
  })

  test('normalizes --all-local by resolved resume target kind and extract route', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )).toThrow('--all-local is not supported')

    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )).toThrow('--all-local is not supported')

    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('write'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )).toThrow('--all-local is not supported')

    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(stt.flags['all-local-stt']).toBe(true)
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.flagOccurrences).whisperModels).toBeDefined()

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(ocr.flags['all-local-ocr']).toBe(true)
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.flagOccurrences).useTesseract).toBe(true)

    const article = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-article', 'article'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(article.flags['all-local-url']).toBe(true)
    expect(buildOpts(article.flags, article.explicitFlags, article.flagOccurrences).urlBackends).toEqual(['defuddle'])
  })

  test('rejects providers that do not apply to the resolved target', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )).toThrow('Unknown provider "openai" for --provider')
  })
})
