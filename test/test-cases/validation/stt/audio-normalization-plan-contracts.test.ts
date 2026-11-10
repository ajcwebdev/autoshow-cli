import { describe, expect, spyOn, test } from 'bun:test'
import { planNormalizedAudioArtifact, resolveSplitAudioPlan } from '~/cli/commands/sources/download/download-audio/audio-normalize'
import * as cliUtils from '~/utils/cli-utils'
import type { AudioNormalizationProfile, NormalizedAudioPlan } from '~/types'

type ProbeStream = { codec: string, channels?: number, bitRate?: number, video?: boolean }

// ffprobe is replaced by a scripted exec result, so no media binary is needed.
const planFor = async (inputPath: string, profile: AudioNormalizationProfile | undefined, stream: ProbeStream) => {
  const payload = {
    streams: [
      { index: 0, codec_type: 'audio', codec_name: stream.codec, sample_rate: '44100', channels: stream.channels ?? 2, bit_rate: String(stream.bitRate ?? 128_000) },
      ...(stream.video ? [{ index: 1, codec_type: 'video', codec_name: 'h264' }] : [])
    ],
    format: { format_name: 'synthetic', duration: '12.5' }
  }
  const spy = spyOn(cliUtils, 'exec').mockImplementation((async () => ({ exitCode: 0, stdout: JSON.stringify(payload), stderr: '' })) as never)
  try {
    const planned = profile === undefined
      ? await planNormalizedAudioArtifact(inputPath)
      : await planNormalizedAudioArtifact(inputPath, profile)
    expect(spy).toHaveBeenCalledTimes(1)
    return planned
  } finally {
    spy.mockRestore()
  }
}

const PLAN_KEYS = ['profile', 'mode', 'outputExtension', 'outputFormat', 'outputCodecName', 'sourceCodecName', 'reason', 'stripMetadata', 'stripChapters']
const HOSTED_TARGET_KEYS = ['targetBitRate', 'targetSampleRate', 'targetChannels']

type PlanCase = {
  name: string
  inputPath: string
  profile?: AudioNormalizationProfile
  stream: ProbeStream
  expected: NormalizedAudioPlan
}

const plan = (
  profile: AudioNormalizationProfile,
  mode: NormalizedAudioPlan['mode'],
  outputExtension: NormalizedAudioPlan['outputExtension'],
  outputFormat: NormalizedAudioPlan['outputFormat'],
  codecs: { output: string, source: string },
  reason: string
): NormalizedAudioPlan => ({
  profile,
  mode,
  outputExtension,
  outputFormat,
  outputCodecName: codecs.output,
  sourceCodecName: codecs.source,
  reason,
  stripMetadata: profile === 'hosted-stt' || profile === 'hosted-stt-mp3',
  stripChapters: profile === 'hosted-stt' || profile === 'hosted-stt-mp3'
})

const HOSTED_MP3_PRESERVE = 'preserve low-bitrate mono hosted-STT mp3 while stripping non-audio baggage'

const cases: PlanCase[] = [
  {
    name: 'lossless decodes to float32 WAV',
    inputPath: 'talk.mp3', profile: 'lossless', stream: { codec: 'mp3' },
    expected: plan('lossless', 'transcode-pcm', '.wav', 'wav', { output: 'pcm_f32le', source: 'mp3' }, 'preserve decoded float32 samples at the original sample rate and channel count')
  },
  {
    name: 'hosted-stt preserves low-bitrate mono mp3',
    inputPath: 'talk.mp3', profile: 'hosted-stt', stream: { codec: 'mp3', channels: 1, bitRate: 64_000 },
    expected: plan('hosted-stt', 'copy-stream', '.mp3', 'mp3', { output: 'mp3', source: 'mp3' }, HOSTED_MP3_PRESERVE)
  },
  {
    name: 'hosted-stt preserves low-bitrate mono AAC',
    inputPath: 'talk.m4a', profile: 'hosted-stt', stream: { codec: 'aac', channels: 1, bitRate: 96_000 },
    expected: plan('hosted-stt', 'copy-stream', '.m4a', 'ipod', { output: 'aac', source: 'aac' }, 'preserve low-bitrate mono hosted-STT AAC in .m4a while stripping non-audio baggage')
  },
  {
    name: 'hosted-stt compresses other sources to capped mono AAC',
    inputPath: 'talk.mp3', profile: 'hosted-stt', stream: { codec: 'mp3', channels: 2, bitRate: 128_000 },
    expected: {
      ...plan('hosted-stt', 'transcode-aac', '.m4a', 'ipod', { output: 'aac', source: 'mp3' }, 'compress hosted-STT source media to mono AAC-LC in .m4a with a 96 kbps ceiling'),
      targetBitRate: 96_000, targetSampleRate: 44_100, targetChannels: 1
    }
  },
  {
    name: 'hosted-stt-mp3 preserves low-bitrate mono mp3',
    inputPath: 'talk.mp3', profile: 'hosted-stt-mp3', stream: { codec: 'mp3', channels: 1, bitRate: 48_000 },
    expected: plan('hosted-stt-mp3', 'copy-stream', '.mp3', 'mp3', { output: 'mp3', source: 'mp3' }, HOSTED_MP3_PRESERVE)
  },
  {
    name: 'hosted-stt-mp3 compresses other sources to capped mono mp3',
    inputPath: 'talk.m4a', profile: 'hosted-stt-mp3', stream: { codec: 'aac', channels: 1, bitRate: 64_000 },
    expected: {
      ...plan('hosted-stt-mp3', 'transcode-mp3', '.mp3', 'mp3', { output: 'mp3', source: 'aac' }, 'compress hosted-STT source media to mono mp3 with a 96 kbps ceiling'),
      targetBitRate: 64_000, targetSampleRate: 44_100, targetChannels: 1
    }
  },
  {
    name: 'default copies an audio-only mp3 file',
    inputPath: 'talk.mp3', stream: { codec: 'mp3' },
    expected: plan('default', 'copy-file', '.mp3', 'mp3', { output: 'mp3', source: 'mp3' }, 'audio-only mp3 fast path')
  },
  {
    name: 'default remuxes mp3 out of a video container',
    inputPath: 'talk.mkv', profile: 'default', stream: { codec: 'mp3', video: true },
    expected: plan('default', 'copy-stream', '.mp3', 'mp3', { output: 'mp3', source: 'mp3' }, 'extract or remux mp3 audio without re-encoding')
  },
  {
    name: 'default copies an audio-only m4a file',
    inputPath: 'talk.m4a', stream: { codec: 'alac' },
    expected: plan('default', 'copy-file', '.m4a', 'ipod', { output: 'alac', source: 'alac' }, 'audio-only m4a fast path')
  },
  {
    name: 'default remuxes AAC out of a video container',
    inputPath: 'talk.mp4', stream: { codec: 'aac', video: true },
    expected: plan('default', 'copy-stream', '.m4a', 'ipod', { output: 'aac', source: 'aac' }, 'extract or remux AAC/ALAC audio without re-encoding')
  },
  {
    name: 'default copies an audio-only ogg file',
    inputPath: 'talk.ogg', stream: { codec: 'vorbis' },
    expected: plan('default', 'copy-file', '.ogg', 'ogg', { output: 'vorbis', source: 'vorbis' }, 'audio-only ogg fast path')
  },
  {
    name: 'default remuxes Opus from another container',
    inputPath: 'talk.webm', stream: { codec: 'opus' },
    expected: plan('default', 'copy-stream', '.ogg', 'ogg', { output: 'opus', source: 'opus' }, 'extract or remux Opus/Vorbis audio without re-encoding')
  },
  {
    name: 'default copies an audio-only flac file',
    inputPath: 'talk.flac', stream: { codec: 'flac' },
    expected: plan('default', 'copy-file', '.flac', 'flac', { output: 'flac', source: 'flac' }, 'audio-only flac fast path')
  },
  {
    name: 'default remuxes FLAC from another container',
    inputPath: 'talk.mka', stream: { codec: 'flac' },
    expected: plan('default', 'copy-stream', '.flac', 'flac', { output: 'flac', source: 'flac' }, 'extract or remux FLAC audio without re-encoding')
  },
  {
    name: 'default transcodes other codecs to FLAC',
    inputPath: 'talk.wav', stream: { codec: 'pcm_s16le' },
    expected: plan('default', 'transcode-flac', '.flac', 'flac', { output: 'flac', source: 'pcm_s16le' }, 'transcode unsupported or uncompressed audio once to FLAC')
  }
]

describe('audio normalization plan contracts', () => {
  for (const entry of cases) {
    test(entry.name, async () => {
      const { plan: actual, probe } = await planFor(entry.inputPath, entry.profile, entry.stream)
      expect(actual).toEqual(entry.expected)
      expect(Object.keys(actual)).toEqual('targetBitRate' in entry.expected ? [...PLAN_KEYS, ...HOSTED_TARGET_KEYS] : PLAN_KEYS)
      expect(probe.audioStream.codecName).toBe(entry.stream.codec)
    })
  }

  test('split plans keep stream-copyable codecs and transcode the rest to FLAC', async () => {
    const copyable = await planFor('talk.mkv', undefined, { codec: 'aac', video: true })
    expect(resolveSplitAudioPlan('talk.mkv', copyable.probe)).toEqual({ mode: 'copy-stream', outputExtension: '.m4a', outputFormat: 'ipod' })
    const audioOnly = await planFor('talk.mp3', undefined, { codec: 'mp3' })
    expect(resolveSplitAudioPlan('talk.mp3', audioOnly.probe)).toEqual({ mode: 'copy-stream', outputExtension: '.mp3', outputFormat: 'mp3' })
    const uncompressed = await planFor('talk.wav', undefined, { codec: 'pcm_s16le' })
    expect(resolveSplitAudioPlan('talk.wav', uncompressed.probe)).toEqual({ mode: 'transcode-flac', outputExtension: '.flac', outputFormat: 'flac' })
  })
})
