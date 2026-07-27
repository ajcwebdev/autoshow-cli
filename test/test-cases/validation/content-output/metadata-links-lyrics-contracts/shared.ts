export const SCRAPECREATORS_STT_LINK = 'blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'

export const linksTestOutputPath = (name: string): string =>
  `/tmp/autoshow-links-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
