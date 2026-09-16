import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getReplicateBaseUrl = (): string => REPLICATE_DEFAULT_BASE_URL.replace(/\/+$/, '')
