// DeepInfra transcription response formats, shared by the flag definition and target validation.
export const DEEPINFRA_STT_RESPONSE_FORMATS = ['verbose_json', 'srt', 'vtt'] as const
export type DeepinfraSttResponseFormat = typeof DEEPINFRA_STT_RESPONSE_FORMATS[number]
export const DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT: DeepinfraSttResponseFormat = 'verbose_json'
