import type { LlamaServerState, LocalLlmServerResourceOptions } from '~/types'
import {
  createLocalServerStateStore,
  type LocalServerStateProfile
} from '../local-server-state'
import { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'

const LLAMA_SERVER_STATE_PROFILE = {
  fileName: `${LLAMA_PROCESS_LOCK_NAME}.state.json`,
  parse: (parsed: Record<string, unknown>): LlamaServerState | null => {
    const pid = typeof parsed['pid'] === 'number' ? parsed['pid'] : null
    return Number.isInteger(pid) && (pid ?? 0) >= 1 ? { pid: pid as number } : null
  }
} satisfies LocalServerStateProfile<LlamaServerState>

const llamaServerState = createLocalServerStateStore(LLAMA_SERVER_STATE_PROFILE)

export const readLlamaServerState = llamaServerState.read

export const writeLlamaServerState = async (
  pid: number,
  options: LocalLlmServerResourceOptions = {}
): Promise<void> => {
  await llamaServerState.write({ pid }, options)
}

export const clearLlamaServerState = llamaServerState.clear
