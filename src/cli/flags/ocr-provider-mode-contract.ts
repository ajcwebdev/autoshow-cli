// Multi-provider OCR execution modes, shared by the flag definition and option resolution so help
// and validation cannot drift apart.
export const OCR_PROVIDER_MODES = ['fanout', 'pool'] as const
export type OcrProviderMode = typeof OCR_PROVIDER_MODES[number]
export const DEFAULT_OCR_PROVIDER_MODE: OcrProviderMode = 'fanout'
