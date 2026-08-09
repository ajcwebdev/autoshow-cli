import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  LLAMA_RUNNER_PROFILE,
  evaluateLlamaServerIdentityMatch,
  parseLlamaServerIdentityFromModels,
  parseLlamaServerIdentityFromProps
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { LLAMA_STOP_PROFILE } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-server-process'
import {
  clearLlamaServerState,
  readLlamaServerState,
  writeLlamaServerState
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-server-state'
import { requestLocalCompletion } from '~/cli/commands/process-steps/step-3-write/write-local/local-completion-client'
import { runLocalModel } from '~/cli/commands/process-steps/step-3-write/write-local/local-model-runner'
import type { LlamaServerIdentity, LlamaServerTarget } from '~/types'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-llama-local-contracts-'
})

describe('llama local contracts', () => {
  test('parses props identity and normalizes model paths', () => {
    expect(parseLlamaServerIdentityFromProps({
      model_alias: '  Qwen/Qwen3-4B  ',
      model_path: '  ./models/qwen3.gguf  '
    })).toEqual({
      source: 'props',
      modelId: 'Qwen/Qwen3-4B',
      aliases: ['Qwen/Qwen3-4B'],
      modelPath: resolve('./models/qwen3.gguf')
    })

    expect(parseLlamaServerIdentityFromProps({
      model_alias: '',
      model_path: ''
    })).toBeNull()
  })

  test('parses models identity, detects llama.cpp signature, and dedupes aliases', () => {
    expect(parseLlamaServerIdentityFromModels({
      data: [
        {
          id: '  Qwen/Qwen3-4B  ',
          owned_by: 'llamacpp',
          aliases: ['Qwen/Qwen3-4B', 'qwen3', ' qwen3 ']
        },
        {
          id: 'qwen3',
          owned_by: 'llamacpp',
          aliases: ['local-qwen3']
        }
      ]
    })).toEqual({
      source: 'models',
      modelId: 'Qwen/Qwen3-4B',
      aliases: ['Qwen/Qwen3-4B', 'qwen3', 'local-qwen3'],
      modelPath: null
    })

    expect(parseLlamaServerIdentityFromModels({
      data: [
        {
          id: 'Qwen/Qwen3-4B',
          owned_by: 'other'
        }
      ]
    })).toBeNull()
  })

  test('matches repo and path targets with stable mismatch reasons', () => {
    const pathTarget: LlamaServerTarget = {
      mode: 'path',
      requestedModel: 'ignored',
      expectedPath: '/tmp/models/qwen3.gguf',
      startupArgs: []
    }
    const pathIdentity: LlamaServerIdentity = {
      source: 'props',
      modelId: 'qwen3',
      aliases: ['qwen3'],
      modelPath: '/tmp/models/qwen3.gguf'
    }
    expect(evaluateLlamaServerIdentityMatch(pathTarget, pathIdentity)).toEqual({
      matches: true,
      reason: 'model path matches /tmp/models/qwen3.gguf'
    })

    expect(evaluateLlamaServerIdentityMatch(pathTarget, {
      ...pathIdentity,
      modelPath: null
    })).toEqual({
      matches: false,
      reason: 'llama-server did not report model_path; cannot verify expected path /tmp/models/qwen3.gguf'
    })

    const repoTarget: LlamaServerTarget = {
      mode: 'repo',
      requestedModel: 'qwen3',
      expectedRepo: 'Qwen/Qwen3-4B',
      startupArgs: []
    }
    expect(evaluateLlamaServerIdentityMatch(repoTarget, {
      source: 'models',
      modelId: 'local-qwen3',
      aliases: ['Qwen/Qwen3-4B'],
      modelPath: null
    })).toEqual({
      matches: true,
      reason: 'loaded model matches Qwen/Qwen3-4B'
    })

    expect(evaluateLlamaServerIdentityMatch(repoTarget, {
      source: 'models',
      modelId: 'Other/Model',
      aliases: ['other-alias'],
      modelPath: null
    })).toEqual({
      matches: false,
      reason: 'loaded models [Other/Model, other-alias] do not include expected repo Qwen/Qwen3-4B'
    })
  })

  test('llama server management does not inspect the process table', async () => {
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/local-server-health.ts').text()

    expect(source).not.toContain("['ps'")
    expect(source).not.toContain('pid=,command=')
    expect(source).toContain('process.kill(pid, 0)')
  })

  test('shared completion client sends native llama.cpp schemas and preserves the response contract', async () => {
    const signal = new AbortController().signal
    let requestSignal: AbortSignal | null | undefined
    const calls = installMockFetch((_call, _input, init) => {
      requestSignal = init?.signal
      return Response.json({
        choices: [{ message: { content: 'Local response' } }],
        usage: { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 }
      })
    })

    const result = await requestLocalCompletion(
      LLAMA_RUNNER_PROFILE,
      'Local prompt',
      'loaded-model',
      {
        schemaName: 'local_response',
        schema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
          additionalProperties: false
        },
        strict: false,
        strategy: 'native'
      },
      signal
    )

    expect(result).toEqual({ responseText: 'Local response', outputTokenCount: 7 })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/v1/chat/completions',
      method: 'POST',
      bodyJson: {
        model: 'loaded-model',
        messages: [{ role: 'user', content: 'Local prompt' }],
        stream: false,
        temperature: 0.7,
        max_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'local_response',
            schema: {
              type: 'object',
              properties: { answer: { type: 'string' } },
              required: ['answer'],
              additionalProperties: false
            },
            strict: false
          }
        }
      }
    })
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    expect(requestSignal).toBe(signal)
  })

  test('local model runner threads native structured options into the completion request', async () => {
    const calls = installMockFetch(() => Response.json({
      choices: [{ message: { content: '{"answer":"yes"}' } }],
      usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
    }))

    const result = await runLocalModel({
      ...LLAMA_RUNNER_PROFILE,
      processLockName: `llama-native-structured-contract-${process.pid}`,
      ensureServerRunning: async () => 'loaded-model'
    }, 'Local prompt', 'configured-model', {
      schemaName: 'local_response',
      schema: { type: 'object' },
      strict: false,
      strategy: 'native'
    })

    expect(calls[0]?.bodyJson?.['response_format']).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'local_response',
        schema: { type: 'object' },
        strict: false
      }
    })
    expect(result.metadata).toMatchObject({
      llmService: 'llama.cpp',
      llmModel: 'configured-model',
      structuredMode: 'native'
    })
  })

  test('llama.cpp keeps PID-exit verification and PID-guarded state clearing', () => {
    expect(LLAMA_STOP_PROFILE).toMatchObject({
      stopPolicy: 'verified-pid'
    })
  })

  test('shared state plumbing preserves llama.cpp PID-guarded clearing', async () => {
    const lockRoot = await tempDirs.make()
    await writeLlamaServerState(101, { lockRoot })
    expect(await readLlamaServerState({ lockRoot })).toEqual({ pid: 101 })

    await writeLlamaServerState(202, { lockRoot })
    await clearLlamaServerState(101, { lockRoot })
    expect(await readLlamaServerState({ lockRoot })).toEqual({ pid: 202 })

    await clearLlamaServerState(202, { lockRoot })
    expect(await readLlamaServerState({ lockRoot })).toBeNull()
  })
})
