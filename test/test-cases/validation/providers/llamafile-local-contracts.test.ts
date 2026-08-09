import { describe, expect, test } from 'bun:test'
import { LLAMAFILE_BUNDLES, LLAMAFILE_BASE_URL } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-constants'
import { resolveLlamafileBundlePath } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-download'
import { LLAMAFILE_STOP_PROFILE } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-server'
import {
  clearLlamafileServerState,
  readLlamafileServerState,
  writeLlamafileServerState
} from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-server-state'
import { LLAMAFILE_RUNNER_PROFILE } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/run-llamafile'
import { requestLocalCompletion } from '~/cli/commands/process-steps/step-3-write/write-local/local-completion-client'
import { SUPPORTED_LLAMAFILE_MODELS, validateLlamafileModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { collectLlmTargets } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import type { LLMOptions } from '~/types'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: [],
  tempPrefix: 'autoshow-llamafile-local-contracts-'
})

const baseOptions = {
  outputDir: 'out',
  prompts: [],
} as unknown as LLMOptions

describe('llamafile local contracts', () => {
  test('every supported model has a download bundle URL', () => {
    for (const model of SUPPORTED_LLAMAFILE_MODELS) {
      const url = LLAMAFILE_BUNDLES[model]
      expect(typeof url).toBe('string')
      expect(url).toContain('.llamafile')
    }
    // No orphan bundle entries without a supported alias.
    for (const key of Object.keys(LLAMAFILE_BUNDLES)) {
      expect(SUPPORTED_LLAMAFILE_MODELS).toContain(key as typeof SUPPORTED_LLAMAFILE_MODELS[number])
    }
  })

  test('validateLlamafileModel accepts supported aliases and rejects unknown ones', () => {
    expect(validateLlamafileModel('Qwen3.5-0.8B-Q8_0')).toBe('Qwen3.5-0.8B-Q8_0')
    expect(() => validateLlamafileModel('not-a-real-bundle')).toThrow()
    // Unlike llama, free-form Hugging Face repo ids are not accepted.
    expect(() => validateLlamafileModel('mozilla-ai/some-repo')).toThrow()
  })

  test('resolveLlamafileBundlePath produces a .llamafile path under the bundle dir', () => {
    const path = resolveLlamafileBundlePath('Qwen3.5-0.8B-Q8_0')
    expect(path.endsWith('/llamafile/Qwen3.5-0.8B-Q8_0.llamafile')).toBe(true)
  })

  test('llamafile runs on a separate port from llama.cpp (8080)', () => {
    expect(LLAMAFILE_BASE_URL).toBe('http://localhost:8081')
  })

  test('collectLlmTargets registers a llamafile target classified as local', () => {
    const targets = collectLlmTargets({
      ...baseOptions,
      llamafileModels: ['Qwen3.5-0.8B-Q8_0'],
      llamafileModel: 'Qwen3.5-0.8B-Q8_0',
    })
    const llamafileTargets = targets.filter((target) => target.service === 'llamafile')
    expect(llamafileTargets).toHaveLength(1)
    expect(llamafileTargets[0]?.model).toBe('Qwen3.5-0.8B-Q8_0')
    expect(isLocalLlmTarget({ service: 'llamafile' })).toBe(true)
  })

  test('llamafile server management does not inspect the process table', async () => {
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/local-server-health.ts').text()
    expect(source).not.toContain("['ps'")
    expect(source).not.toContain('pid=,command=')
    expect(source).toContain('process.kill(pid, 0)')
  })

  test('llamafile server launches the APE bundle through a shell (macOS posix_spawn cannot exec APE directly)', async () => {
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-server.ts').text()
    expect(source).toContain("'sh', bundlePath")
  })

  test('shared completion client preserves the llamafile request and error contract', async () => {
    const calls = installMockFetch(() => new Response('nope', {
      status: 503,
      statusText: 'Unavailable'
    }))

    const promise = requestLocalCompletion(
      LLAMAFILE_RUNNER_PROFILE,
      'Local prompt',
      'bundle-model'
    )
    await expect(promise).rejects.toMatchObject({
      message: 'llamafile API error: 503 Unavailable',
      stage: 'write:llamafile'
    })
    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8081/v1/chat/completions',
      method: 'POST',
      bodyJson: {
        model: 'bundle-model',
        messages: [{ role: 'user', content: 'Local prompt' }],
        stream: false,
        temperature: 0.7,
        max_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false }
      }
    })
  })

  test('llamafile keeps health-only stopping and unconditional post-kill state clearing', () => {
    expect(LLAMAFILE_STOP_PROFILE).toMatchObject({
      stopPolicy: 'health-clear'
    })
  })

  test('shared state plumbing preserves llamafile model metadata and unconditional clearing', async () => {
    const lockRoot = await tempDirs.make()
    await writeLlamafileServerState(303, 'Qwen3.5-0.8B-Q8_0', { lockRoot })

    expect(await readLlamafileServerState({ lockRoot })).toMatchObject({
      pid: 303,
      port: 8081,
      model: 'Qwen3.5-0.8B-Q8_0'
    })

    await clearLlamafileServerState(undefined, { lockRoot })
    expect(await readLlamafileServerState({ lockRoot })).toBeNull()
  })
})
