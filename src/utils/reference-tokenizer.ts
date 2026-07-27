import { get_encoding } from 'tiktoken'
import type { Tiktoken } from 'tiktoken'
import type { ReferenceTokenizerMetadata } from '~/types'

export const REFERENCE_TOKENIZER_METADATA: ReferenceTokenizerMetadata = {
  name: 'o200k_base',
  packageName: 'tiktoken',
  packageVersion: '1.0.22'
}

let referenceTokenizer: Tiktoken | undefined

const getReferenceTokenizer = (): Tiktoken => {
  referenceTokenizer ??= get_encoding(REFERENCE_TOKENIZER_METADATA.name)
  return referenceTokenizer
}

export const countReferenceTokens = (content: string): number =>
  getReferenceTokenizer().encode_ordinary(content).length
