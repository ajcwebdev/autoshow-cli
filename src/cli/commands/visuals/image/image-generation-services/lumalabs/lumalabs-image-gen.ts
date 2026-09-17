import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getLumalabsBaseUrl = (): string => LUMALABS_DEFAULT_BASE_URL.replace(/\/+$/, '')
