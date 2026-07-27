import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { LlamaServerTarget } from '~/types'
import { DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS } from './llama-constants'
import { InfraError } from '~/utils/error-handler'

let configuredModelPath: string | undefined

export const configureModelPath = (path: string): void => {
  configuredModelPath = path.trim() || undefined
}

export const resolveLlamaServerBinary = (): string => {
  if (existsSync(llamaBinaryPath)) {
    return llamaBinaryPath
  }

  throw InfraError(`Managed llama-server is missing at ${llamaBinaryPath}. Run \`bun autoshow setup --step llama-binary\` or \`bun autoshow setup\`.`, { stage: 'write:llama' })
}

export const normalizeModelPath = (modelPath: string): string => resolvePath(modelPath.trim())

export const resolveLlamaServerTarget = (model: string): LlamaServerTarget => {
  const modelPath = configuredModelPath
  if (modelPath) {
    return {
      mode: 'path',
      requestedModel: model,
      expectedPath: normalizeModelPath(modelPath),
      startupArgs: ['-m', modelPath]
    }
  }

  const modelRepo = resolveLlamaDownloadRepo(model)
  return {
    mode: 'repo',
    requestedModel: model,
    expectedRepo: modelRepo,
    startupArgs: ['-hf', modelRepo]
  }
}

export const getLlamaServerStartTimeoutMs = (): number => DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS
