import type { PreparedProviderText } from '~/types'

const CHATTERBOX_ELLIPSIS = /(?:\.\.\.|…)([\t ]*)/gu

export const prepareDeepinfraChatterboxText = (canonicalText: string): PreparedProviderText => {
  const canonicalLength = [...canonicalText].length
  const providerText = canonicalText.replace(CHATTERBOX_ELLIPSIS, (_ellipsis, followingWhitespace: string) => followingWhitespace ? ', ' : ',')
  const providerLength = [...providerText].length

  return {
    schemaVersion: 1,
    canonicalText,
    providerText,
    preparationVersion: providerText === canonicalText ? 'generic-tts-v1' : 'deepinfra-chatterbox-punctuation-v1',
    canonicalIndexUnit: 'unicode-scalar-value',
    providerIndexUnit: 'unicode-scalar-value',
    spans: canonicalLength === 0
      ? []
      : [{
          kind: 'mapped',
          canonicalStart: 0,
          canonicalEnd: canonicalLength,
          providerStart: 0,
          providerEnd: providerLength,
          ...(providerText !== canonicalText ? { transform: 'chatterbox-ellipsis-to-comma-pause' } : {})
        }]
  }
}
