import type { LlamafileServerState, LocalLlmServerResourceOptions } from '~/types'
import {
  createLocalServerStateStore,
  type LocalServerStateProfile
} from '../local-server-state'
import { LLAMAFILE_PORT, LLAMAFILE_STATE_FILE_NAME } from './llamafile-constants'

const LLAMAFILE_SERVER_STATE_PROFILE = {
  fileName: LLAMAFILE_STATE_FILE_NAME,
  parse: (parsed: Record<string, unknown>): LlamafileServerState | null => {
    const pid = typeof parsed['pid'] === 'number' ? parsed['pid'] : null
    if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
      return null
    }
    return {
      pid: pid as number,
      port: typeof parsed['port'] === 'number' ? parsed['port'] : LLAMAFILE_PORT,
      model: typeof parsed['model'] === 'string' ? parsed['model'] : null,
      createdAt: typeof parsed['createdAt'] === 'string' ? parsed['createdAt'] : ''
    }
  }
} satisfies LocalServerStateProfile<LlamafileServerState>

const llamafileServerState = createLocalServerStateStore(LLAMAFILE_SERVER_STATE_PROFILE)

export const readLlamafileServerState = llamafileServerState.read

export const writeLlamafileServerState = async (
  pid: number,
  model: string,
  options: LocalLlmServerResourceOptions = {}
): Promise<void> => {
  await llamafileServerState.write({
    pid,
    port: LLAMAFILE_PORT,
    model,
    createdAt: new Date().toISOString()
  }, options)
}

export const clearLlamafileServerState = llamafileServerState.clear
