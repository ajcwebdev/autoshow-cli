import { cleanEpubHtmlToText } from './cleanup'

export const stripNsPrefixes = (xml: string): string =>
  xml.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*:/g, match => (match[1] === '/' ? '</' : '<'))

export const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

export const cleanEpubHtmlFragmentToText = (html: string): Promise<string> =>
  cleanEpubHtmlToText(`<html><body>${html}</body></html>`)
