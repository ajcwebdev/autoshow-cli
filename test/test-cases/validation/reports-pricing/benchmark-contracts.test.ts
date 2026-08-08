import { describe, expect, test } from 'bun:test'
import { buildBenchmarkAttemptRecord } from '~/cli/commands/setup-and-utilities/benchmark/run-benchmark'
import { resolveAvailableServices } from '~/cli/commands/setup-and-utilities/benchmark/benchmark-services'
import { whisperBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'

const withEnv = (key: string, value: string | undefined, run: () => void): void => {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try {
    run()
  } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

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

  test('--stt-services accepts service:model pairs and defaults to one model per service', () => {
    withEnv('DEEPGRAM_API_KEY', 'test-key', () => {
      expect(resolveAvailableServices('deepgram')).toEqual([
        { service: 'deepgram', model: 'nova-3', envVar: 'DEEPGRAM_API_KEY' }
      ])

      expect(resolveAvailableServices('deepgram:nova-2')).toEqual([
        { service: 'deepgram', model: 'nova-2', envVar: 'DEEPGRAM_API_KEY' }
      ])

      expect(resolveAvailableServices('deepgram:nova-2,deepgram:nova-3')).toEqual([
        { service: 'deepgram', model: 'nova-2', envVar: 'DEEPGRAM_API_KEY' },
        { service: 'deepgram', model: 'nova-3', envVar: 'DEEPGRAM_API_KEY' }
      ])
    })

    withEnv('DEEPGRAM_API_KEY', undefined, () => {
      expect(resolveAvailableServices('deepgram:nova-2')).toEqual([])
    })
  })

  test('opting whisper into extra sizes replaces the one-model default', () => {
    expect(
      resolveAvailableServices('whisper:base,whisper:large-v3-turbo', { exists: () => true })
    ).toEqual([
      { service: 'whisper', model: 'base', envVar: undefined },
      { service: 'whisper', model: 'large-v3-turbo', envVar: undefined }
    ])
  })
})
