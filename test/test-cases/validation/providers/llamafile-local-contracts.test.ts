import { describe, expect, test } from 'bun:test'
import { LLAMAFILE_BUNDLES, LLAMAFILE_BASE_URL } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-constants'
import { resolveLlamafileBundlePath } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-download'
import { SUPPORTED_LLAMAFILE_MODELS, validateLlamafileModel } from '~/cli/commands/setup-and-utilities/models/llm-models'
import { collectLlmTargets } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import type { LLMOptions } from '~/types'

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
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-server.ts').text()
    expect(source).not.toContain("['ps'")
    expect(source).not.toContain('pid=,command=')
    expect(source).toContain('process.kill(pid, 0)')
  })

  test('llamafile server launches the APE bundle through a shell (macOS posix_spawn cannot exec APE directly)', async () => {
    const source = await Bun.file('src/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-server.ts').text()
    expect(source).toContain("'sh', bundlePath")
  })
})
