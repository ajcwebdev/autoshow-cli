// llamafile runs on a different port than llama.cpp (8080) so the two local
// providers can coexist without colliding on the same server/lock.
export const LLAMAFILE_PORT = 8081
export const LLAMAFILE_BASE_URL = `http://localhost:${LLAMAFILE_PORT}`
export const LLAMAFILE_PROCESS_LOCK_NAME = 'llamafile-server-127.0.0.1-8081'
export const LLAMAFILE_STATE_FILE_NAME = `${LLAMAFILE_PROCESS_LOCK_NAME}.state.json`

export const DEFAULT_LLAMAFILE_SERVER_START_TIMEOUT_MS = 1800000
export const LLAMAFILE_SERVER_HEALTH_POLL_INTERVAL_MS = 1000
export const LLAMAFILE_SERVER_HEALTH_HEARTBEAT_MS = 15000
export const LLAMAFILE_SERVER_STDERR_TAIL_LIMIT = 12000
export const LLAMAFILE_SERVER_STOP_TIMEOUT_MS = 5000
export const LLAMAFILE_EMPTY_RESPONSE_MAX_ATTEMPTS = 3
export const LLAMAFILE_EMPTY_RESPONSE_RETRY_DELAY_MS = 500
export const LLAMAFILE_CHAT_TEMPLATE_KWARGS = { enable_thinking: false } as const

// Prebuilt single-file llamafiles (binary + weights) from the mozilla-ai
// llamafile_0.10 Hugging Face repo. Keys must match SUPPORTED_LLAMAFILE_MODELS
// in setup-and-utilities/models/llm-models.ts.
const LLAMAFILE_RELEASE_BASE = 'https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main'

export const LLAMAFILE_BUNDLES: Record<string, string> = {
  'Qwen3.5-0.8B-Q8_0': `${LLAMAFILE_RELEASE_BASE}/Qwen3.5-0.8B-Q8_0.llamafile`,
  'Qwen3.5-2B-Q8_0': `${LLAMAFILE_RELEASE_BASE}/Qwen3.5-2B-Q8_0.llamafile`,
  'Qwen3.5-4B-Q5_K_S': `${LLAMAFILE_RELEASE_BASE}/Qwen3.5-4B-Q5_K_S.llamafile`
}

// Default llamafile bundle used by `bun autoshow setup --step llamafile` (smallest bundle, ~1.6 GB).
export const DEFAULT_LLAMAFILE_MODEL = 'Qwen3.5-0.8B-Q8_0'
