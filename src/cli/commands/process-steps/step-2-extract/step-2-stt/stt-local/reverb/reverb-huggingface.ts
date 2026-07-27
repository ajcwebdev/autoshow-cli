import { readEnv } from '~/utils/validate/env-utils'

export const getHuggingFaceToken = (): string | undefined => readEnv('HUGGINGFACE_TOKEN')
