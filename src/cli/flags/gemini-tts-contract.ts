// Keep parsing defaults unset: an explicit transport flag is validated against the selected
// provider. These fallbacks apply only when Gemini execution or a recorded job uses them.
export const GEMINI_TTS_MODES = ['unary', 'stream', 'batch'] as const
export const GEMINI_TTS_DEFAULT_MODE = 'unary' satisfies typeof GEMINI_TTS_MODES[number]
export const GEMINI_TTS_BATCH_WAIT_RANGE = [0, 86400] as const
export const GEMINI_TTS_BATCH_WAIT_DEFAULT_SECONDS = GEMINI_TTS_BATCH_WAIT_RANGE[1]
export const GEMINI_TTS_PROVIDER_JOB_ACTIONS = ['status', 'wait', 'cancel'] as const
export const GEMINI_TTS_PROVIDER_JOB_DEFAULT_ACTION = 'wait' satisfies typeof GEMINI_TTS_PROVIDER_JOB_ACTIONS[number]
