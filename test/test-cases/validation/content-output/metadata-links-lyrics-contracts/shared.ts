export const BLOB_PREFIXED_DOC_LINK = 'blob:https://docs.example.com/de495975-7e82-4fd9-953a-2fe2c257845e'
export const BLOB_PREFIXED_DOC_FETCH_LINK = 'https://docs.example.com/de495975-7e82-4fd9-953a-2fe2c257845e'

export const linksTestOutputPath = (name: string): string =>
  `/tmp/autoshow-links-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
