export const REFERENCE_LOCATION_ONLY_FLAGS = ['view', 'llm-provider', 'qa', 'qa-provider', 'max-repairs'] as const

export const REFERENCE_LOCATION_OPTIONS_NOTE = `${REFERENCE_LOCATION_ONLY_FLAGS.map(name => `--${name}`).join(', ')} require --location; character sheets do not use these controls.`
