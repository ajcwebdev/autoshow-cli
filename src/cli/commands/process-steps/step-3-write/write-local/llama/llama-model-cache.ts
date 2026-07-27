import { readdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/setup-model-options'

// llama-server's `-hf` downloader owns its own cache outside runtime/, so the
// setup-managed marker in runtime/models/llama is not evidence that weights
// exist, and clearing runtime/ does not clear the weights.
export const resolveLlamaCacheDir = (): string => {
  const override = process.env['LLAMA_CACHE']?.trim()
  if (override) return override
  return process.platform === 'darwin'
    ? join(homedir(), 'Library/Caches/llama.cpp')
    : join(homedir(), '.cache/llama.cpp')
}

const cacheEntryPrefix = (model: string): string =>
  `${resolveLlamaDownloadRepo(model).replace(/\//g, '_')}_`

const manifestPath = (model: string): string =>
  join(resolveLlamaCacheDir(), `manifest=${resolveLlamaDownloadRepo(model).replace(/\//g, '=')}=latest.json`)

export const listLlamaCacheEntries = async (model: string): Promise<string[]> => {
  const cacheDir = resolveLlamaCacheDir()
  const prefix = cacheEntryPrefix(model)
  try {
    const entries = await readdir(cacheDir)
    return entries.filter((name) => name.startsWith(prefix)).map((name) => join(cacheDir, name))
  } catch {
    return []
  }
}

export const hasCachedLlamaModelWeights = async (model: string): Promise<boolean> =>
  (await listLlamaCacheEntries(model)).some((path) => path.endsWith('.gguf'))

export const resolveLlamaCacheClearPaths = async (model: string): Promise<string[]> => [
  ...await listLlamaCacheEntries(model),
  manifestPath(model)
]

export const clearCachedLlamaModel = async (model: string): Promise<void> => {
  const targets = await resolveLlamaCacheClearPaths(model)
  await Promise.all(targets.map((path) => rm(path, { recursive: true, force: true })))
}
