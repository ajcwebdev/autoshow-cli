import { REVAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'

export const getRevBaseUrl = (): string => REVAI_DEFAULT_BASE_URL

export const ensureRevSttSetup = async (): Promise<void> => { requireProviderKey('rev', 'stt:rev', 'Rev transcription') }
