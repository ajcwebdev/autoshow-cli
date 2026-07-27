import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getKittenHfRepo } from '~/cli/commands/setup-and-utilities/models/model-loader'

// KittenTTS downloads through huggingface_hub, so the weights land in the shared
// HF cache outside runtime/ — the same shape as llama.cpp's `-hf` cache. Without
// a check here, every setup run spawns Python and loads the model in full just to
// confirm it is already present.
export const resolveHuggingFaceCacheDir = (): string => {
  const hubCache = process.env['HUGGINGFACE_HUB_CACHE']?.trim()
  if (hubCache) return hubCache

  const hfHome = process.env['HF_HOME']?.trim()
  if (hfHome) return join(hfHome, 'hub')

  return join(homedir(), '.cache/huggingface/hub')
}

// The repo id is not the model name — `kitten-tts-nano` resolves to
// `KittenML/kitten-tts-nano-0.8-fp32` — so the cache key has to come from the
// registry rather than from the selector the user typed.
const kittenTtsRepoDir = (model: string): string | undefined => {
  const repoId = getKittenHfRepo(model)
  if (!repoId) return undefined
  return join(resolveHuggingFaceCacheDir(), `models--${repoId.replace(/\//g, '--')}`)
}

// Follows symlinks: a HuggingFace snapshot is a tree of links into `blobs/`, so
// a plain isFile() check sees nothing, and a dangling link means the blob it
// pointed at was pruned.
const resolvesToNonEmptyFile = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path)
    return stats.isFile() && stats.size > 0
  } catch {
    return false
  }
}

const directoryHasFiles = async (root: string): Promise<boolean> => {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return false
  }

  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (await directoryHasFiles(path)) return true
      continue
    }
    if (await resolvesToNonEmptyFile(path)) return true
  }
  return false
}

// A repo directory can survive as an empty shell after an interrupted download,
// so presence of the directory alone is not evidence the weights are there.
export const hasCachedKittenTtsModel = async (model: string): Promise<boolean> => {
  const repoDir = kittenTtsRepoDir(model)
  if (!repoDir) return false
  return await directoryHasFiles(join(repoDir, 'snapshots'))
}

export const resolveKittenTtsCacheClearPaths = (model: string): string[] => {
  const repoDir = kittenTtsRepoDir(model)
  if (!repoDir) return []
  const repoId = getKittenHfRepo(model)
  return [
    repoDir,
    join(resolveHuggingFaceCacheDir(), '.locks', `models--${repoId!.replace(/\//g, '--')}`)
  ]
}
