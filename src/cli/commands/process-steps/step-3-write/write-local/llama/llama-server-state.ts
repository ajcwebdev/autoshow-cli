import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LlamaServerState, LocalLlmServerResourceOptions } from '~/types'
import { resolveProcessLockRoot } from '~/utils/process-lock'
import { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
const getLlamaServerStatePath = (options: LocalLlmServerResourceOptions = {}): string =>
  join(resolveProcessLockRoot(options), `${LLAMA_PROCESS_LOCK_NAME}.state.json`)

export const readLlamaServerState = async (options: LocalLlmServerResourceOptions = {}): Promise<LlamaServerState | null> => {
  try {
    const parsed = JSON.parse(await readFile(getLlamaServerStatePath(options), 'utf-8')) as Record<string, unknown>
    const pid = typeof parsed['pid'] === 'number' ? parsed['pid'] : null
    if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
      return null
    }

    return { pid: pid as number }
  } catch {
    return null
  }
}

export const writeLlamaServerState = async (
  pid: number,
  options: LocalLlmServerResourceOptions = {}
): Promise<void> => {
  await mkdir(resolveProcessLockRoot(options), { recursive: true })
  await writeFile(getLlamaServerStatePath(options), JSON.stringify({ pid } satisfies LlamaServerState, null, 2))
}

export const clearLlamaServerState = async (
  pid?: number,
  options: LocalLlmServerResourceOptions = {}
): Promise<void> => {
  if (pid !== undefined) {
    const state = await readLlamaServerState(options)
    if (state?.pid !== pid) {
      return
    }
  }

  await rm(getLlamaServerStatePath(options), { force: true })
}
