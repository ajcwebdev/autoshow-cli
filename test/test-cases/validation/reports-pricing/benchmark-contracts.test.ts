import { describe, expect, test } from 'bun:test'
import { buildBenchmarkAttemptRecord, runBenchmark } from '~/cli/commands/setup-and-utilities/benchmark/run-benchmark'
import { BENCHMARK_EXCLUDED_STT_SERVICES, BENCHMARK_STT_SERVICE_DEFINITIONS, parseReferenceStt, resolveAvailableServices } from '~/cli/commands/setup-and-utilities/benchmark/benchmark-services'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { whisperBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { BenchmarkFlags, TranscribeEngine } from '~/types'

const TRANSCRIBE_ENGINE_UNIVERSE = [
  'reverb', 'deepgram', 'deepinfra', 'soniox', 'speechmatics', 'rev', 'groq', 'grok',
  'mistral', 'assemblyai', 'gladia', 'happyscribe', 'supadata', 'scrapecreators',
  'gemini-stt', 'together', 'whisper', 'whisperfile', 'youtube-captions'
] as const satisfies readonly TranscribeEngine[]

const baseBenchmarkFlags = (serviceFilter: string): BenchmarkFlags => ({
  bitrates: '128',
  speeds: '1.25',
  'stt-services': serviceFilter,
  'reference-stt': 'deepgram:nova-3',
  'skip-compression': true,
  'skip-speed': true
})

describe('benchmark contracts', () => {
  test('benchmark attempt records identify provider, variant, status, and redact secrets', () => {
    const record = buildBenchmarkAttemptRecord(
      {
        path: '/tmp/audio.m4a',
        kind: 'speed',
        label: '3x',
        speedMultiplier: 3
      },
      {
        service: 'deepgram',
        model: 'nova-3',
        envVar: 'DEEPGRAM_API_KEY'
      },
      'error',
      1250,
      'request failed: https://api.example.test/jobs?api_key=secret-token'
    )

    expect(record).toEqual({
      kind: 'benchmark-attempt',
      schemaVersion: 1,
      status: 'error',
      variant: {
        kind: 'speed',
        label: '3x',
        bitrateKbps: undefined,
        speedMultiplier: 3
      },
      service: 'deepgram',
      model: 'nova-3',
      processingTimeMs: 1250,
      error: 'request failed: https://api.example.test/jobs?api_key=REDACTED'
    })
  })

  test('whisper availability probes the managed whisper-cli binary, not PATH', () => {
    const probed: string[] = []
    const missing = resolveAvailableServices('whisper', {
      exists: (path) => {
        probed.push(path)
        return false
      }
    })

    // A PATH lookup would probe nothing; a different install location would probe another path.
    expect(probed).toEqual([whisperBinaryPath])
    expect(missing).toEqual([])

    expect(resolveAvailableServices('whisper', { exists: () => true })).toEqual([
      { service: 'whisper', model: 'base', envVar: undefined }
    ])
  })

  test('benchmark service definitions derive models from the registry and partition every STT engine', () => {
    const included = BENCHMARK_STT_SERVICE_DEFINITIONS.map((definition) => definition.service)
    const excluded = [...BENCHMARK_EXCLUDED_STT_SERVICES]

    expect(new Set([...included, ...excluded])).toEqual(new Set(TRANSCRIBE_ENGINE_UNIVERSE))
    expect(included.filter((service) => BENCHMARK_EXCLUDED_STT_SERVICES.has(service))).toEqual([])
    expect(excluded).toEqual(['reverb', 'supadata', 'scrapecreators', 'whisperfile', 'youtube-captions'])

    const registry = getModelRegistry().stt
    for (const definition of BENCHMARK_STT_SERVICE_DEFINITIONS) {
      const service = registry[definition.service]
      expect(service).toBeDefined()
      expect(definition.models).toEqual(
        definition.service === 'whisper' ? ['base'] : Object.keys(service!.models)
      )
      expect(definition.envVar === undefined).toBe(service!.type === 'local')
    }
  })

  test('unknown service names share the reference-service error contract', () => {
    expect(() => resolveAvailableServices('deepgram,gorq', {
      readEnv: () => 'test-key'
    })).toThrow('Unsupported --stt-services service: gorq. Supported services:')
    expect(() => parseReferenceStt('gorq:whisper-large-v3')).toThrow(
      'Unsupported --reference-stt service: gorq. Supported services:'
    )
  })

  test('--stt-services accepts service:model pairs and defaults to one model per service', () => {
    const configured = { readEnv: () => 'test-key' }
    expect(resolveAvailableServices('deepgram', configured)).toEqual([
      { service: 'deepgram', model: 'nova-3', envVar: 'DEEPGRAM_API_KEY' }
    ])

    // Explicit service:model selectors remain intentionally model-agnostic.
    expect(resolveAvailableServices('deepgram:nova-2', configured)).toEqual([
      { service: 'deepgram', model: 'nova-2', envVar: 'DEEPGRAM_API_KEY' }
    ])

    expect(resolveAvailableServices('deepgram:nova-2,deepgram:nova-3', configured)).toEqual([
      { service: 'deepgram', model: 'nova-2', envVar: 'DEEPGRAM_API_KEY' },
      { service: 'deepgram', model: 'nova-3', envVar: 'DEEPGRAM_API_KEY' }
    ])

    // Known but unavailable services are filtered without becoming selector errors.
    expect(resolveAvailableServices('deepgram:nova-2', { readEnv: () => undefined })).toEqual([])
  })

  test('opting whisper into extra sizes replaces the one-model default', () => {
    expect(
      resolveAvailableServices('whisper:base,whisper:large-v3-turbo', { exists: () => true })
    ).toEqual([
      { service: 'whisper', model: 'base', envVar: undefined },
      { service: 'whisper', model: 'large-v3-turbo', envVar: undefined }
    ])
  })

  test('zero available services fail before audio preparation or reference transcription', async () => {
    await expect(runBenchmark('/definitely/missing/benchmark-audio.mp3', baseBenchmarkFlags('deepgram'), {
      serviceResolution: {
        exists: () => false,
        readEnv: () => undefined
      }
    })).rejects.toThrow(
      'No available STT benchmark services resolved from --stt-services "deepgram".'
    )
  })
})
