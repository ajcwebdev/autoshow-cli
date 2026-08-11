import { readFile, stat } from 'node:fs/promises'
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

const readRequiredSnapshotName = async (path: string): Promise<string | undefined> => {
  try {
    const value = (await readFile(path, 'utf8')).trim()
    return /^[a-f0-9]{40,64}$/.test(value) ? value : undefined
  } catch {
    return undefined
  }
}

const readKittenSnapshotManifest = async (
  snapshotDir: string
): Promise<{ modelFile: string, voicesFile: string } | undefined> => {
  try {
    const value = JSON.parse(await readFile(join(snapshotDir, 'config.json'), 'utf8')) as Record<string, unknown>
    const modelFile = typeof value['model_file'] === 'string' ? value['model_file'].trim() : ''
    const voicesFile = typeof value['voices'] === 'string' ? value['voices'].trim() : ''
    if (
      !modelFile.endsWith('.onnx')
      || !voicesFile.endsWith('.npz')
      || modelFile.includes('/')
      || modelFile.includes('\\')
      || voicesFile.includes('/')
      || voicesFile.includes('\\')
    ) return undefined
    return { modelFile, voicesFile }
  } catch {
    return undefined
  }
}

// HuggingFace writes refs/main last enough to identify the selected immutable snapshot. A usable
// Kitten snapshot then consists of its parseable manifest plus the exact ONNX and voice assets it
// names, with every snapshot symlink resolving to a non-empty blob. This stays read-only and never
// asks huggingface_hub to repair or download an interrupted cache.
export const hasCachedKittenTtsModel = async (model: string): Promise<boolean> => {
  const repoDir = kittenTtsRepoDir(model)
  if (!repoDir) return false
  const revision = await readRequiredSnapshotName(join(repoDir, 'refs', 'main'))
  if (!revision) return false
  const snapshotDir = join(repoDir, 'snapshots', revision)
  if (!await resolvesToNonEmptyFile(join(snapshotDir, 'config.json'))) return false
  const manifest = await readKittenSnapshotManifest(snapshotDir)
  if (!manifest) return false
  return await resolvesToNonEmptyFile(join(snapshotDir, manifest.modelFile))
    && await resolvesToNonEmptyFile(join(snapshotDir, manifest.voicesFile))
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
