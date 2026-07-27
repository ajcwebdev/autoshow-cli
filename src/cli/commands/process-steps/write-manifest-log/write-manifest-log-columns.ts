export const SUMMARY_COLUMNS = ['step', 'providerModel', 'predCost', 'actCost', 'actSource', 'predTime', 'actTime', 'predSpeed', 'actSpeed'] as const
export const PROMPT_USAGE_COLUMNS = ['step', 'providerModel', 'promptSource', 'usage'] as const
export const OCR_COST_COLUMNS = ['providerModel', 'pages', 'predInputs', 'actInputs', 'rates', 'predCost', 'actCost', 'delta'] as const
