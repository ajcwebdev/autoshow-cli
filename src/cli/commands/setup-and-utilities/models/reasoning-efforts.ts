// Expand this public vocabulary only with a documented provider/model contract.
export const NAMED_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export const NORMALIZED_REASONING_EFFORTS = ['default', 'disabled', ...NAMED_REASONING_EFFORTS] as const
